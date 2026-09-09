import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';

export type LogSeverity = 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface StoreLogEntry {
  timestamp: string;
  severity: LogSeverity | string;
  function?: string;
  message: string;
  raw?: string;
  project?: string;
}

export interface GetStoreLogsResponse {
  success: boolean;
  project: string;
  entries: StoreLogEntry[];
  truncated: boolean;
}

const STOREFRONT_PROD = 'ecommerce-vertex';
const STOREFRONT_DEV = 'ecommerce-vertex-dev';

function toSeverityLevel(sev?: string): number {
  const map: Record<string, number> = {
    DEFAULT: 0,
    DEBUG: 100,
    INFO: 200,
    NOTICE: 300,
    WARNING: 400,
    ERROR: 500,
    CRITICAL: 600,
    ALERT: 700,
    EMERGENCY: 800,
  };
  return map[(sev || 'INFO').toUpperCase()] ?? 200;
}

/**
 * getStoreLogs — Logs por tienda.
 * Consulta Cloud Logging del proyecto storefront (ecommerce-vertex / ecommerce-vertex-dev)
 * filtrando por el tenant/slug de la tienda, severidad y término libre.
 * Requiere que la identidad runtime de estas functions tenga `roles/logging.viewer`
 * sobre el proyecto consultado (se otorga en el despliegue).
 */
