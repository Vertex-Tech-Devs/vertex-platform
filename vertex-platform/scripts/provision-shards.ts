#!/usr/bin/env node
/**
 * provision-shards.ts — Expande el pool de shards multi-tenant.
 *
 * Crea N shards nuevos (proyectos GCP vtx-sd-*) totalmente configurados:
 *   proyecto + Firebase + APIs + Firestore NATIVO + Storage/CORS + web app/config
 *   + Identity Platform + Google IdP (clientId del master) + authorizedDomains
 *   + rules del storefront + índices compuestos + registro en infrastructure_shards.
 *
 * Uso:
 *   npx tsx scripts/provision-shards.ts --count 10 --env dev
 *   npx tsx scripts/provision-shards.ts --count 10 --env prod
 *
 * El ÚNICO paso manual (Google no expone API): registrar en Google Cloud Console
 * el redirect URI de cada shard nuevo en el client OAuth del master. El script
 * imprime la lista de URIs al final.
 *
 * Requiere un ADC con permisos de owner/editor sobre el entorno destino.
 */
import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';

// google-auth-library vive en functions/node_modules — resolver con paths explícitos
// para que el script corra desde cualquier CWD.
const require2 = createRequire(path.resolve(__dirname, '../../functions/package.json'));
const { GoogleAuth } = require2('google-auth-library') as typeof import('google-auth-library');

interface Options {
  count: number;
  env: 'dev' | 'prod';
  masterStorefrontProject: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (flag: string): string => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : '';
  };
  const count = Number(get('--count') || '1');
  const env = (get('--env') || 'dev') as Options['env'];
  if (count < 1 || count > 30) {
    throw new Error('--count debe estar entre 1 y 30');
  }
  return {
    count,
    env,
    masterStorefrontProject:
      env === 'prod' ? 'ecommerce-vertex' : 'ecommerce-vertex-dev',
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

async function getToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  return token || '';
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
    throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return { ok: true };
  return res.json();
}

