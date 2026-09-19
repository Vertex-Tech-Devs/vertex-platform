/**
 * Auditoría diaria de sitios de Firebase Hosting (prod + dev).
 * - Detecta sitios huérfanos (sin tienda asociada) y shards cerca del límite.
 * - Limpieza SEGURA: borra sólo huérfanos SIN releases, con tope diario y auditoría.
 * - NUNCA crea sitios (no quema namespaces de SITE_ID).
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { getOwnerOAuthClient, ALLOWED_ORIGINS } from './helpers';
import {
  buildAuditReport,
  classifySite,
  siteIdFromName,
  type SiteClassification,
  type SitesAuditSummary,
} from './sites-audit.utils';

const HOSTING_API = 'https://firebasehosting.googleapis.com/v1beta1';

function isPlatformAdmin(token?: Record<string, unknown> | null): boolean {
  const email = String(token?.['email'] || '').toLowerCase();
  return (
    email === 'vertex.tech.dev@gmail.com' ||
    token?.['platformAdmin'] === true ||
    token?.['superAdmin'] === true
  );
}

interface AuditOptions {
  cleanup: boolean;
  maxDeletes: number;
  actor: string;
}

/** Ejecuta la auditoría completa y devuelve el reporte. */
export async function runSitesAudit(options: AuditOptions): Promise<SitesAuditSummary> {
  const db = getFirestore();
  const auth = await getOwnerOAuthClient();
  const token = (await auth.getAccessToken()).token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Referencias: sitios usados por alguna tienda (principal, siteId, subdomain o alias).
  const storesSnap = await db.collection('stores').get();
  const referenced = new Set<string>();
  for (const doc of storesSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    for (const key of ['runtimeSiteId', 'siteId', 'subdomain']) {
      const value = String(data[key] || '').trim();
      if (value) referenced.add(value);
    }
    const aliases = (data['subdomainAliases'] as unknown[]) || [];
    for (const alias of aliases) {
      const value = String(alias || '').trim();
      if (value) referenced.add(value);
    }
  }

  const shardsSnap = await db.collection('infrastructure_shards').get();
  const projectIds = Array.from(
    new Set(
      shardsSnap.docs
        .map((d) => String(d.data()['gcpProjectId'] || d.data()['projectId'] || d.id).trim())
        .filter(Boolean),
    ),
  );

  const classifications: SiteClassification[] = [];
  const deleted: Array<{ projectId: string; siteId: string }> = [];
  let deletesLeft = Math.max(0, options.maxDeletes);

  for (const projectId of projectIds) {
    try {
      const sitesRes = await fetch(`${HOSTING_API}/projects/${projectId}/sites`, { headers });
      if (!sitesRes.ok) continue;
      const sitesBody = (await sitesRes.json()) as { sites?: Array<{ name?: string }> };
      for (const site of sitesBody.sites || []) {
        const siteId = siteIdFromName(site.name || '');
        if (!siteId) continue;
        let hasReleases = false;
        try {
          const relRes = await fetch(
            `${HOSTING_API}/projects/${projectId}/sites/${encodeURIComponent(siteId)}/releases?pageSize=1`,
            { headers },
          );
          if (relRes.ok) {
            const relBody = (await relRes.json()) as { releases?: unknown[] };
            hasReleases = (relBody.releases || []).length > 0;
          } else {
            hasReleases = true; // ante duda, no borrar
          }
        } catch {
          hasReleases = true;
        }
        const classification = classifySite(projectId, siteId, referenced, hasReleases);
        classifications.push(classification);

        if (options.cleanup && classification.safeToDelete && deletesLeft > 0) {
          const delRes = await fetch(
            `${HOSTING_API}/projects/${projectId}/sites/${encodeURIComponent(siteId)}`,
            { method: 'DELETE', headers },
          );
          if (delRes.ok || delRes.status === 404) {
            deletesLeft -= 1;
            deleted.push({ projectId, siteId });
            await db.collection('admin_audit').add({
              action: 'site_deleted_orphan',
              target: siteId,
              projectId,
              actor: options.actor,
              reason:
                'Auditoría diaria: sitio sin tienda asociada y sin releases (limpieza de cupo).',
              timestamp: new Date(),
            });
            logger.info(`[sites-audit] Sitio huérfano eliminado: ${projectId}/${siteId}`);
          }
        }
      }
    } catch (err) {
      logger.warn(`[sites-audit] No se pudo auditar el shard ${projectId}:`, err);
    }
  }

  const report = buildAuditReport(classifications, deleted);

  // Reporte diario + alerta en el Centro de Alertas.
  await db
    .collection('system_audit')
    .doc(`sites_${report.date}`)
    .set({ ...report, updatedAt: new Date(), actor: options.actor });
  if (report.orphan > 0) {
    const key = 'orphan_sites';
    const ref = db.collection('alerts').doc(key);
    const exists = (await ref.get()).exists;
    const payload = {
      key,
      kind: 'orphan_sites',
      severity: report.orphan > 5 ? 'critical' : 'warning',
      title: 'Sitios huérfanos en shards',
      message: `Hay ${report.orphan} sitio(s) de Hosting sin tienda asociada (${report.pendingReview.length} requieren revisión manual). Se limpiaron ${report.deleted.length} de forma segura en esta corrida.`,
      storeId: null,
      link: '/settings/infrastructure',
      status: 'open',
      lastSeen: new Date(),
      ...(exists ? {} : { firstSeen: new Date(), count: 1, resolvedAt: null }),
    };
    await ref.set(payload, { merge: true });
  }
  logger.info(`[sites-audit] Ronda completa: ${JSON.stringify(report)}`);
  return report;
}

/** Auditoría diaria automática (03:00 ART) con limpieza segura (tope 10/día). */
export const auditSitesDaily = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Argentina/Buenos_Aires',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    await runSitesAudit({ cleanup: true, maxDeletes: 10, actor: 'scheduler' });
  },
);

/** Ejecución manual desde la plataforma (superadmin). `cleanup` activa la limpieza. */
export const runSitesAuditNow = onCall<{ cleanup?: boolean; maxDeletes?: number }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public', timeoutSeconds: 540 },
  async (request) => {
    if (!isPlatformAdmin(request.auth?.token)) {
      throw new HttpsError('permission-denied', 'Solo superadmins pueden ejecutar la auditoría.');
    }
    return runSitesAudit({
      cleanup: Boolean(request.data?.cleanup),
      maxDeletes: Math.min(Math.max(Number(request.data?.maxDeletes) || 10, 0), 50),
      actor: String(request.auth?.token?.['email'] || 'superadmin'),
    });
  },
);
