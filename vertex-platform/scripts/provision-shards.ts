#!/usr/bin/env node
/**
 * provision-shards.ts — Expande el pool de shards multi-tenant.
 *
 * Crea N shards nuevos (proyectos GCP vtx-sd-*) totalmente configurados:
 *   proyecto + facturación + Firebase + APIs + Firestore NATIVO + Storage/CORS
 *   + web app/config + Identity Platform + Google IdP (clientId del master)
 *   + authorizedDomains + rules del storefront + índices compuestos
 *   + registro en infrastructure_shards (WARMUP_READY).
 *
 * Uso:
 *   npx tsx scripts/provision-shards.ts --count 10 --env dev      # crea 10 más
 *   npx tsx scripts/provision-shards.ts --target 10 --env dev     # crea los que falten hasta 10 totales
 *   npx tsx scripts/provision-shards.ts --count 10 --env prod
 *
 * --target N   Calcula cuántos crear para que el pool total (WARMUP_READY +
 *              WARMUP_PROVISIONING + ACTIVE con cupo) quede en ≥ N.
 * --count N    Crea exactamente N shards nuevos (comportamiento previo).
 * --verify     Al final, verifica vía accounts.google.com si los redirect URIs
 *              de los shards nuevos ya están registrados en el client OAuth master.
 *
 * El ÚNICO paso manual (Google no expone API): registrar en Google Cloud Console
 * el redirect URI de cada shard nuevo en el client OAuth del master. El script
 * imprime la lista de URIs al final, lista para copiar/pegar.
 *
 * Requiere un ADC con permisos de owner/editor sobre el entorno destino.
 * El vínculo de facturación en proyectos NUEVOS puede requerir una cuenta con
 * permisos billing (los shards del scheduler se crean con la SA del platform).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Reglas de seguridad reales de la plataforma (evita drift con el repo y garantiza
// aislamiento multi-tenant en cada shard nuevo; el archivo local no se usa).
import {
  STOREFRONT_FIRESTORE_RULES,
  STOREFRONT_STORAGE_RULES,
} from '../functions/src/storefront-rules';

// ─────────────────────────────── CLI ───────────────────────────────

interface Options {
  count: number;
  target: number | null;
  env: 'dev' | 'prod';
  verify: boolean;
  masterStorefrontProject: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (flag: string): string => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : '';
  };
  const count = Number(get('--count') || '0');
  const targetRaw = get('--target');
  const target = targetRaw ? Number(targetRaw) : null;
  const envRaw = get('--env');
  const env = (envRaw || 'dev') as Options['env'];
  const verify = args.includes('--verify');

  if (envRaw && envRaw !== 'dev' && envRaw !== 'prod') {
    throw new Error(`--env debe ser 'dev' o 'prod' (recibido: '${envRaw}').`);
  }

  if (target !== null && (target < 1 || target > 60)) {
    throw new Error('--target debe estar entre 1 y 60');
  }
  if (count !== 0 && (count < 1 || count > 30)) {
    throw new Error('--count debe estar entre 1 y 30');
  }
  if (count === 0 && target === null) {
    throw new Error('Indicá --count N (crear N) o --target N (alcanzar N totales).');
  }

  return {
    count,
    target,
    env,
    verify,
    masterStorefrontProject: env === 'prod' ? 'ecommerce-vertex' : 'ecommerce-vertex-dev',
  };
}

const opts = parseArgs();
const platformProject = opts.env === 'prod' ? 'vertex-platform-app' : 'vertex-platform-dev';
const FIREBASE_URL = 'https://firebase.googleapis.com/v1beta1';
const CRM_URL = 'https://cloudresourcemanager.googleapis.com/v3';
const SERVICEUSAGE_URL = 'https://serviceusage.googleapis.com/v1';
const FIRESTORE_URL = 'https://firestore.googleapis.com/v1';
const STORAGE_URL = 'https://storage.googleapis.com/storage/v1';
const FIREBASERULES_URL = 'https://firebaserules.googleapis.com/v1';
const IDTOOLKIT_URL = 'https://identitytoolkit.googleapis.com';
const APIKEYS_URL = 'https://apikeys.googleapis.com/v2';
const BILLING_URL = 'https://cloudbilling.googleapis.com/v1';

const MASTER_CLIENT_ID = '988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com';

// ─────────────────────────── Auth (ADC directo) ───────────────────────────// Se usa fetch directo con las credenciales de ADC en vez de google-auth-library
// (el transporte de esa librería falla en algunos entornos al refrescar el token).

async function getToken(): Promise<string> {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(os.homedir(), '.config/gcloud/application_default_credentials.json'),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw.type === 'authorized_user' && raw.refresh_token) {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: raw.client_id,
        client_secret: raw.client_secret,
        refresh_token: raw.refresh_token,
      });
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!res.ok) {
        throw new Error(
          `Token refresh failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) throw new Error('Token response without access_token.');
      return data.access_token;
    }
    if (raw.type === 'service_account' && raw.private_key) {
      // JWT grant para service accounts (scheduler/local con SA).
      const { private_key, client_email } = raw;
      const header = { alg: 'RS256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      };
      const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const crypto = await import('crypto');
      const sign = crypto.default
        ? crypto.default.sign
        : (crypto as unknown as { sign: typeof crypto.sign }).sign;
      const sig = sign('sha256', Buffer.from(`${b64(header)}.${b64(claim)}`), private_key);
      const assertion = `${b64(header)}.${b64(claim)}.${sig.toString('base64url')}`;
      const params = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      });
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!res.ok) {
        throw new Error(
          `SA token refresh failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) throw new Error('SA token response without access_token.');
      return data.access_token;
    }
  }
  throw new Error(
    'No se encontraron Application Default Credentials. Corré "gcloud auth application-default login" o seteá GOOGLE_APPLICATION_CREDENTIALS.',
  );
}

// ─────────────────────────────── API helpers ───────────────────────────────

class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, url: string) {
    super(`${url} -> ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

async function api(
  token: string,
  url: string,
  method: string,
  body?: unknown,
  quota?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (quota) headers['x-goog-user-project'] = quota;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 409 || text.includes('already exists')) {
      return { _exists: true };
    }
    throw new ApiError(res.status, text, url);
  }
  if (res.status === 204) return { ok: true };
  return res.json();
}

async function poll(token: string, opName: string, base: string): Promise<void> {
  const url = opName.startsWith('http') ? opName : `${base}/${opName}`;
  for (let i = 0; i < 40; i++) {
    const res = await api(token, url, 'GET');
    if (res.done) {
      if (res.error) {
        throw new Error(`LRO fallida: ${res.error.message || JSON.stringify(res.error)}`);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Operation timed out: ${opName}`);
}

function isQuotaError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return msg.includes('quota') || msg.includes('project count') || msg.includes('exceeded');
}

/**
 * ¿El proyecto ya existe en GCP? 200 = existe (visible), 403 = existe pero sin
 * visibilidad (creado por SA). 404 = libre. Nunca se adoptan proyectos huérfanos
 * a medio provisionar: si el ID colisiona, se regenera.
 */
