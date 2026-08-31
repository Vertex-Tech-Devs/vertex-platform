#!/usr/bin/env node
/**
 * complete-shards.ts — Recicla proyectos GCP huérfanos al pool de shards.
 *
 * Los proyectos `vtx-sd-*` que existen en GCP pero NO tienen documento en
 * `infrastructure_shards` (huérfanos, ver audit-shards.ts) consumen cuota sin
 * servir. Este script los COMPLETA (billing + APIs + Firebase + Firestore +
 * Storage/CORS + web app + Identity Platform + Google IdP + authorizedDomains
 * + rules + API keys) y los registra como `WARMUP_READY` en el pool.
 *
 * Usa las credenciales owner del platform (Secret Manager
 * `platform-owner-credentials`), las mismas que el scheduler, porque el ADC
 * personal no puede vincular billing en proyectos.
 *
 * Uso:
 *   npx tsx scripts/complete-shards.ts --env dev [--dry-run]
 *   npx tsx scripts/complete-shards.ts --env dev --project-ids vtx-sd-a,vtx-sd-b
 *   npx tsx scripts/complete-shards.ts --env prod
 *   npx tsx scripts/complete-shards.ts --backfill-billing --env dev
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  STOREFRONT_FIRESTORE_RULES,
  STOREFRONT_STORAGE_RULES,
} from '../functions/src/storefront-rules';

interface Options {
  env: 'dev' | 'prod';
  dryRun: boolean;
  projectIds: string[] | null;
  backfillBilling: boolean;
  fixRules: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (flag: string): string => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : '';
  };
  const envRaw = get('--env');
  const env = (envRaw || 'dev') as Options['env'];
  if (env !== 'dev' && env !== 'prod') {
    throw new Error(`--env debe ser 'dev' o 'prod' (recibido: '${envRaw}').`);
  }
  const idsRaw = get('--project-ids');
  return {
    env,
    dryRun: args.includes('--dry-run'),
    projectIds: idsRaw
      ? idsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null,
    backfillBilling: args.includes('--backfill-billing'),
    fixRules: args.includes('--fix-rules'),
  };
}

const opts = parseArgs();
const platformProject = opts.env === 'prod' ? 'vertex-platform-app' : 'vertex-platform-dev';
const envValue = opts.env === 'prod' ? 'production' : 'development';
const masterStorefrontProject = opts.env === 'prod' ? 'ecommerce-vertex' : 'ecommerce-vertex-dev';
const MASTER_CLIENT_ID = '988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com';
const BILLING_ACCOUNTS =
  opts.env === 'prod'
    ? [] // en prod se usa pickBillingAccount del platform (o se pasa --project-ids con la cuenta)
    : ['016AC2-299E39-51C8BF', '01D2F4-C25DF1-489AE9']; // Vertex Dev Billing 1 / 2
const FIREBASE_URL = 'https://firebase.googleapis.com/v1beta1';
const CRM_URL = 'https://cloudresourcemanager.googleapis.com/v1';
const SERVICEUSAGE_URL = 'https://serviceusage.googleapis.com/v1';
const FIRESTORE_URL = 'https://firestore.googleapis.com/v1';
const STORAGE_URL = 'https://storage.googleapis.com/storage/v1';
const FIREBASERULES_URL = 'https://firebaserules.googleapis.com/v1';
const IDTOOLKIT_URL = 'https://identitytoolkit.googleapis.com';
const APIKEYS_URL = 'https://apikeys.googleapis.com/v2';
const BILLING_URL = 'https://cloudbilling.googleapis.com/v1';
const SECRET_URL = 'https://secretmanager.googleapis.com/v1';

// ─────────────────────────── Auth ───────────────────────────

import { execSync } from 'child_process';

async function getAadcToken(): Promise<string> {
  try {
    const token = execSync('gcloud auth print-access-token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (token) return token;
  } catch {}

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
      if (!res.ok) throw new Error(`ADC token refresh failed (${res.status}).`);
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) throw new Error('No access_token.');
      return data.access_token;
    }
  }
  throw new Error('No Application Default Credentials found.');
}

async function refreshToken(
  client_id: string,
  client_secret: string,
  refresh_token: string,
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id,
    client_secret,
    refresh_token,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) throw new Error(`Owner token refresh failed (${res.status}).`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('No owner access_token.');
  return data.access_token;
}

/** Lee las credenciales owner del platform desde Secret Manager y devuelve un token. */
async function getOwnerToken(adcToken: string): Promise<string> {
  const r = await fetch(
    `${SECRET_URL}/projects/${platformProject}/secrets/platform-owner-credentials/versions/latest:access`,
    { headers: { Authorization: `Bearer ${adcToken}`, 'x-goog-user-project': platformProject } },
  );
  if (!r.ok) {
    throw new Error(
      `No se pudo leer platform-owner-credentials (${r.status}) — el ADC necesita secretAccessor.`,
    );
  }
  const j = (await r.json()) as { payload: { data: string } };
  const creds = JSON.parse(Buffer.from(j.payload.data, 'base64').toString()) as {
    client_id: string;
    client_secret: string;
    refresh_token: string;
  };
  return refreshToken(creds.client_id, creds.client_secret, creds.refresh_token);
}