export const getStoreLogs = onCall<{
  storeId: string;
  severity?: string;
  query?: string;
  sinceMinutes?: number;
  limit?: number;
}>({ timeoutSeconds: 60, cors: true, invoker: 'public' }, async (request) => {
  if (!request.auth?.token?.['platformAdmin']) {
    throw new HttpsError('permission-denied', 'Only platform admins can read store logs.');
  }
  const { storeId, severity, query, sinceMinutes = 2880, limit = 50 } = request.data;
  if (!storeId || !/^[a-zA-Z0-9_-]{1,120}$/.test(storeId)) {
    throw new HttpsError('invalid-argument', 'Invalid storeId.');
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeSince = Math.min(Math.max(Number(sinceMinutes) || 2880, 5), 10080);

  const db = getFirestore();
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists) {
    throw new HttpsError('not-found', 'Store not found.');
  }
  const store = storeSnap.data() as {
    slug?: string;
    firebaseProjectId?: string;
    environment?: string;
  };
  const slug = store.slug || storeId;
  const isDev = String(store.firebaseProjectId || store.environment || '').includes('-dev');
  const project = isDev ? STOREFRONT_DEV : STOREFRONT_PROD;

  const sinceIso = new Date(Date.now() - safeSince * 60_000).toISOString();
  const sinceDate = new Date(Date.now() - safeSince * 60_000);
  const PAYMENT_FNS =
    'resource.labels.function_name:"mercadoPagoWebhookHandler" OR ' +
    'resource.labels.function_name:"createPaymentPreference" OR ' +
    'resource.labels.function_name:"notifyOrderConfirmation" OR ' +
    'resource.labels.function_name:"client-registry" OR ' +
    'resource.labels.function_name:"superadmin.functions"';

  // Free-text del tenant + opciones adicionales. Se incluyen SIEMPRE los errores del
  // flujo de pagos aunque no mencionen el tenant (crash stacks/structured payloads),
  // para que el Monitor muestre el cuadro completo, no solo logs que contengan el slug.
  const tenantMatch = `(textPayload:"${slug}" OR textPayload:"${storeId}" OR jsonPayload.message:"${slug}" OR jsonPayload.text:"${slug}")`;
  const parts: string[] = [
    `resource.type=("cloud_run_revision" OR "cloud_function")`,
    `timestamp >= "${sinceIso}"`,
    `(${tenantMatch} OR (severity >= ${toSeverityLevel('ERROR')} AND (${PAYMENT_FNS})))`,
  ];
  if (severity && severity.toUpperCase() !== 'ALL' && severity.toUpperCase() !== 'ERROR') {
    parts.push(`severity >= ${toSeverityLevel(severity)}`);
  }
  if (query && String(query).trim()) {
    const q = String(query).trim().replace(/["\\]/g, '');
    parts.push(`(${tenantMatch} OR textPayload:"${q}" OR jsonPayload.message:"${q}")`);
  }

  const filter = parts.join(' AND ');

  const queryFirestoreAuditLogsFallback = async (): Promise<StoreLogEntry[]> => {
    try {
      const fallbackEntries: StoreLogEntry[] = [];
      const auditCol = db.collection('audit_logs');
      const qSnap = await auditCol
        .where('timestamp', '>=', sinceDate)
        .orderBy('timestamp', 'desc')
        .limit(safeLimit)
        .get()
        .catch(() => null);

      if (qSnap && !qSnap.empty) {
        qSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const msg = String(d['message'] || d['action'] || '');
          const dSlug = String(d['storeId'] || d['slug'] || d['targetId'] || '');
          if (
            !slug ||
            dSlug === slug ||
            dSlug === storeId ||
            msg.includes(slug) ||
            msg.includes(storeId)
          ) {
            fallbackEntries.push({
              timestamp:
                d['timestamp']?.toDate?.()?.toISOString() ||
                (d['timestamp'] instanceof Date
                  ? d['timestamp'].toISOString()
                  : String(d['timestamp'] || '')),
              severity: d['severity'] || 'INFO',
              function: d['module'] || 'audit_logs',
              message: msg,
              project: 'firestore-audit',
            });
          }
        });
      }
      return fallbackEntries;
    } catch {
      return [];
    }
  };

  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/logging.read'],
    });
    const client = await auth.getClient();
    type RawEntry = {
      timestamp?: string;
      severity?: string;
      resource?: { labels?: Record<string, string> };
      textPayload?: string;
      jsonPayload?: Record<string, unknown>;
    };
    const queryProject = async (proj: string): Promise<StoreLogEntry[]> => {
      const resp = await (client as { request<T>(o: unknown): Promise<{ data: T }> }).request<{
        entries?: RawEntry[];
      }>({
        url: 'https://logging.googleapis.com/v2/entries:list',
        method: 'POST',
        data: {
          resourceNames: [`projects/${proj}`],
          filter,
          orderBy: 'timestamp desc',
          pageSize: safeLimit,
        },
      });
      return (resp.data.entries || []).map((e) => {
        const jp = e.jsonPayload as Record<string, unknown> | undefined;
        const message =
          String(e.textPayload ?? '') ||
          String(jp?.['message'] ?? jp?.['msg'] ?? jp?.['error'] ?? jp?.['text'] ?? '');
        return {
          timestamp: e.timestamp || '',
          severity: e.severity || 'DEFAULT',
          function: e.resource?.labels?.['function_name'] || e.resource?.labels?.['service_name'],
          message,
          raw: jp ? JSON.stringify(jp) : undefined,
          project: proj,
        };
      });
    };

    const platformProject = 'vertex-platform-app';
    const projectsToQuery =
      (project as string) !== platformProject ? [project, platformProject] : [project];

    const results = await Promise.allSettled(projectsToQuery.map((p) => queryProject(p)));
    const entries: StoreLogEntry[] = [];

    results.forEach((res, idx) => {
      const proj = projectsToQuery[idx];
      if (res.status === 'fulfilled') {
        entries.push(...res.value);
      } else {
        logger.warn(`[getStoreLogs] No se pudieron leer logs de ${proj}:`, res.reason);
      }
    });

    entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    if (entries.length === 0) {
      const fallback = await queryFirestoreAuditLogsFallback();
      if (fallback.length > 0) {
        return {
          success: true,
          project: 'firestore-audit',
          entries: fallback.slice(0, safeLimit),
          truncated: fallback.length >= safeLimit,
        };
      }
    }

    return {
      success: true,
      project,
      entries: entries.slice(0, safeLimit),
      truncated: entries.length >= safeLimit,
    };
  } catch (err) {
    logger.warn(`[getStoreLogs] Error general consultando logs de ${project} para ${slug}:`, err);
    const fallback = await queryFirestoreAuditLogsFallback();
    return {
      success: true,
      project: fallback.length > 0 ? 'firestore-audit' : project,
      entries: fallback.slice(0, safeLimit),
      truncated: false,
    };
  }
});
