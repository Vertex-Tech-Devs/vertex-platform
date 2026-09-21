import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import {
  getOwnerOAuthClient,
  getPlatformServiceAccountOAuthClient,
  PLATFORM_PROJECT,
  ALLOWED_ORIGINS,
} from './helpers';
import { resolvePlatformEnvironment } from './runtime';
import { ensureAuthorizedDomain } from './hosting-auth.utils';
import {
  buildSubdomainSuggestions,
  normalizeFreeSubdomain,
  RESERVED_SUBDOMAINS,
} from './hosting-subdomain.utils';

const HOSTING_API = 'https://firebasehosting.googleapis.com/v1beta1';

/**
 * Auth para operaciones de Hosting: usamos el pool de owners (es el que crea sitios
 * en los shards hoy, vía provisioning) y caemos a la Service Account de plataforma
 * si el pool no está disponible.
 */
async function getHostingAuth() {
  try {
    return await getOwnerOAuthClient();
  } catch {
    return await getPlatformServiceAccountOAuthClient();
  }
}

/**
 * Proyecto sobre el que validamos disponibilidad cuando aún no hay shard
 * (creación de tienda): usamos un shard del entorno actual y, si no hay,
 * el proyecto master del storefront correspondiente.
 */
async function resolveProbeProject(
  db: FirebaseFirestore.Firestore,
  storeId?: string,
): Promise<string> {
  if (storeId) {
    const snap = await db.collection('stores').doc(storeId).get();
    const data = (snap.data() || {}) as Record<string, unknown>;
    let target = String(
      data['gcpProjectId'] || data['runtimeProjectId'] || data['firebaseProjectId'] || '',
    ).trim();
    if (!target && data['shardId']) {
      const shard = await db.collection('infrastructure_shards').doc(String(data['shardId'])).get();
      target = String(shard.data()?.['gcpProjectId'] || shard.data()?.['projectId'] || '').trim();
    }
    if (target) return target;
  }
  const env = resolvePlatformEnvironment(PLATFORM_PROJECT);
  const shardsSnap = await db
    .collection('infrastructure_shards')
    .where('environment', '==', env)
    .where('status', 'in', ['WARMUP_READY', 'ACTIVE'])
    .limit(5)
    .get();
  for (const doc of shardsSnap.docs) {
    const project = String(doc.data()['gcpProjectId'] || doc.data()['projectId'] || doc.id).trim();
    if (project) return project;
  }
  return env === 'production' ? 'ecommerce-vertex' : 'ecommerce-vertex-dev';
}

/** Cache corto del probe de disponibilidad (crear-y-borrar) para no spamear la API. */
const PROBE_TTL_MS = 5 * 60_000;
const probeCache = new Map<
  string,
  { free: boolean; reason?: string; message?: string; at: number }
>();

/**
 * Probe autoritativo de disponibilidad de un SITE_ID de Hosting.
 * Los `.web.app` son únicos GLOBALMENTE y no hay API de consulta global: se valida
 * con `validateOnly=true` (sin crear el sitio). El resultado se cachea 5 minutos.
 */