// ─────────────────────────── API helpers ───────────────────────────

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
    if (res.status === 409 || text.includes('already exists')) return { _exists: true };
    throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 250)}`);
  }
  if (res.status === 204) return { ok: true };
  return res.json();
}

async function poll(token: string, opName: string, base: string, quota?: string): Promise<void> {
  const url = opName.startsWith('http') ? opName : `${base}/${opName}`;
  for (let i = 0; i < 40; i++) {
    const res = await api(token, url, 'GET', undefined, quota);
    if (res.done) {
      if (res.error)
        throw new Error(`LRO fallida: ${res.error.message || JSON.stringify(res.error)}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Operation timed out: ${opName}`);
}

// ─────────────────────────── Estado ───────────────────────────

async function listShardProjects(
  token: string,
): Promise<Array<{ projectId: string; createTime?: string }>> {
  const all: Array<{ projectId: string; createTime?: string }> = [];
  let pageToken = '';
  do {
    const url = `${CRM_URL}/projects?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': platformProject },
    });
    if (!res.ok) throw new Error(`GCP list failed (${res.status}).`);
    const j = (await res.json()) as { projects?: Array<any>; nextPageToken?: string };
    for (const p of j.projects || []) {
      if (p.projectId?.startsWith('vtx-sd-') && p.lifecycleState === 'ACTIVE') {
        all.push({ projectId: p.projectId, createTime: p.createTime });
      }
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken && all.length < 1000);
  return all;
}

async function getPoolProjectIds(token: string): Promise<Set<string>> {
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
  if (!res.ok) throw new Error(`Pool read failed (${res.status}).`);
  const docs = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, any> };
  }>;
  const ids = new Set<string>();
  for (const d of docs) {
    const f = d.document?.fields;
    if (!f) continue;
    if ((f['environment']?.stringValue ?? '') !== envValue) continue;
    if (f['projectId']?.stringValue) ids.add(f['projectId'].stringValue);
  }
  return ids;
}

// ─────────────────────────── Configuración ───────────────────────────

const APIS = [
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firestore.googleapis.com',
  'firebasehosting.googleapis.com',
  'secretmanager.googleapis.com',
  'cloudresourcemanager.googleapis.com',
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
  'apikeys.googleapis.com',
  'firebaserules.googleapis.com',
];

