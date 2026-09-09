import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { getOwnerOAuthClient } from './helpers';
import { sanitizeSubdomainCandidate, buildSubdomainSuggestions } from './hosting-subdomain.utils';

const HOSTING_API = 'https://firebasehosting.googleapis.com/v1beta1';

interface HostingErrorBody {
  error?: { message?: string; code?: number };
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
export const checkSubdomainAvailability = onCall<{ candidate: string }>(
  { cors: true, invoker: 'public' },
  async (request) => {
    if (!request.auth || !isPlatformAdmin(request.auth?.token)) {
      throw new HttpsError('permission-denied', 'Only platform admins can check subdomains.');
    }
    const sanitized = sanitizeSubdomainCandidate(String(request.data?.candidate || ''));
    if (!sanitized) {
      return { available: false, sanitized: '', suggestions: [] };
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

/**
 * updateStoreSubdomain — personaliza la URL gratuita de la tienda sin downtime:
 * 1) valida disponibilidad, 2) crea el nuevo sitio, 3) clona el último release activo del
 * sitio anterior (misma versión) para responder de inmediato, 4) actualiza el doc de la
 * tienda y 5) elimina el sitio anterior preservando cuota de 36 sitios por proyecto.
 */
export const updateStoreSubdomain = onCall<{ storeId: string; newSubdomain: string }>(
  { timeoutSeconds: 120, cors: true, invoker: 'public' },
  async (request) => {
    if (!request.auth || !isPlatformAdmin(request.auth?.token)) {
      throw new HttpsError('permission-denied', 'Only platform admins can update subdomains.');
    }
    const { storeId, newSubdomain } = request.data;
    if (!storeId || !/^[a-zA-Z0-9_-]{1,120}$/.test(storeId)) {
      throw new HttpsError('invalid-argument', 'Invalid storeId.');
    }
    const sanitized = sanitizeSubdomainCandidate(String(newSubdomain || ''));
    if (!sanitized) {
      throw new HttpsError('invalid-argument', 'Subdominio inválido (4–30 caracteres a-z0-9-).');
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');
    const store = storeSnap.data() as Record<string, unknown>;
    const projectId = String(store['runtimeProjectId'] || store['firebaseProjectId'] || '').trim();
    const oldSiteId = String(store['runtimeSiteId'] || store['siteId'] || `vtx-${storeId}`).trim();
    if (!projectId) {
      throw new HttpsError('failed-precondition', 'La tienda no tiene proyecto de Hosting.');
    }
    if (oldSiteId === sanitized) {
      return { success: true, subdomain: sanitized, alreadyCurrent: true };
    }

    const auth = await getOwnerOAuthClient();
    const token = (await auth.getAccessToken()).token;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const newSiteUrl = `${HOSTING_API}/projects/${projectId}/sites/${encodeURIComponent(sanitized)}`;

    try {
      // 0) disponibilidad estricta
      if (await siteExists(projectId, sanitized)) {
        throw new HttpsError(
          'already-exists',
          'El subdominio ya está en uso. Elegí una de las sugerencias.',
        );
      }
      // 1) crear nuevo sitio
      const createRes = await fetch(newSiteUrl, { method: 'PUT', headers });
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => ({}))) as HostingErrorBody;
        throw new Error(`sites.create falló: ${body?.error?.message || createRes.status}`);
      }

      // 2) clonar release: última versión del sitio anterior
      let versionName = '';
      const releasesUrl = `${HOSTING_API}/projects/${projectId}/sites/${encodeURIComponent(
        oldSiteId,
      )}/releases?pageSize=1`;
      const relRes = await fetch(releasesUrl, { headers });
      if (relRes.ok) {
        const relBody = (await relRes.json()) as {
          releases?: Array<{ version?: { name?: string } }>;
        };
        versionName = relBody.releases?.[0]?.version?.name || '';
      }
      if (versionName) {
        const releaseCreate = `${HOSTING_API}/projects/${projectId}/sites/${encodeURIComponent(
          sanitized,
        )}/releases?versionName=${encodeURIComponent(versionName)}`;
        await fetch(releaseCreate, { method: 'POST', headers });
      }

      // 3) actualizar doc atómicamente
      await storeRef.update({
        runtimeSiteId: sanitized,
        siteId: sanitized,
        subdomain: sanitized,
        defaultUrl: `https://${sanitized}.web.app`,
        subdomainUpdatedAt: new Date(),
        subdomainOldSite: oldSiteId,
      });

      // 4) eliminar sitio anterior (preserva cuota de 36 sitios)
      const oldSiteUrl = `${HOSTING_API}/projects/${projectId}/sites/${encodeURIComponent(oldSiteId)}`;
      const delRes = await fetch(oldSiteUrl, { method: 'DELETE', headers });
      if (!delRes.ok && delRes.status !== 404) {
        logger.warn(`[Subdomain] No se pudo borrar sitio viejo ${oldSiteId}: ${delRes.status}`);
      }

      logger.info(
        `[Subdomain] Tienda ${storeId}: ${oldSiteId} → ${sanitized} (proyecto ${projectId})`,
      );
      return { success: true, subdomain: sanitized, url: `https://${sanitized}.web.app` };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Subdomain] Error cambiando subdominio de ${storeId}:`, err);
      throw new HttpsError('internal', `No se pudo cambiar el subdominio: ${msg.slice(0, 300)}`);
    }
  },
);