async function probeSiteAvailability(
  project: string,
  candidate: string,
): Promise<{ free: boolean; reason?: string; message?: string }> {
  const cacheKey = `${project}:${candidate}`;
  const cached = probeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PROBE_TTL_MS) {
    return { free: cached.free, reason: cached.reason, message: cached.message };
  }
  const authClient = await getHostingAuth();
  const token = (await authClient.getAccessToken()).token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const sitesUrl = `${HOSTING_API}/projects/${project}/sites`;
  let probeRes: Response;
  try {
    // validateOnly=true: Firebase valida el nombre SIN crear el sitio (evita efectos
    // secundarios y cuota). Es exactamente el check que hace `firebase hosting:sites:create`.
    probeRes = await fetch(
      `${sitesUrl}?siteId=${encodeURIComponent(candidate)}&validateOnly=true`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'USER_SITE' }),
      },
    );
  } catch (err) {
    const message = `No pudimos verificar la disponibilidad ahora mismo (${err instanceof Error ? err.message : 'red'}). Reintentá en unos segundos.`;
    probeCache.set(cacheKey, { free: false, reason: 'CHECK_UNAVAILABLE', message, at: Date.now() });
    return { free: false, reason: 'CHECK_UNAVAILABLE', message };
  }
  let result: { free: boolean; reason?: string; message?: string };
  if (probeRes.ok) {
    result = { free: true, reason: 'AVAILABLE' };
  } else {
    const body = (await probeRes.json().catch(() => ({}))) as HostingErrorBody;
    const detail = String(body?.error?.message || '');
    // Hosting responde 400 FAILED_PRECONDITION con "reserved by another project"
    // cuando el SITE_ID pertenece a otro proyecto de Firebase (único globalmente).
    const reserved = /reserved by another project/i.test(detail);
    if (reserved) {
      result = {
        free: false,
        reason: 'RESERVED_BY_FIREBASE',
        message:
          'El nombre está tomado a nivel global de Firebase: los IDs `.web.app` son únicos en todo Firebase y quedan reservados por otro proyecto aunque su sitio esté vacío. Probá una de las sugerencias o vinculá tu propio dominio.',
      };
    } else if (probeRes.status === 409) {
      result = {
        free: false,
        reason: 'TAKEN',
        message: 'Ese nombre ya está en uso. Probá una de las sugerencias.',
      };
    } else {
      result = {
        free: false,
        reason: 'CHECK_UNAVAILABLE',
        message: `No pudimos verificar la disponibilidad ahora mismo (HTTP ${probeRes.status}${
          detail ? `: ${detail}` : ''
        }). Reintentá en unos segundos.`,
      };
    }
  }
  probeCache.set(cacheKey, { ...result, at: Date.now() });
  return result;
}

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
  const auth = await getHostingAuth();
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
 * Consulta Hosting (sites.get) y, de forma AUTORITATIVA, hace un probe crear-y-borrar
 * en el shard de la tienda (o el proyecto master durante la creación) porque los
 * SITE_ID son únicos globalmente y no existe API de consulta global.
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

    // Colisión/probe en el shard destino (Hosting es único por proyecto).
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
        if (targetProject) {
          const probe = await probeSiteAvailability(targetProject, sanitized);
          if (!probe.free) {
            return {
              available: false,
              sanitized,
              reason: probe.reason || 'RESERVED_BY_FIREBASE',
              message: probe.message,
              suggestions: buildSubdomainSuggestions(sanitized),
            };
          }
        }
      } catch (err) {
        logger.warn('[Subdomain] Chequeo de colisión en shard falló:', err);
      }
    } else {
      // Creación de tienda (aún sin shard): validamos contra un shard del entorno
      // (o el master del storefront) usando la Service Account de plataforma, que
      // sí tiene permiso sobre esos proyectos.
      try {
        const probeProject = await resolveProbeProject(db);
        const probe = await probeSiteAvailability(probeProject, sanitized);
        if (!probe.free) {
          return {
            available: false,
            sanitized,
            reason: probe.reason || 'RESERVED_BY_FIREBASE',
            message: probe.message,
            suggestions: buildSubdomainSuggestions(sanitized),
          };
        }
      } catch (err) {
        logger.warn('[Subdomain] Probe de disponibilidad (master) falló:', err);
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

    const auth = await getHostingAuth();
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
        // Hosting devuelve 400 FAILED_PRECONDITION con "reserved by another project"
        // cuando el SITE_ID pertenece a otro proyecto de Firebase (único globalmente).
        if (/reserved by another project/i.test(detail)) {
          throw new HttpsError(
            'already-exists',
            `El nombre “${sanitized}” está reservado por otro proyecto de Firebase (los IDs .web.app son únicos en todo Firebase). Probá una de las sugerencias o vinculá tu propio dominio.`,
          );
        }
        if (createRes.status === 403 || createRes.status === 401) {
          throw new HttpsError(
            'permission-denied',
            'No tenemos permisos de Hosting sobre este proyecto. Revisá la configuración de infraestructura o reintentá.',
          );
        }
        throw new HttpsError(
          'unavailable',
          `No pudimos crear el sitio en Firebase Hosting (HTTP ${createRes.status}${
            detail ? `: ${detail}` : ''
          }). Reintentá en unos segundos.`,
        );
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
      // versions:clone es una OPERACIÓN LARGA (Operation). Hay que esperarla y leer la
      // versión resultante de `response.name`; si no, caemos a listar las versiones del sitio.
      const cloneOp = (await cloneRes.json().catch(() => ({}))) as { name?: string };
      const resolveClonedVersion = async (): Promise<string> => {
        const opName = String(cloneOp?.name || '').trim();
        if (opName) {
          for (let attempt = 0; attempt < 20; attempt++) {
            const opRes = await fetch(`${HOSTING_API}/${opName}`, { headers });
            if (opRes.ok) {
              const op = (await opRes.json()) as {
                done?: boolean;
                response?: { name?: string; version?: { name?: string } };
              };
              if (op.done) {
                const name = op.response?.name || op.response?.version?.name;
                if (name) return String(name);
                break;
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
        const versionsRes = await fetch(
          `${HOSTING_API}/${parent}/sites/${encodeURIComponent(sanitized)}/versions?pageSize=10`,
          { headers },
        );
        if (versionsRes.ok) {
          const versionsBody = (await versionsRes.json()) as {
            versions?: Array<{ name?: string; status?: string }>;
          };
          const candidates = versionsBody.versions || [];
          const finalized =
            candidates.find((v) => String(v.status || '').toUpperCase() === 'FINALIZED') ||
            candidates[0];
          if (finalized?.name) return String(finalized.name);
        }
        return '';
      };
      const clonedVersion = await resolveClonedVersion();
      if (!clonedVersion) {
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
        throw new HttpsError(
          'failed-precondition',
          `No se pudo publicar la versión clonada en ${sanitized}.web.app (${releaseRes.status}). Reintentá en unos segundos. ${
            body?.error?.message || ''
          }`.trim(),
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
        throw new HttpsError(
          'failed-precondition',
          `El sitio ${sanitized}.web.app no respondió 200 tras publicar (la propagación puede tardar). Se mantiene la dirección anterior; reintentá en un minuto.`,
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

/**
 * grantExtraDomains — habilita sitios/dominios EXTRA para una tienda (add-on pago).
 * Cada sitio `.web.app` extra consume 1 de los 36 cupos del shard, por eso se
 * comercializa aparte. Sólo superadmins de plataforma pueden otorgarlo/revocarlo.
 */
export const grantExtraDomains = onCall<{ storeId: string; count: number }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth || !isPlatformAdmin(request.auth?.token)) {
      throw new HttpsError('permission-denied', 'Solo superadmins pueden otorgar dominios extra.');
    }
    const storeId = String(request.data?.storeId || '').trim();
    if (!storeId || !/^[a-zA-Z0-9_-]{1,120}$/.test(storeId)) {
      throw new HttpsError('invalid-argument', 'Invalid storeId.');
    }
    const count = Math.min(Math.max(Number(request.data?.count) || 0, 0), 10);
    await getFirestore()
      .collection('stores')
      .doc(storeId)
      .set({ extraDomainsEntitlement: count, updatedAt: new Date() }, { merge: true });
    logger.info(`[Subdomain] Tienda ${storeId}: dominios extra habilitados = ${count}`);
    return { success: true, storeId, extraDomainsEntitlement: count };
  },
);