async function poll(token: string, opName: string, base: string): Promise<void> {
  const url = opName.startsWith('http') ? opName : `${base}/${opName}`;
  for (let i = 0; i < 40; i++) {
    const res = await api(token, url, 'GET');
    if (res.done) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Operation timed out: ${opName}`);
}

const MASTER_CLIENT_ID =
  '988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com';

async function provisionShard(token: string, projectId: string): Promise<{ redirectUri: string }> {
  const randomId = projectId.replace('vtx-sd-', '');
  console.log(`\n▶ Provisionando shard ${projectId}...`);

  // 1. Proyecto GCP
  let op = await api(token, `${CRM_URL}/projects`, 'POST', {
    projectId,
    displayName: `Vertex Shard ${randomId}`,
  }, platformProject);
  if (op._exists) {
    console.log('  proyecto ya existe — continúo con la configuración');
  } else if (op.name) {
    await poll(token, op.name, CRM_URL);
    console.log('  ✅ proyecto creado');
  }

  // 2. Vincular facturación (necesaria para Firebase/Storage/Firestore)
  try {
    const billingList = await api(token, 'https://cloudbilling.googleapis.com/v1/billingAccounts', 'GET', undefined, platformProject);
    const account = (billingList.billingAccounts || []).find((b: any) => b.open) || (billingList.billingAccounts || [])[0];
    if (account) {
      await api(token, `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, 'PUT', { billingAccountName: account.name }, platformProject);
      console.log(`  ✅ facturación vinculada (${account.name})`);
    } else {
      console.warn('  ⚠️ sin cuenta de billing accesible — el proyecto puede quedar sin servicios pagos');
    }
  } catch (err: any) {
    console.warn('  ⚠️ billing:', String(err?.message || '').slice(0, 120));
  }

  // 3. Firebase
  try {
    const fb = await api(token, `${FIREBASE_URL}/projects/${projectId}:addFirebase`, 'POST', {}, platformProject);
    if (fb.name) await poll(token, fb.name, FIREBASE_URL);
    console.log('  ✅ Firebase activado');
  } catch (err: any) {
    if (!String(err?.message || '').includes('already')) throw err;
  }

  // 3. Habilitar APIs (sin appengine para no crear Datastore)
  const apis = [
    'identitytoolkit.googleapis.com', 'firestore.googleapis.com',
    'firebasehosting.googleapis.com', 'secretmanager.googleapis.com',
    'cloudresourcemanager.googleapis.com', 'storage.googleapis.com',
    'firebasestorage.googleapis.com',
  ];
  try {
    const e = await api(token, `${SERVICEUSAGE_URL}/projects/${projectId}/services:batchEnable`, 'POST', { serviceIds: apis }, platformProject);
    if (e.name) await poll(token, e.name, SERVICEUSAGE_URL);
    console.log('  ✅ APIs habilitadas');
  } catch (err: any) {
    console.warn('  ⚠️ batchEnable:', String(err?.message || '').slice(0, 120));
  }

  // 4. Firestore nativo (si no existe)
  try {
    const db = await api(token, `${FIRESTORE_URL}/projects/${projectId}/databases?databaseId=(default)`, 'POST', { type: 'FIRESTORE_NATIVE', locationId: 'nam5' }, projectId);
    if (db.name) await poll(token, db.name, FIRESTORE_URL);
    console.log('  ✅ Firestore nativo');
  } catch (err: any) {
    if (!String(err?.message || '').includes('409') && !String(err?.message || '').includes('already')) throw err;
  }

  // 5. Storage bucket default + CORS
  try {
    const buckets = await api(token, `${STORAGE_URL}/b?project=${projectId}`, 'GET');
    const hasBucket = (buckets.items || []).some((b: any) => b.name === `${projectId}.firebasestorage.app`);
    if (!hasBucket) {
      await api(token, `${STORAGE_URL}/b?project=${projectId}`, 'POST', { name: `${projectId}.firebasestorage.app` }, projectId);
    }
    await api(token, `${STORAGE_URL}/b/${projectId}.firebasestorage.app`, 'PATCH', {
      cors: [{ origin: ['*'], method: ['GET','POST','PUT','DELETE','OPTIONS'], responseHeader: ['Content-Type','Authorization','Content-Length','x-firebase-storage-version','x-goog-resumable'], maxAgeSeconds: 3600 }],
    }, projectId);
    console.log('  ✅ Storage + CORS');
  } catch (err: any) {
    console.warn('  ⚠️ storage:', String(err?.message || '').slice(0, 120));
  }

  // 6. Web app + config
  let appId = '';
  try {
    const apps = await api(token, `${FIREBASE_URL}/projects/${projectId}/webApps`, 'GET', undefined, projectId);
    const existing = (apps.apps || [])[0];
    if (existing) {
      appId = existing.appId;
    } else {
      const wa = await api(token, `${FIREBASE_URL}/projects/${projectId}/webApps`, 'POST', { displayName: `Storefront ${randomId}` }, projectId);
      if (wa.name) await poll(token, wa.name, FIREBASE_URL);
      const list = await api(token, `${FIREBASE_URL}/projects/${projectId}/webApps`, 'GET', undefined, projectId);
      appId = (list.apps || [])[0]?.appId || '';
    }
    console.log(`  ✅ web app ${appId ? 'lista' : ''}`);
  } catch (err: any) {
    console.warn('  ⚠️ webApp:', String(err?.message || '').slice(0, 120));
  }

  // 7. Identity Platform
  try {
    await api(token, `${IDTOOLKIT_URL}/v2/projects/${projectId}/identityPlatform:initializeAuth`, 'POST', {}, projectId);
    console.log('  ✅ Identity Platform');
  } catch (err: any) {
    console.warn('  ⚠️ initializeAuth:', String(err?.message || '').slice(0, 100));
  }

  // 8. Google IdP (clientId/secret del master)
  try {
    const masterIdp = await api(token, `${IDTOOLKIT_URL}/v2/projects/${opts.masterStorefrontProject}/defaultSupportedIdpConfigs/google.com`, 'GET', undefined, opts.masterStorefrontProject);
    if (masterIdp.clientId && masterIdp.clientSecret) {
      await api(token, `${IDTOOLKIT_URL}/v2/projects/${projectId}/defaultSupportedIdpConfigs?idpId=google.com`, 'POST', {
        name: `projects/${projectId}/defaultSupportedIdpConfigs/google.com`,
        enabled: true,
        clientId: masterIdp.clientId,
        clientSecret: masterIdp.clientSecret,
      }, projectId);
      console.log('  ✅ Google IdP configurado (clientId del master)');
    }
  } catch (err: any) {
    console.warn('  ⚠️ IdP:', String(err?.message || '').slice(0, 120));
  }

  // 9. authorizedDomains
  try {
    const cfg = await api(token, `${IDTOOLKIT_URL}/v2/projects/${projectId}/config`, 'GET', undefined, projectId);
    const domains = Array.from(new Set([
      ...(cfg.authorizedDomains || []),
      'localhost', '127.0.0.1',
      `${projectId}.firebaseapp.com`, `${projectId}.web.app`,
    ]));
    await api(token, `${IDTOOLKIT_URL}/v2/projects/${projectId}/config?updateMask=authorizedDomains`, 'PATCH', { authorizedDomains: domains }, projectId);
    console.log('  ✅ authorizedDomains');
  } catch (err: any) {
    console.warn('  ⚠️ domains:', String(err?.message || '').slice(0, 100));
  }

  // 10. Rules del storefront (release cloud.firestore)
  try {
    const localRules = (() => {
      try {
        const fs = require('fs');
        const p = require('path');
        return fs.readFileSync(p.resolve(__dirname, '../../firestore.rules'), 'utf8');
      } catch {
        return '';
      }
    })();
    if (localRules) {
      const rs = await api(token, `${FIREBASERULES_URL}/projects/${projectId}/rulesets`, 'POST', { source: { files: [{ name: 'firestore.rules', content: localRules }] } }, projectId);
      if (rs.name) {
        await api(token, `${FIREBASERULES_URL}/projects/${projectId}/releases`, 'POST', { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: rs.name }, projectId);
      }
      console.log('  ✅ rules desplegadas');
    }
  } catch (err: any) {
    console.warn('  ⚠️ rules:', String(err?.message || '').slice(0, 120));
  }

  // 11. API key: limpiar restricciones
  try {
    const projInfo = await api(token, `${CRM_URL}/projects/${projectId}`, 'GET');
    const num = projInfo.projectNumber;
    if (num) {
      const keys = await api(token, `${APIKEYS_URL}/projects/${num}/locations/global/keys`, 'GET', undefined, projectId);
      for (const k of keys.keys || []) {
        if (k.restrictions && Object.keys(k.restrictions).length > 0) {
          await api(token, `${APIKEYS_URL}/${k.name}?updateMask=restrictions`, 'PATCH', { restrictions: {} }, projectId);
        }
      }
    }
    console.log('  ✅ API keys sin restricciones');
  } catch (err: any) {
    console.warn('  ⚠️ api keys:', String(err?.message || '').slice(0, 100));
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

async function main(): Promise<void> {
  const token = await getToken();
  console.log(`=== Provisionando ${opts.count} shards (${opts.env}) → ${platformProject} ===`);
  const redirects: string[] = [];
  for (let i = 0; i < opts.count; i++) {
    const randomId = Math.random().toString(36).substring(2, 10);
    const projectId = `vtx-sd-${randomId}`;
    try {
      const { redirectUri } = await provisionShard(token, projectId);
      await registerShardDoc(token, projectId);
      redirects.push(redirectUri);
    } catch (err: any) {
      console.error(`  ❌ fallo en ${projectId}:`, String(err?.message || err).slice(0, 200));
    }
  }
  console.log('\n=== PASO MANUAL (único, Google no expone API) ===');
  console.log('Registrar estos redirect URIs en el client OAuth del master');
  console.log(`(project ${opts.masterStorefrontProject}, client ${MASTER_CLIENT_ID}):`);
  for (const uri of redirects) {
    console.log(`  ${uri}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
