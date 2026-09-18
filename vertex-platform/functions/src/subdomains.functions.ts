import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { getOwnerOAuthClient, ALLOWED_ORIGINS } from './helpers';
import { ensureAuthorizedDomain } from './hosting-auth.utils';
import {
  buildSubdomainSuggestions,
  normalizeFreeSubdomain,
  RESERVED_SUBDOMAINS,
} from './hosting-subdomain.utils';

const HOSTING_API = 'https://firebasehosting.googleapis.com/v1beta1';

interface HostingErrorBody {
  error?: { message?: string; code?: number };
}

/** Busca colisiones en Firestore (stores) para un subdominio o dominio propio. */
async function subdomainCollision(
  db: FirebaseFirestore.Firestore,
  candidate: string,
  excludeStoreId?: string,
): Promise<boolean> {
  const queries = [
    db.collection('stores').where('subdomain', '==', candidate).limit(1),
    db.collection('stores').where('subdomain', '==', `vtx-${candidate}`).limit(1),
    db.collection('stores').where('customDomain', '==', candidate).limit(1),
  ];
  for (const q of queries) {
    const snap = await q.get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      if (!excludeStoreId || doc.id !== excludeStoreId) {
        return true;
      }
    }
  }
  return false;
}

/** Guard: platform admins (vertex.tech.dev@gmail.com / platformAdmin / superAdmin). */
function isPlatformAdmin(token?: Record<string, unknown> | null): boolean {
  const email = String(token?.['email'] || '').toLowerCase();
  return (
    email === 'vertex.tech.dev@gmail.com' ||
    token?.['platformAdmin'] === true ||
    token?.['superAdmin'] === true
  );
}

