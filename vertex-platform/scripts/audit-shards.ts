#!/usr/bin/env node
/**
 * audit-shards.ts — Auditoría del pool de shards multi-tenant.
 *
 * Cruza el estado real de GCP (proyectos vtx-sd-*) contra el registro
 * infrastructure_shards de la plataforma y reporta:
 *   1. Estado del pool por entorno (registrado en Firestore).
 *   2. Proyectos huérfanos (existen en GCP pero sin doc en el pool) —
 *      consumen cuota de proyectos y pueden generar costos.
 *   3. Redirect URIs del client OAuth master para TODOS los shards del pool
 *      (no solo los que ya tienen tiendas) — el paso manual pendiente.
 *
 * Uso:
 *   npx tsx scripts/audit-shards.ts --env dev
 *   npx tsx scripts/audit-shards.ts --env prod
 *   npx tsx scripts/audit-shards.ts --env dev --no-verify   # saltea el check de URIs
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MASTER_CLIENT_ID = '988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com';

interface Options {
  env: 'dev' | 'prod';
  verify: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (flag: string): string => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : '';
  };
  const env = (get('--env') || 'dev') as Options['env'];
  if (env !== 'dev' && env !== 'prod') {
    throw new Error(`--env debe ser 'dev' o 'prod' (recibido: '${env}').`);
  }
  return { env, verify: !args.includes('--no-verify') };
}

const opts = parseArgs();
const platformProject = opts.env === 'prod' ? 'vertex-platform-app' : 'vertex-platform-dev';
const envValue = opts.env === 'prod' ? 'production' : 'development';
const CRM_URL = 'https://cloudresourcemanager.googleapis.com/v3';
const FIRESTORE_URL = 'https://firestore.googleapis.com/v1';

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
      if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) throw new Error('No access_token.');
      return data.access_token;
    }
  }
  throw new Error('No Application Default Credentials found.');
}

async function listGcpProjects(
  token: string,
): Promise<Array<{ projectId: string; state: string; createTime?: string }>> {
  const all: Array<{ projectId: string; state: string; createTime?: string }> = [];
  let pageToken = '';
  do {
    const url = `https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-user-project': platformProject,
      },
    });
    if (!res.ok) {
      throw new Error(`GCP list failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    const j = (await res.json()) as { projects?: Array<any>; nextPageToken?: string };
    for (const p of j.projects || []) {
      all.push({
        projectId: p.projectId,
        state: p.lifecycleState || 'ACTIVE',
        createTime: p.createTime,
      });
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken && all.length < 1000);
  return all;
}

async function getPoolDocs(
  token: string,
): Promise<Array<{ id: string; projectId: string; status: string; currentStores: number }>> {
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
      `Firestore pool read failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  const docs = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, any> };
  }>;
  const out: Array<{ id: string; projectId: string; status: string; currentStores: number }> = [];
  for (const d of docs) {
    const f = d.document?.fields;
    if (!f) continue;
    if ((f['environment']?.stringValue ?? '') !== envValue) continue;
    out.push({
      id: d.document!.name.split('/').pop()!,
      projectId: f['projectId']?.stringValue ?? '',
      status: f['status']?.stringValue ?? '',
      currentStores: Number(
        f['currentStores']?.integerValue ?? f['currentStores']?.doubleValue ?? 0,
      ),
    });
  }
  return out;
}

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

async function main(): Promise<void> {
  const token = await getToken();
  console.log(`=== Auditoría de shards (${opts.env}) → ${platformProject} ===\n`);

  // 1. Pool registrado
  const pool = await getPoolDocs(token);
  const byStatus: Record<string, number> = {};
  for (const d of pool) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  console.log(`Pool registrado: ${pool.length} doc(s)`);
  for (const [k, v] of Object.entries(byStatus)) console.log(`  ${k}: ${v}`);
  console.log('');

  // 2. Proyectos GCP reales vs registrados
  const gcp = await listGcpProjects(token);
  const shardProjects = gcp.filter((p) => p.projectId.startsWith('vtx-sd-'));
  const registered = new Set(pool.map((d) => d.projectId).filter(Boolean));
  const orphans = shardProjects.filter((p) => !registered.has(p.projectId));
  console.log(
    `Proyectos vtx-sd-* en GCP: ${shardProjects.length} | registrados: ${registered.size}`,
  );
  console.log(`Huérfanos (GCP sin doc en el pool): ${orphans.length}`);
  for (const p of orphans) {
    console.log(
      `  ⚠ ${p.projectId} | state=${p.state} | created=${(p.createTime || '').slice(0, 10)}`,
    );
  }
  if (orphans.length > 0) {
    console.log(
      '  → Consumen cuota de proyectos y pueden generar costo. Verificá en la consola y borralos con:',
    );
    console.log('    gcloud projects delete <projectId> (o desde Cloud Console)');
  }
  console.log('');

  // 3. Redirect URIs de todos los shards del pool
  if (opts.verify && pool.length > 0) {
    console.log('Redirect URIs (client OAuth master):');
    const consoleUrl = `https://console.cloud.google.com/apis/credentials?project=${opts.env === 'prod' ? 'ecommerce-vertex' : 'ecommerce-vertex-dev'}`;
    let missing = 0;
    for (const d of pool) {
      if (!d.projectId) continue;
      const uri = `https://${d.projectId}.firebaseapp.com/__/auth/handler`;
      const ok = await verifyRedirectUri(MASTER_CLIENT_ID, uri);
      console.log(`  ${ok ? '✅' : '❌'} ${uri} (${d.status}, ${d.currentStores} tiendas)`);
      if (!ok) missing++;
    }
    if (missing > 0) {
      console.log(`\n⚠️  ${missing} URI(s) sin registrar. Agregalos en: ${consoleUrl}`);
      console.log('   (paso manual — Google no expone API para redirect URIs)');
    } else {
      console.log('\n✅ Todos los shards del pool tienen su redirect URI registrado.');
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