async function projectExists(token: string, projectId: string): Promise<boolean> {
  const res = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-user-project': platformProject,
    },
  });
  return res.status === 200 || res.status === 403;
}

// ─────────────────────── Estado actual del pool ───────────────────────

interface PoolState {
  total: number;
  ready: number;
  provisioning: number;
  active: number;
  projectIds: Set<string>;
}

async function getPoolState(token: string): Promise<PoolState> {
  const envValue = opts.env === 'prod' ? 'production' : 'development';
  const url = `${FIRESTORE_URL}/projects/${platformProject}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': platformProject,
    },
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId: 'infrastructure_shards' }], limit: 500 },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `No se pudo leer infrastructure_shards de ${platformProject}: ${await res.text()}`,
    );
  }
  const docs = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, any> };
  }>;
  const state: PoolState = {
    total: 0,
    ready: 0,
    provisioning: 0,
    active: 0,
    projectIds: new Set(),
  };
  for (const d of docs) {
    const f = d.document?.fields;
    if (!f) continue;
    if ((f['environment']?.stringValue ?? '') !== envValue) continue;
    const status = f['status']?.stringValue ?? '';
    const projectId = f['projectId']?.stringValue ?? '';
    const current = Number(
      f['currentStores']?.integerValue ?? f['currentStores']?.doubleValue ?? 0,
    );
    const maxCap = Number(f['maxCapacity']?.integerValue ?? f['maxCapacity']?.doubleValue ?? 35);
    if (status === 'WARMUP_READY') {
      state.ready++;
      state.total++;
      if (projectId) state.projectIds.add(projectId);
    } else if (status === 'WARMUP_PROVISIONING') {
      state.provisioning++;
      state.total++;
      if (projectId) state.projectIds.add(projectId);
    } else if (status === 'ACTIVE' && current < maxCap) {
      state.active++;
      state.total++;
      if (projectId) state.projectIds.add(projectId);
    }
  }
  return state;
}

// ─────────────────────────── Provisioning ───────────────────────────

async function provisionShard(token: string, projectId: string): Promise<{ redirectUri: string }> {
  const randomId = projectId.replace('vtx-sd-', '');
  console.log(`\n▶ Provisionando shard ${projectId}...`);

  // 1. Proyecto GCP
  const op = await api(
    token,
    `${CRM_URL}/projects`,
    'POST',
    {
      projectId,
      displayName: `Vertex Shard ${randomId}`,
    },
    platformProject,
  );
  if (op._exists) {
    // No adoptar proyectos existentes: pueden ser huérfanos a medio provisionar.
    throw new Error(`proyecto ${projectId} ya existe en GCP (probable huérfano) — no se adopta`);
  } else if (op.name) {
    await poll(token, op.name, CRM_URL);
    console.log('  ✅ proyecto creado');
  }

  // 2. Vincular facturación (puede fallar con ADC personal → warning no fatal)
  try {
    const billingList = await api(
      token,
      `${BILLING_URL}/billingAccounts`,
      'GET',
      undefined,
      platformProject,
    );
    const account =
      (billingList.billingAccounts || []).find((b: any) => b.open === true) ||
      (billingList.billingAccounts || [])[0];
    if (account) {
      await api(
        token,
        `${BILLING_URL}/projects/${projectId}/billingInfo`,
        'PUT',
        { billingAccountName: account.name },
        platformProject,
      );
      console.log(`  ✅ facturación vinculada (${account.name})`);
    } else {
      console.warn(
        '  ⚠️ sin cuenta de billing accesible — el shard puede quedar en Spark (sin Cloud Functions)',
      );
    }
  } catch (err: any) {
    console.warn(
      `  ⚠️ billing (no fatal, requiere SA del platform): ${String(err?.message || '').slice(0, 160)}`,
    );
  }

  // 3. Firebase
  try {
    const fb = await api(
      token,
      `${FIREBASE_URL}/projects/${projectId}:addFirebase`,
      'POST',
      {},
      platformProject,
    );
    if (fb.name) await poll(token, fb.name, FIREBASE_URL);
    console.log('  ✅ Firebase activado');
  } catch (err: any) {
    if (!String(err?.message || '').includes('already')) throw err;
  }

  // 3b. Habilitar APIs (sin appengine para no crear Datastore)
  const apis = [
    'identitytoolkit.googleapis.com',
    'firestore.googleapis.com',
    'firebasehosting.googleapis.com',
    'secretmanager.googleapis.com',
    'cloudresourcemanager.googleapis.com',
    'storage.googleapis.com',
    'firebasestorage.googleapis.com',
  ];
  try {
    const e = await api(
      token,
      `${SERVICEUSAGE_URL}/projects/${projectId}/services:batchEnable`,
      'POST',
      { serviceIds: apis },
      platformProject,
    );
    if (e.name) await poll(token, e.name, SERVICEUSAGE_URL);
    console.log('  ✅ APIs habilitadas');
  } catch (err: any) {
    console.warn(`  ⚠️ batchEnable: ${String(err?.message || '').slice(0, 160)}`);
  }

  // 4. Firestore nativo (si no existe)
  try {
    const db = await api(
      token,
      `${FIRESTORE_URL}/projects/${projectId}/databases?databaseId=(default)`,
      'POST',
      { type: 'FIRESTORE_NATIVE', locationId: 'nam5' },
      projectId,
    );
    if (db.name) await poll(token, db.name, FIRESTORE_URL);
    console.log('  ✅ Firestore nativo');
  } catch (err: any) {
    if (
      !String(err?.message || '').includes('409') &&
      !String(err?.message || '').includes('already')
    )
      throw err;
  }

  // 5. Storage bucket default + CORS
  try {
    const buckets = await api(token, `${STORAGE_URL}/b?project=${projectId}`, 'GET');
    const hasBucket = (buckets.items || []).some(
      (b: any) => b.name === `${projectId}.firebasestorage.app`,
    );
    if (!hasBucket) {
      await api(
        token,
        `${STORAGE_URL}/b?project=${projectId}`,
        'POST',
        { name: `${projectId}.firebasestorage.app` },
        projectId,
      );
    }
    await api(
      token,
      `${STORAGE_URL}/b/${projectId}.firebasestorage.app`,
      'PATCH',
      {
        cors: [
          {
            origin: ['*'],
            method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            responseHeader: [
              'Content-Type',
              'Authorization',
              'Content-Length',
              'x-firebase-storage-version',
              'x-goog-resumable',
            ],
            maxAgeSeconds: 3600,
          },
        ],
      },
      projectId,
    );
    console.log('  ✅ Storage + CORS');
  } catch (err: any) {
    console.warn(`  ⚠️ storage: ${String(err?.message || '').slice(0, 160)}`);
  }

  // 6. Web app + config
  let appId = '';
  try {
    const apps = await api(
      token,
      `${FIREBASE_URL}/projects/${projectId}/webApps`,
      'GET',
      undefined,
      projectId,
    );
    const existing = (apps.apps || [])[0];
    if (existing) {
      appId = existing.appId;
    } else {
      const wa = await api(
        token,
        `${FIREBASE_URL}/projects/${projectId}/webApps`,
        'POST',
        { displayName: `Storefront ${randomId}` },
        projectId,
      );
      if (wa.name) await poll(token, wa.name, FIREBASE_URL);
      const list = await api(
        token,
        `${FIREBASE_URL}/projects/${projectId}/webApps`,
        'GET',
        undefined,
        projectId,
      );
      appId = (list.apps || [])[0]?.appId || '';
    }
    console.log(`  ✅ web app ${appId ? 'lista' : ''}`);
  } catch (err: any) {
    console.warn(`  ⚠️ webApp: ${String(err?.message || '').slice(0, 160)}`);
  }

  // 7. Identity Platform
  try {
    await api(
      token,
      `${IDTOOLKIT_URL}/v2/projects/${projectId}/identityPlatform:initializeAuth`,
      'POST',
      {},
      projectId,
    );
    console.log('  ✅ Identity Platform');
  } catch (err: any) {
    console.warn(`  ⚠️ initializeAuth: ${String(err?.message || '').slice(0, 120)}`);
  }

  // 8. Google IdP (clientId/secret del master)
  try {
    const masterIdp = await api(
      token,
      `${IDTOOLKIT_URL}/v2/projects/${opts.masterStorefrontProject}/defaultSupportedIdpConfigs/google.com`,
      'GET',
      undefined,
      opts.masterStorefrontProject,
    );
    if (masterIdp.clientId && masterIdp.clientSecret) {
      await api(
        token,
        `${IDTOOLKIT_URL}/v2/projects/${projectId}/defaultSupportedIdpConfigs?idpId=google.com`,
        'POST',
        {
          name: `projects/${projectId}/defaultSupportedIdpConfigs/google.com`,
          enabled: true,
          clientId: masterIdp.clientId,
          clientSecret: masterIdp.clientSecret,
        },
        projectId,
      );
      console.log('  ✅ Google IdP configurado (clientId del master)');
    }
  } catch (err: any) {
    console.warn(`  ⚠️ IdP: ${String(err?.message || '').slice(0, 160)}`);
  }

  // 9. authorizedDomains
  try {
    const cfg = await api(
      token,
      `${IDTOOLKIT_URL}/v2/projects/${projectId}/config`,
      'GET',
      undefined,
      projectId,
    );
    const domains = Array.from(
      new Set([
        ...(cfg.authorizedDomains || []),
        'localhost',
        '127.0.0.1',
        `${projectId}.firebaseapp.com`,
        `${projectId}.web.app`,
      ]),
    );
    await api(
      token,
      `${IDTOOLKIT_URL}/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
      'PATCH',
      { authorizedDomains: domains },
      projectId,
    );
    console.log('  ✅ authorizedDomains');
  } catch (err: any) {
    console.warn(`  ⚠️ domains: ${String(err?.message || '').slice(0, 120)}`);
  }

  // 10. Rules del storefront (cloud.firestore + firebase.storage)
  try {
    const deployRuleset = async (
      fileName: string,
      content: string,
      releaseId: string,
    ): Promise<void> => {
      const rs = await api(
        token,
        `${FIREBASERULES_URL}/projects/${projectId}/rulesets`,
        'POST',
        { source: { files: [{ name: fileName, content }] } },
        projectId,
      );
      if (rs.name) {
        try {
          await api(
            token,
            `${FIREBASERULES_URL}/projects/${projectId}/releases/${releaseId}`,
            'DELETE',
            undefined,
            projectId,
          );
        } catch {
          // 404 = no existía, ok
        }
        try {
          await api(
            token,
            `${FIREBASERULES_URL}/projects/${projectId}/releases`,
            'POST',
            { name: `projects/${projectId}/releases/${releaseId}`, rulesetName: rs.name },
            projectId,
          );
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (!msg.includes('already exists') && !msg.includes('409')) throw err;
        }
      }
    };
    await deployRuleset('firestore.rules', STOREFRONT_FIRESTORE_RULES, 'cloud.firestore');
    await deployRuleset('storage.rules', STOREFRONT_STORAGE_RULES, 'firebase.storage');
    console.log('  ✅ rules desplegadas (firestore + storage)');
  } catch (err: any) {
    console.warn(`  ⚠️ rules: ${String(err?.message || '').slice(0, 200)}`);
  }

  // 11. API key: limpiar restricciones (dominios multi-tenant)
  try {
    const projInfo = await api(token, `${CRM_URL}/projects/${projectId}`, 'GET');
    const num = projInfo.projectNumber;
    if (num) {
      const keys = await api(
        token,
        `${APIKEYS_URL}/projects/${num}/locations/global/keys`,
        'GET',
        undefined,
        projectId,
      );
      for (const k of keys.keys || []) {
        if (k.restrictions && Object.keys(k.restrictions).length > 0) {
          await api(
            token,
            `${APIKEYS_URL}/${k.name}?updateMask=restrictions`,
            'PATCH',
            { restrictions: {} },
            projectId,
          );
        }
      }
    }
    console.log('  ✅ API keys sin restricciones');
  } catch (err: any) {
    console.warn(`  ⚠️ api keys: ${String(err?.message || '').slice(0, 120)}`);
  }

  return { redirectUri: `https://${projectId}.firebaseapp.com/__/auth/handler` };
}

