#!/usr/bin/env node
/**
 * audit-billing.ts — Auditoría de capacidad de billing accounts.
 *
 * Muestra, por cada billing account registrada en la plataforma:
 *   - proyectos realmente vinculados en GCP (y cuántos cupos libres quedan
 *     contra el límite real de GCP, default 5 por cuenta);
 *   - clasificación de cada proyecto: "plataforma" (shard del pool o proyecto
 *     del platform → conservar) vs "candidato" (no gestionado por la plataforma,
 *     p. ej. proyectos de prueba → se pueden DESVINCULAR para liberar cupo).
 *
 * Por qué sirve: cuando una cuenta llega a su límite (5 proyectos) y el vínculo
 * de un proyecto nuevo falla con "Cloud billing quota exceeded", desvincular un
 * proyecto candidato libera el cupo INMEDIATAMENTE (sin esperar a soporte).
 *
 * Uso:
 *   npx tsx scripts/audit-billing.ts --env dev
 *   npx tsx scripts/audit-billing.ts --env prod
 *
 * Es de SOLO LECTURA: no desvincula nada. Para desvincular un candidato:
 *   gcloud billing projects unlink <projectId>   (o la consola → Billing)
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface Options {
  env: 'dev' | 'prod';
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
  return { env };
}

const opts = parseArgs();
const platformProject = opts.env === 'prod' ? 'vertex-platform-app' : 'vertex-platform-dev';
// Proyectos propios del platform (dev + prod) — nunca marcarlos como candidatos.
const PLATFORM_PROJECTS = new Set([
  'vertex-platform-dev',
  'vertex-platform-app',
  'ecommerce-vertex',
  'ecommerce-vertex-dev',
]);
const BILLING_URL = 'https://cloudbilling.googleapis.com/v1';
const FIRESTORE_URL = 'https://firestore.googleapis.com/v1';

async function getAadcToken(): Promise<string> {
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

async function getOwnerToken(adcToken: string): Promise<string> {
  const r = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${platformProject}/secrets/platform-owner-credentials/versions/latest:access`,
    { headers: { Authorization: `Bearer ${adcToken}`, 'x-goog-user-project': platformProject } },
  );
  if (!r.ok) {
    throw new Error(`No se pudo leer platform-owner-credentials (${r.status}).`);
  }
  const j = (await r.json()) as { payload: { data: string } };
  const creds = JSON.parse(Buffer.from(j.payload.data, 'base64').toString()) as {
    client_id: string;
    client_secret: string;
    refresh_token: string;
  };
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
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
  // Fail-closed: si no se puede leer el pool, abortar (no marcar shards reales
  // como candidatos a desvincular — un operador podría desvincular producción).
  if (!res.ok) {
    throw new Error(
      `No se pudo leer infrastructure_shards (${res.status}) — abortando para no clasificar mal.`,
    );
  }
  const docs = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, any> };
  }>;
  const ids = new Set<string>();
  for (const d of docs) {
    const f = d.document?.fields;
    if (f?.['projectId']?.stringValue) ids.add(f['projectId'].stringValue);
  }
  return ids;
}

async function listLinkedProjects(
  token: string,
  accountId: string,
): Promise<Array<{ projectId: string; billingEnabled: boolean }>> {
  const out: Array<{ projectId: string; billingEnabled: boolean }> = [];
  let pageToken = '';
  do {
    const r = await fetch(
      `${BILLING_URL}/billingAccounts/${encodeURIComponent(accountId)}/projects${pageToken ? `?pageToken=${pageToken}` : ''}`,
      { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': platformProject } },
    );
    if (!r.ok) throw new Error(`billingAccounts/${accountId}/projects → ${r.status}`);
    const j = (await r.json()) as {
      projectBillingInfo?: Array<{ projectId?: string; billingEnabled?: boolean }>;
      nextPageToken?: string;
    };
    for (const p of j.projectBillingInfo ?? []) {
      if (p.projectId)
        out.push({ projectId: p.projectId, billingEnabled: p.billingEnabled !== false });
    }
    pageToken = j.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

async function main(): Promise<void> {
  const adcToken = await getAadcToken();
  const ownerToken = await getOwnerToken(adcToken);
  const poolIds = await getPoolProjectIds(adcToken);

  // Cuentas registradas en la plataforma (con su límite configurado)
  const url = `${FIRESTORE_URL}/projects/${platformProject}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adcToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': platformProject,
    },
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId: 'billingAccounts' }], limit: 100 },
    }),
  });
  const docs = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, any> };
  }>;

  console.log(`=== Auditoría de billing (${opts.env}) → ${platformProject} ===\n`);
  let totalFree = 0;
  for (const d of docs) {
    const f = d.document?.fields;
    if (!f) continue;
    const accountId = d.document!.name.split('/').pop()!;
    const name = f['name']?.stringValue ?? accountId;
    const limit = Number(f['gcpProjectLimit']?.integerValue ?? 5);

    let linked: Array<{ projectId: string; billingEnabled: boolean }> = [];
    try {
      linked = await listLinkedProjects(ownerToken, accountId);
    } catch (err) {
      console.log(
        `\n${name} (${accountId}) — no se pudo leer (${err instanceof Error ? err.message : err})`,
      );
      continue;
    }

    const free = Math.max(0, limit - linked.length);
    totalFree += free;
    console.log(`${name} (${accountId})`);
    console.log(`  uso: ${linked.length}/${limit} proyectos · cupo libre: ${free}`);
    for (const p of linked) {
      const isPlatform = poolIds.has(p.projectId) || PLATFORM_PROJECTS.has(p.projectId);
      console.log(
        `    ${isPlatform ? '🟢' : '🟡'} ${p.projectId}${p.billingEnabled ? '' : ' (billing deshabilitado)'}` +
          (isPlatform ? '' : ' ← CANDIDATO a desvincular'),
      );
    }
    console.log('');
  }
  console.log(`Cupo total libre entre cuentas: ${totalFree}`);
  if (totalFree === 0) {
    console.log('⚠️  Sin cupo: para vincular más proyectos pedí el aumento en');
    console.log('    https://support.google.com/code/contact/billing_quota_increase');
    console.log('    o desvinculá un proyecto 🟡 (gcloud billing projects unlink <id>).');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