async function siteExists(projectId: string, siteId: string): Promise<boolean> {
  const auth = await getOwnerOAuthClient();
  const token = (await auth.getAccessToken()).token;
  const url = `${HOSTING_API}/projects/${projectId}/sites/${encodeURIComponent(siteId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) return true;
  if (res.status === 404) return false;
  const body = (await res.json().catch(() => ({}))) as HostingErrorBody;
  throw new Error(`Hosting sites.get failed (${res.status}): ${body?.error?.message || ''}`);
}

/**
 * checkSubdomainAvailability — verifica unicidad de una URL gratuita `.web.app`.
 * Consulta Firebase Hosting (sites.get) sobre el proyecto maestro storefront y, si el
 * candidato está ocupado, sugiere 3 alternativas limpias.
 */
export const checkSubdomainAvailability = onCall<{ candidate: string; storeId?: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('permission-denied', 'Se requiere autenticación.');
    }
    const admin = isPlatformAdmin(request.auth?.token);
    const db = getFirestore();
    const { candidate, storeId } = request.data || {};
    const sanitized = normalizeFreeSubdomain(String(candidate || ''));
    if (!sanitized) {
      return { available: false, sanitized: '', suggestions: [] };
    }

    // Palabras reservadas: bypass solo para admins de plataforma.
    if (RESERVED_SUBDOMAINS.includes(sanitized)) {
      if (!admin) {
        return {
          available: false,
          sanitized,
          reason: 'RESERVED_KEYWORD',
          message: 'Esta palabra está reservada para el sistema.',
        };
      }
    }

    // Colisiones con otras tiendas en Firestore (excluye la actual si se envía).
    try {
      const collision = await subdomainCollision(db, sanitized, storeId || undefined);
      if (collision) {
        return {
          available: false,
          sanitized,
          reason: 'ALREADY_REGISTERED',
          message: 'Este dominio ya está en uso por otra tienda en Vertex.',
        };
      }
    } catch (err) {
      logger.warn('[Subdomain] Chequeo de colisión en Firestore falló:', err);
    }

    // Colisión en el shard destino (Hosting es único por proyecto): si la tienda ya tiene
    // shard asignado, chequeamos su proyecto además de los proyectos master.
    if (storeId) {
      try {
        const sSnap = await db.collection('stores').doc(storeId).get();
        const sData = (sSnap.data() || {}) as Record<string, unknown>;
        let targetProject = String(
          sData['gcpProjectId'] || sData['runtimeProjectId'] || sData['firebaseProjectId'] || '',
        ).trim();
        if (!targetProject && sData['shardId']) {
          const shSnap = await db
            .collection('infrastructure_shards')
            .doc(String(sData['shardId']))
            .get();
          targetProject = String(
            shSnap.data()?.['gcpProjectId'] || shSnap.data()?.['projectId'] || '',
          ).trim();
        }
        if (targetProject && (await siteExists(targetProject, sanitized))) {
          return {
            available: false,
            sanitized,
            reason: 'ALREADY_REGISTERED',
            message: 'Este dominio ya está en uso por otra tienda en Vertex.',
          };
        }
      } catch (err) {
        logger.warn('[Subdomain] Chequeo de colisión en shard falló:', err);
      }
    }

    const projectsToCheck = ['ecommerce-vertex', 'ecommerce-vertex-dev'];
    let taken = false;
    for (const projectId of projectsToCheck) {
      try {
        if (await siteExists(projectId, sanitized)) {
          taken = true;
          break;
        }
      } catch (err) {
        logger.warn(`[Subdomain] sites.get falló en ${projectId}:`, err);
      }
    }
    if (!taken) {
      return { available: true, sanitized };
    }
    return {
      available: false,
      sanitized,
      reason: 'TAKEN',
      suggestions: buildSubdomainSuggestions(sanitized),
    };
  },
);

export const updateStoreSubdomain = onCall<{ storeId: string; newSubdomain: string }>(
  { timeoutSeconds: 120, cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth || !isPlatformAdmin(request.auth?.token)) {
      throw new HttpsError('permission-denied', 'Only platform admins can update subdomains.');
    }
    const { storeId, newSubdomain } = request.data;
    if (!storeId || !/^[a-zA-Z0-9_-]{1,120}$/.test(storeId)) {
      throw new HttpsError('invalid-argument', 'Invalid storeId.');
    }
    const sanitized = normalizeFreeSubdomain(String(newSubdomain || ''));
    if (!sanitized) {
      throw new HttpsError('invalid-argument', 'Subdominio inválido (4–30 caracteres a-z0-9-).');
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');
    const store = storeSnap.data() as Record<string, unknown>;
    let targetProjectId = String(
      store['gcpProjectId'] || store['runtimeProjectId'] || store['firebaseProjectId'] || '',
    ).trim();
    if (!targetProjectId && store['shardId']) {
      const shardSnap = await db
        .collection('infrastructure_shards')
        .doc(String(store['shardId']))
        .get();
      targetProjectId = String(
        shardSnap.data()?.['gcpProjectId'] || shardSnap.data()?.['projectId'] || '',
      ).trim();
    }
    if (!targetProjectId) {
      targetProjectId = process.env.GCLOUD_PROJECT || 'vertex-platform-dev';
    }

    const oldSiteId = String(store['runtimeSiteId'] || store['siteId'] || `vtx-${storeId}`).trim();
    if (oldSiteId === sanitized) {
      return { success: true, subdomain: sanitized, alreadyCurrent: true };
    }

    const auth = await getOwnerOAuthClient();
    const token = (await auth.getAccessToken()).token;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    let createdNewSite = false;

    try {
      // 0) disponibilidad estricta: colisión en Firestore (otras tiendas) + Hosting
      if (await subdomainCollision(db, sanitized, storeId)) {
        throw new HttpsError(
          'already-exists',
          'Este dominio ya está registrado por otra tienda en Vertex.',
        );
      }
      if (await siteExists(targetProjectId, sanitized)) {
        throw new HttpsError(
          'already-exists',
          'El subdominio ya está en uso. Elegí una de las sugerencias.',
        );
      }

      // 1) crear nuevo sitio en Firebase Hosting
      const parent = targetProjectId.startsWith('projects/')
        ? targetProjectId
        : `projects/${targetProjectId}`;
      const projectBare = targetProjectId.replace(/^projects\//, '');
      const createSiteUrl = `${HOSTING_API}/${parent}/sites?siteId=${encodeURIComponent(sanitized)}`;
      let createRes = await fetch(createSiteUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'WEB_APP' }),
      });
      // Fallback a USER_SITE si WEB_APP no es reconocido en la llamada directa
      if (!createRes.ok && createRes.status === 400) {
        createRes = await fetch(createSiteUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ type: 'USER_SITE' }),
        });
      }
      if (!createRes.ok && createRes.status !== 409) {
        const body = (await createRes.json().catch(() => ({}))) as HostingErrorBody;
        const detail = String(body?.error?.message || '');
        const reservedByAnotherProject =
          createRes.status === 403 || /reserved by another project/i.test(detail);
        if (reservedByAnotherProject) {
          throw new HttpsError(
            'already-exists',
            `“${sanitized}” está reservado por otro proyecto de Firebase. Probá otra de las sugerencias.`,
          );
        }
        throw new Error(`sites.create falló: ${detail || createRes.status}`);
      }
      if (createRes.ok) {
        createdNewSite = true;
      }

      // 2) clonar la VERSIÓN del sitio anterior al nuevo (Hosting NO permite
      //    crear un release con la versión de otro sitio: "Site name mismatch").
      let sourceVersion = '';
      try {
        const releasesUrl = `${HOSTING_API}/${parent}/sites/${encodeURIComponent(
          oldSiteId,
        )}/releases?pageSize=1`;
        const relRes = await fetch(releasesUrl, { headers });
        if (relRes.ok) {
          const relBody = (await relRes.json()) as {
            releases?: Array<{ version?: { name?: string } }>;
          };
          sourceVersion = relBody.releases?.[0]?.version?.name || '';
        }
      } catch (cloneErr) {
        logger.warn(`[Subdomain] No se pudo leer releases del sitio ${oldSiteId}:`, cloneErr);
      }
      if (!sourceVersion) {
        throw new HttpsError(
          'failed-precondition',
          'La tienda no tiene un release activo para clonar. Re-desplegá la tienda antes de cambiar la dirección.',
        );
      }

      const cloneUrl = `${HOSTING_API}/${parent}/sites/${encodeURIComponent(sanitized)}/versions:clone`;
      const cloneRes = await fetch(cloneUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sourceVersion, finalize: true }),
      });
      if (!cloneRes.ok) {
        const body = (await cloneRes.json().catch(() => ({}))) as HostingErrorBody;
        throw new HttpsError(
          'failed-precondition',
          `No se pudo clonar la versión al dominio nuevo (${cloneRes.status}). Re-desplegá la tienda y reintentá. ${
            body?.error?.message || ''
          }`.trim(),
        );
      }
      const clonedBody = (await cloneRes.json().catch(() => ({}))) as { name?: string };
      const clonedVersion = String(clonedBody?.name || '').trim();
      if (!clonedVersion.includes(`/sites/${sanitized}/versions/`)) {
        throw new HttpsError(
          'internal',
          'El clon de la versión no devolvió una versión válida del sitio nuevo.',
        );
      }

      // 2b) crear el release en el sitio nuevo apuntando a la versión CLONADA (mismo sitio)
      const releaseCreate = `${HOSTING_API}/${parent}/sites/${encodeURIComponent(
        sanitized,
      )}/releases?versionName=${encodeURIComponent(clonedVersion)}`;
      const releaseRes = await fetch(releaseCreate, { method: 'POST', headers });
      if (!releaseRes.ok) {
        const body = (await releaseRes.json().catch(() => ({}))) as HostingErrorBody;
        throw new Error(
          `release create falló (${releaseRes.status}): ${body?.error?.message || ''}`,
        );
      }

      // 3) autorizar el dominio nuevo en Firebase Auth (login con Google del admin)
      await ensureAuthorizedDomain(auth, projectBare, `${sanitized}.web.app`, { strict: true });

      // 4) health check: el sitio nuevo debe responder 200 antes de confirmar el cambio
      const newUrl = `https://${sanitized}.web.app`;
      let healthy = false;
      const healthStart = Date.now();
      while (Date.now() - healthStart < 90_000) {
        try {
          const probe = await fetch(newUrl, { method: 'GET', redirect: 'follow' });
          if (probe.status === 200) {
            healthy = true;
            break;
          }
        } catch {
          // reintenta
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      if (!healthy) {
        throw new Error(
          `El sitio ${sanitized}.web.app no respondió 200 tras publicar. Se mantiene la dirección anterior.`,
        );
      }

      // 5) actualizar doc atómicamente (recién ahora, con el sitio ya sirviendo)
      await storeRef.update({
        runtimeSiteId: sanitized,
        siteId: sanitized,
        subdomain: sanitized,
        defaultUrl: newUrl,
        subdomainUpdatedAt: new Date(),
        subdomainOldSite: oldSiteId,
      });

      // 6) eliminar sitio anterior (preserva cuota de 36 sitios)
      try {
        const oldSiteUrl = `${HOSTING_API}/${parent}/sites/${encodeURIComponent(oldSiteId)}`;
        const delRes = await fetch(oldSiteUrl, { method: 'DELETE', headers });
        if (!delRes.ok && delRes.status !== 404) {
          logger.warn(`[Subdomain] No se pudo borrar sitio viejo ${oldSiteId}: ${delRes.status}`);
        }
      } catch (delErr) {
        logger.warn(`[Subdomain] Error al intentar eliminar sitio anterior ${oldSiteId}:`, delErr);
      }

      logger.info(
        `[Subdomain] Tienda ${storeId}: ${oldSiteId} → ${sanitized} (proyecto ${targetProjectId})`,
      );
      return { success: true, subdomain: sanitized, url: newUrl };
    } catch (err) {
      // Revert: sólo si NOSOTROS creamos el sitio nuevo y el cambio no se confirmó.
      if (createdNewSite) {
        try {
          const parentToClean = targetProjectId.startsWith('projects/')
            ? targetProjectId
            : `projects/${targetProjectId}`;
          const cleanupUrl = `${HOSTING_API}/${parentToClean}/sites/${encodeURIComponent(sanitized)}`;
          await fetch(cleanupUrl, { method: 'DELETE', headers });
        } catch (cleanupErr) {
          logger.warn(`[Subdomain] No se pudo limpiar el sitio nuevo ${sanitized}:`, cleanupErr);
        }
      }
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Subdomain] Error cambiando subdominio de ${storeId}:`, err);
      throw new HttpsError('internal', `No se pudo cambiar el subdominio: ${msg.slice(0, 300)}`);
    }
  },
);