/** Retry con backoff para pasos propensos a fallos transitorios (rules, IdP). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 3000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

/** Despliega firestore.rules + storage.rules en un shard (con retry por transitorios). */
async function deployShardRules(token: string, projectId: string): Promise<void> {
  const deployRuleset = async (
    fileName: string,
    content: string,
    releaseId: string,
  ): Promise<void> => {
    await withRetry(
      async () => {
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
            /* 404 ok */
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
      },
      3,
      4000,
    );
  };
  await deployRuleset('firestore.rules', STOREFRONT_FIRESTORE_RULES, 'cloud.firestore');
  await deployRuleset('storage.rules', STOREFRONT_STORAGE_RULES, 'firebase.storage');
}

async function configureProject(
  token: string,
  projectId: string,
  billingAccountId: string,
): Promise<{
  billingLinked: string | null;
  firestoreOk: boolean;
  webAppOk: boolean;
  rulesOk: boolean;
}> {
  console.log(`\n▶ Completando ${projectId} (billing ${billingAccountId})...`);
  let firestoreOk = false;
  let webAppOk = false;
  let rulesOk = false;

  // 1. Vincular billing (requiere credenciales owner). Si el proyecto YA tiene
  // billing, se usa esa cuenta (sin re-vincular). Si la cuenta primaria falla,
  // probar la siguiente (FAILED_PRECONDITION = restricción/cuota de la cuenta).
  let billingLinked: string | null = null;
  try {
    const current = await api(
      token,
      `${BILLING_URL}/projects/${projectId}/billingInfo`,
      'GET',
      undefined,
      platformProject,
    );
    const existing = current?.billingAccountName?.replace('billingAccounts/', '');
    if (current?.billingEnabled === true && existing) {
      billingLinked = existing;
      console.log(`  ✅ billing ya vinculado (${existing})`);
    }
  } catch {
    /* sigue a intentar vincular */
  }
  const billingCandidates = billingLinked
    ? []
    : billingAccountId
      ? [billingAccountId, ...BILLING_ACCOUNTS.filter((b) => b !== billingAccountId)]
      : BILLING_ACCOUNTS;
  for (const account of billingCandidates) {
    try {
      await withRetry(
        () =>
          api(
            token,
            `${BILLING_URL}/projects/${projectId}/billingInfo`,
            'PUT',
            { billingAccountName: `billingAccounts/${account}` },
            platformProject,
          ),
        2,
        2000,
      );
      billingLinked = account;
      console.log(`  ✅ billing vinculado (${account})`);
      break;
    } catch (err: any) {
      const msg = String(err?.message || '');
      const terminal = msg.includes('not found') || msg.includes('permission');
      console.warn(`  ⚠️ billing ${account}: ${msg.slice(0, 140)}${terminal ? ' [terminal]' : ''}`);
      if (terminal) break;
    }
  }
  if (!billingLinked) {
    console.warn('  ⚠️ sin billing vinculado — el shard quedará en Spark (sin Cloud Functions).');
  }

  // 2. Habilitar APIs (quota = platform)
  try {
    const e = await api(
      token,
      `${SERVICEUSAGE_URL}/projects/${projectId}/services:batchEnable`,
      'POST',
      { serviceIds: APIS },
      platformProject,
    );
    if (e.name) await poll(token, e.name, SERVICEUSAGE_URL, platformProject);
    console.log('  ✅ APIs habilitadas');
  } catch (err: any) {
    console.warn(`  ⚠️ batchEnable: ${String(err?.message || '').slice(0, 160)}`);
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
    if (fb.name) await poll(token, fb.name, FIREBASE_URL, platformProject);
    console.log('  ✅ Firebase activado');
  } catch (err: any) {
    if (!String(err?.message || '').includes('already')) throw err;
  }

  // 4. Firestore nativo
  try {
    const db = await api(
      token,
      `${FIRESTORE_URL}/projects/${projectId}/databases?databaseId=(default)`,
      'POST',
      { type: 'FIRESTORE_NATIVE', locationId: 'nam5' },
      projectId,
    );
    if (db.name) await poll(token, db.name, FIRESTORE_URL, projectId);
    firestoreOk = true;
    console.log('  ✅ Firestore nativo');
  } catch (err: any) {
    if (
      !String(err?.message || '').includes('409') &&
      !String(err?.message || '').includes('already')
    ) {
      console.warn(`  ⚠️ firestore: ${String(err?.message || '').slice(0, 160)}`);
    }
  }

  // 5. Storage bucket default + CORS
  try {
    const corsConfig = {
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
    };
    const setCors = async (bucketName: string): Promise<boolean> => {
      try {
        await withRetry(
          () => api(token, `${STORAGE_URL}/b/${bucketName}`, 'PATCH', corsConfig, projectId),
          3,
          3000,
        );
        return true;
      } catch {
        return false;
      }
    };
    const buckets = await api(
      token,
      `${STORAGE_URL}/b?project=${projectId}`,
      'GET',
      undefined,
      projectId,
    );
    const names = (buckets.items || []).map((b: any) => b.name);
    const hasNew = names.includes(`${projectId}.firebasestorage.app`);
    if (!hasNew) {
      try {
        await api(
          token,
          `${STORAGE_URL}/b?project=${projectId}`,
          'POST',
          { name: `${projectId}.firebasestorage.app` },
          projectId,
        );
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (
          !msg.includes('owns the domain') &&
          !msg.includes('already exists') &&
          !msg.includes('409')
        )
          throw err;
        console.log('  · bucket nuevo ya existe (otro owner) — continúo');
      }
    }
    // CORS sobre el bucket que realmente existe (default puede ser
    // {projectId}.firebasestorage.app o {projectId}.appspot.com según quién lo creó).
    let corsOk = await setCors(`${projectId}.firebasestorage.app`);
    if (!corsOk) {
      const actual = names.find(
        (n: string) =>
          n.startsWith(projectId) &&
          (n.endsWith('.appspot.com') || n.endsWith('.firebasestorage.app')),
      );
      if (actual) corsOk = await setCors(actual);
    }
    if (!corsOk && names.length > 0) {
      // Último recurso: CORS en el primer bucket del proyecto (suele ser el default).
      corsOk = await setCors(names[0]);
    }
    console.log(corsOk ? '  ✅ Storage + CORS' : '  ⚠️ storage: no se pudo setear CORS');
  } catch (err: any) {
    console.warn(`  ⚠️ storage: ${String(err?.message || '').slice(0, 160)}`);
  }

  // 6. Web app + config
  try {
    const apps = await api(
      token,
      `${FIREBASE_URL}/projects/${projectId}/webApps`,
      'GET',
      undefined,
      projectId,
    );
    const existing = (apps.apps || [])[0];
    if (!existing) {
      const wa = await api(
        token,
        `${FIREBASE_URL}/projects/${projectId}/webApps`,
        'POST',
        { displayName: `Storefront ${projectId.replace('vtx-sd-', '')}` },
        projectId,
      );
      if (wa.name) await poll(token, wa.name, FIREBASE_URL, projectId);
    }
    webAppOk = true;
    console.log('  ✅ web app');
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
      `${IDTOOLKIT_URL}/v2/projects/${masterStorefrontProject}/defaultSupportedIdpConfigs/google.com`,
      'GET',
      undefined,
      masterStorefrontProject,
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
      console.log('  ✅ Google IdP');
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

  // 10. Rules del storefront (firestore + storage) — con retry: puede fallar
  // transitoriamente justo después de crear el Firestore DB.
  try {
    await deployShardRules(token, projectId);
    rulesOk = true;
    console.log('  ✅ rules (firestore + storage)');
  } catch (err: any) {
    console.warn(`  ⚠️ rules: ${String(err?.message || '').slice(0, 160)}`);
  }

  // 11. API keys sin restricciones (dominios multi-tenant)
  try {
    const projInfo = await api(
      token,
      `${CRM_URL}/projects/${projectId}`,
      'GET',
      undefined,
      platformProject,
    );
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
    console.log('  ✅ API keys');
  } catch (err: any) {
    console.warn(`  ⚠️ api keys: ${String(err?.message || '').slice(0, 120)}`);
  }

  return { billingLinked, firestoreOk, webAppOk, rulesOk };
}

async function registerShardDoc(
  token: string,
  projectId: string,
  billingAccountId: string,
): Promise<void> {
  const shardId = `shard-${envValue}-${projectId.replace('vtx-sd-', '')}`;
  const fields = {
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
    billingAccountId: { stringValue: billingAccountId },
    updatedAt: { timestampValue: new Date().toISOString() },
  };
  // updateMask: solo escribo estos campos, preservando firebaseConfig u otros
  // campos ya presentes en el doc (reconfiguración idempotente).
  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const docUrl = `${FIRESTORE_URL}/projects/${platformProject}/databases/(default)/documents/infrastructure_shards/${shardId}?${mask}`;
  await api(token, docUrl, 'PATCH', { fields }, platformProject);
  console.log(
    `  ✅ registrado en infrastructure_shards (${shardId}${billingAccountId ? `, billing=${billingAccountId}` : ', sin billing'})`,
  );
}

async function backfillBilling(token: string, adcToken: string): Promise<void> {
  console.log(`\n=== Backfill billingAccountId en shards registrados (${opts.env}) ===`);
  const url = `${FIRESTORE_URL}/projects/${platformProject}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adcToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': platformProject,
    },
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId: 'infrastructure_shards' }], limit: 500 },
    }),
  });
  const docs = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, any> };
  }>;
  let updated = 0;
  for (const d of docs) {
    const f = d.document?.fields;
    if (!f) continue;
    if ((f['environment']?.stringValue ?? '') !== envValue) continue;
    const projectId = f['projectId']?.stringValue ?? '';
    const docId = d.document!.name.split('/').pop()!;
    if (!projectId) continue;
    try {
      const bi = await api(
        token,
        `${BILLING_URL}/projects/${projectId}/billingInfo`,
        'GET',
        undefined,
        platformProject,
      );
      const account = bi.billingAccountName?.replace('billingAccounts/', '');
      if (account) {
        await api(
          token,
          `${FIRESTORE_URL}/projects/${platformProject}/databases/(default)/documents/infrastructure_shards/${docId}?updateMask.fieldPaths=billingAccountId&updateMask.fieldPaths=updatedAt`,
          'PATCH',
          {
            fields: {
              billingAccountId: { stringValue: account },
              updatedAt: { timestampValue: new Date().toISOString() },
            },
          },
          platformProject,
        );
        console.log(`  ${projectId} → ${account}`);
        updated++;
      } else {
        console.log(`  ${projectId} → sin billing`);
      }
    } catch {
      console.log(`  ${projectId} → no consultable`);
    }
  }
  console.log(`Backfill: ${updated} shard(s) actualizados.`);
}

// ─────────────────────────────── main ───────────────────────────────

async function main(): Promise<void> {
  const adcToken = await getAadcToken();
  const ownerToken = await getOwnerToken(adcToken);

  if (opts.backfillBilling) {
    await backfillBilling(ownerToken, adcToken);
    return;
  }

  if (opts.fixRules) {
    // Redespliega firestore + storage rules a todos los shards registrados del entorno
    // (para propagar fixes de reglas, p. ej. el bug de svg\\+xml en storage rules).
    const poolIds = await getPoolProjectIds(adcToken);
    const ids = [...poolIds].sort();
    console.log(`=== Fix de rules en ${ids.length} shards registrados (${opts.env}) ===`);
    let ok = 0;
    let failed = 0;
    for (const projectId of ids) {
      try {
        await deployShardRules(ownerToken, projectId);
        console.log(`  ✅ ${projectId}`);
        ok++;
      } catch (err: any) {
        failed++;
        console.error(`  ❌ ${projectId}: ${String(err?.message || err).slice(0, 160)}`);
      }
    }
    console.log(`Fix rules: ${ok} OK, ${failed} fallidos.`);
    return;
  }

  const poolIds = await getPoolProjectIds(adcToken);
  const gcpShards = await listShardProjects(ownerToken);
  const orphans = gcpShards
    .filter((p) => !poolIds.has(p.projectId))
    .map((p) => p.projectId)
    .sort();
  // --project-ids opera sobre los IDs dados (registrados o no) para poder
  // reconfigurar shards que quedaron a medio completar en un run anterior.
  const targets = opts.projectIds ? opts.projectIds : orphans;

  console.log(`=== Reciclaje de huérfanos (${opts.env}) → ${platformProject} ===`);
  console.log(
    `  proyectos vtx-sd-* en GCP: ${gcpShards.length} | registrados: ${poolIds.size} | huérfanos: ${orphans.length}`,
  );
  if (opts.projectIds) {
    const missing = opts.projectIds.filter((id) => !orphans.includes(id));
    console.log(
      `  --project-ids: ${opts.projectIds.length} pedidos (${missing.length} no son huérfanos)`,
    );
  }
  if (targets.length === 0) {
    console.log('  Nada que completar.');
    return;
  }
  for (const id of targets) console.log(`  • ${id}`);
  if (opts.dryRun) {
    console.log('\n[dry-run] No se ejecuta nada.');
    return;
  }
  if (targets.length > BILLING_ACCOUNTS.length * 10 && BILLING_ACCOUNTS.length > 0) {
    console.warn(
      `  ⚠️ Más proyectos que cupo de billing (${BILLING_ACCOUNTS.length * 10}). Se reparten round-robin respetando maxProjects.`,
    );
  }

  const redirects: string[] = [];
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i++) {
    const projectId = targets[i];
    // Reparto round-robin respetando maxProjects=10 por cuenta.
    const billingAccountId =
      BILLING_ACCOUNTS.length > 0
        ? BILLING_ACCOUNTS[Math.min(BILLING_ACCOUNTS.length - 1, Math.floor(i / 10))]
        : 'LINK_MANUAL';
    try {
      const { billingLinked, firestoreOk, webAppOk, rulesOk } = await configureProject(
        ownerToken,
        projectId,
        billingAccountId,
      );
      // GATE de registro: solo entran al pool los shards realmente utilizables
      // (billing + Firestore + web app + rules). Si falta alguno, queda como
      // huérfano para completar cuando haya cuota de billing.
      if (!billingLinked || !firestoreOk || !webAppOk || !rulesOk) {
        failed++;
        console.warn(
          `  ⚠️ ${projectId} NO se registra (billing=${billingLinked ? 'OK' : 'FALTA'}, ` +
            `firestore=${firestoreOk ? 'OK' : 'FALTA'}, webApp=${webAppOk ? 'OK' : 'FALTA'}, ` +
            `rules=${rulesOk ? 'OK' : 'FALTA'}) — queda huérfano hasta tener cuota de billing.`,
        );
        continue;
      }
      await registerShardDoc(ownerToken, projectId, billingLinked);
      redirects.push(`https://${projectId}.firebaseapp.com/__/auth/handler`);
      ok++;
    } catch (err: any) {
      failed++;
      console.error(`  ❌ ${projectId}: ${String(err?.message || err).slice(0, 220)}`);
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(
    `  completados: ${ok} | fallidos: ${failed} | pool total ahora: ${poolIds.size + ok}`,
  );
  if (redirects.length > 0) {
    console.log('\n=== PASO MANUAL (redirect URIs, una vez por shard) ===');
    console.log(
      `Consola: https://console.cloud.google.com/apis/credentials?project=${masterStorefrontProject}`,
    );
    console.log(`client OAuth master: ${MASTER_CLIENT_ID}\n`);
    for (const uri of redirects) console.log(`  ${uri}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