async function registerShardDoc(token: string, projectId: string): Promise<void> {
  // El platform filtra por resolvePlatformEnvironment(): 'development' | 'production'.
  const envValue = opts.env === 'prod' ? 'production' : 'development';
  const shardId = `shard-${envValue}-${projectId.replace('vtx-sd-', '')}`;
  const docUrl = `${FIRESTORE_URL}/projects/${platformProject}/databases/(default)/documents/infrastructure_shards/${shardId}`;
  const body = {
    fields: {
      id: { stringValue: shardId },
      environment: { stringValue: envValue },
      runtimeMode: { stringValue: 'shared-shard' },
      projectId: { stringValue: projectId },
      siteId: { stringValue: 'default' },
      region: { stringValue: 'us-central1' },
      status: { stringValue: 'WARMUP_READY' },
      maxCapacity: { integerValue: 35 },
      currentStores: { integerValue: 0 },
      reservedStores: { integerValue: 0 },
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  };
  await api(token, docUrl, 'PATCH', body, platformProject);
  console.log(`  ✅ registrado en infrastructure_shards (${shardId})`);
}

// ─────────────────── Verificación de redirect URIs ───────────────────

async function verifyRedirectUri(clientId: string, redirectUri: string): Promise<boolean> {
  try {
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=openid%20email%20profile&prompt=select_account`;
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const location = res.headers.get('location') ?? '';
    // Éxito → redirige EXACTAMENTE al redirect_uri registrado (con ?code=...).
    // Falla → /signin/oauth/error, error=, o cualquier otra página intermedia.
    return location.startsWith(redirectUri);
  } catch {
    return false;
  }
}

// ─────────────────────────────── main ───────────────────────────────

async function main(): Promise<void> {
  const token = await getToken();

  console.log(`=== Pool de shards (${opts.env}) → ${platformProject} ===`);
  const pool = await getPoolState(token);
  console.log(
    `  total disponibles: ${pool.total} (WARMUP_READY=${pool.ready}, WARMUP_PROVISIONING=${pool.provisioning}, ACTIVE con cupo=${pool.active})`,
  );

  const toCreate = opts.target !== null ? Math.max(0, opts.target - pool.total) : opts.count;

  if (toCreate === 0) {
    console.log(`Ya se alcanzó el objetivo (${opts.target}) — no hay nada que crear.`);
    return;
  }
  if (opts.target !== null) {
    console.log(`  objetivo: ${opts.target} → creando ${toCreate} shard(s) nuevo(s)`);
  } else {
    console.log(`  creando ${toCreate} shard(s) nuevo(s) (--count)`);
  }

  const redirects: string[] = [];
  const created: string[] = [];
  let consecutiveFailures = 0;
  let i = 0;
  while (created.length < toCreate) {
    i++;
    // Buscar un projectId libre: ni en el pool registrado ni existente en GCP
    // (los huérfanos a medio provisionar NO se adoptan — se regeneran).
    let projectId = '';
    for (let tries = 0; tries < 8; tries++) {
      const randomId = Math.random().toString(36).substring(2, 10);
      const candidate = `vtx-sd-${randomId}`;
      if (pool.projectIds.has(candidate)) continue;
      if (await projectExists(token, candidate)) continue;
      projectId = candidate;
      break;
    }
    if (!projectId) {
      console.error(
        '  ❌ No se pudo generar un projectId libre (¿cuota o muchos huérfanos?). Abortando.',
      );
      break;
    }

    try {
      const { redirectUri } = await provisionShard(token, projectId);
      await registerShardDoc(token, projectId);
      redirects.push(redirectUri);
      created.push(projectId);
      consecutiveFailures = 0;
      console.log(`  ✔ ${projectId} listo (${created.length}/${toCreate})`);
    } catch (err: any) {
      consecutiveFailures++;
      const quota = isQuotaError(err);
      console.error(
        `  ❌ fallo en ${projectId}: ${String(err?.message || err).slice(0, 220)}${quota ? ' [CUOTA DE PROYECTOS GCP]' : ''}`,
      );
      if (quota || consecutiveFailures >= 2) {
        console.warn(
          quota
            ? '  Cuota de proyectos GCP agotada: aumentala en Google Cloud Console (IAM → Cuotas → "Project Count") o probá en otro entorno. Abortando.'
            : '  2 fallos consecutivos — abortando para no contaminar el pool.',
        );
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`  creados: ${created.length}  |  pool total ahora: ${pool.total + created.length}`);
  if (created.length === 0) {
    console.log('  Nada creado. Revisá los errores de arriba.');
    return;
  }

  console.log('\n=== PASO MANUAL (único, Google no expone API) ===');
  console.log('Registrar estos redirect URIs en el client OAuth del master');
  console.log(`(project ${opts.masterStorefrontProject}, client ${MASTER_CLIENT_ID}):`);
  console.log(
    `Consola: https://console.cloud.google.com/apis/credentials?project=${opts.masterStorefrontProject}\n`,
  );
  for (const uri of redirects) {
    console.log(`  ${uri}`);
  }

  if (opts.verify) {
    console.log('\n=== VERIFICACIÓN de redirect URIs ===');
    let missing = 0;
    for (const uri of redirects) {
      const ok = await verifyRedirectUri(MASTER_CLIENT_ID, uri);
      console.log(`  ${ok ? '✅' : '❌'} ${uri}`);
      if (!ok) missing++;
    }
    if (missing > 0) {
      console.log(`\n⚠️  ${missing} URI(s) sin registrar. Agregalos en la consola (paso manual).`);
    } else {
      console.log('\n✅ Todos los redirect URIs de los shards nuevos ya están registrados.');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
