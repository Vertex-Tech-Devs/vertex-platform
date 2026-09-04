#!/usr/bin/env node
/**
 * heal-shards.ts — Auto-reparación del pool de shards multi-tenant.
 *
 * Recorre los shards registrados en `infrastructure_shards` y, para cada uno:
 *   1. Habilita en bloque las 7 APIs canónicas (identitytoolkit, secretmanager,
 *      firestore, firebase, cloudresourcemanager, iam, firebasehosting).
 *   2. Aplica de forma idempotente los bindings IAM del Orchestrator/Platform
 *      sobre el shard (secretmanager.admin, datastore.owner, firebase.admin,
 *      iam.serviceAccountUser + editor/secretAccessor).
 *   3. Imprime un reporte tabular: [Shard ID] | [APIs OK] | [IAM OK] | [Status].
 *
 * Uso:
 *   npx tsx scripts/heal-shards.ts --env dev
 *   npx tsx scripts/heal-shards.ts --env prod
 *   npx tsx scripts/heal-shards.ts            # dev por defecto
 */
import { GoogleAuth } from 'google-auth-library';

const CANONICAL_APIS = [
  'identitytoolkit.googleapis.com',
  'secretmanager.googleapis.com',
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'cloudresourcemanager.googleapis.com',
  'iam.googleapis.com',
  'firebasehosting.googleapis.com',
];

const IAM_ROLES = [
  'roles/secretmanager.admin',
  'roles/secretmanager.secretAccessor',
  'roles/datastore.owner',
  'roles/firebase.admin',
  'roles/iam.serviceAccountUser',
  'roles/editor',
];

function parseArgs(): { env: 'dev' | 'prod' } {
  const args = process.argv.slice(2);
  const i = args.indexOf('--env');
  const env = i >= 0 && args[i + 1] ? (args[i + 1] as 'dev' | 'prod') : 'dev';
  if (env !== 'dev' && env !== 'prod') throw new Error(`--env debe ser 'dev' o 'prod'.`);
  return { env };
}

async function api(token: string, url: string, init?: RequestInit & { userProject?: string }) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': init?.userProject || '',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${body?.error?.message || body?.message || text?.slice(0, 200)}`);
  }
  return body;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enableApis(token: string, projectId: string): Promise<void> {
  const base = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services`;
  for (const svc of CANONICAL_APIS) {
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const state = await api(token, `${base}/${svc}`);
        if (state?.state === 'ENABLED') {
          ok = true;
        } else {
          await api(token, `${base}/${svc}:enable`, { method: 'POST', body: '{}' });
          ok = true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt === 3) throw new Error(`API ${svc}: ${msg}`);
        await delay(10000);
      }
    }
  }
}

async function ensureIam(token: string, projectId: string, platformSA: string): Promise<void> {
  const crm = `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`;
  const policy = await api(token, `${crm}:getIamPolicy`, { method: 'POST', body: '{}' });
  const bindings: Array<{ role: string; members: string[] }> = policy.bindings || [];
  const member = `serviceAccount:${platformSA}`;
  let modified = false;
  for (const role of IAM_ROLES) {
    let b = bindings.find((x) => x.role === role);
    if (!b) {
      b = { role, members: [] };
      bindings.push(b);
    }
    if (!b.members.includes(member)) {
      b.members.push(member);
      modified = true;
    }
  }
  if (modified) {
    await api(token, `${crm}:setIamPolicy`, {
      method: 'POST',
      body: JSON.stringify({ policy: { ...policy, bindings, etag: policy.etag } }),
    });
  }
}

async function main(): Promise<void> {
  const { env } = parseArgs();
  const platformProject = env === 'prod' ? 'vertex-platform-app' : 'vertex-platform-dev';
  const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  const platformSA = `${platformProject}@appspot.gserviceaccount.com`;

  const fsUrl = `https://firestore.googleapis.com/v1/projects/${platformProject}/databases/(default)/documents/infrastructure_shards?pageSize=300`;
  const list = await api(token as string, fsUrl, { userProject: platformProject });
  const docs = list.documents || [];
  console.log(`\n🔧 HEAL SHARDS — env=${env} | project=${platformProject} | shards=${docs.length}`);
  console.log(`${'Shard ID'.padEnd(24)} | ${'APIs OK'.padEnd(8)} | ${'IAM OK'.padEnd(8)} | Status`);
  console.log('-'.repeat(70));

  for (const doc of docs) {
    const id = decodeURIComponent(doc.name.split('/').pop());
    const f = doc.fields || {};
    const g = (k: string) => f[k]?.stringValue || '';
    const shardId = g('projectId') || g('id') || id;
    try {
      await enableApis(token as string, shardId);
      await ensureIam(token as string, shardId, platformSA);
      console.log(`${shardId.padEnd(24)} | ${'✔'.padEnd(8)} | ${'✔'.padEnd(8)} | OK`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${shardId.padEnd(24)} | ${'✘'.padEnd(8)} | ${'✘'.padEnd(8)} | ERROR`);
      console.log(`    ↳ ${msg.slice(0, 160)}`);
    }
  }
}

main().catch((err) => {
  console.error('heal-shards fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
