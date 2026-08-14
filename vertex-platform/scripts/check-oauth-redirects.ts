/**
 * check-oauth-redirects.ts
 * -----------------------------------------------------------------------------
 * Verifica que cada shard de tiendas tenga su redirect URI registrado en el
 * client OAuth del master (Google Cloud Console). Google NO expone API para
 * agregar redirect URIs → es el único paso manual del modelo multi-shard.
 *
 * Uso:
 *   npx tsx scripts/check-oauth-redirects.ts
 *   PLATFORM_PROJECT_ID=vertex-platform-app npx tsx scripts/check-oauth-redirects.ts
 * -----------------------------------------------------------------------------
 */
import { GoogleAuth } from 'google-auth-library';

const PLATFORM_PROJECT = process.env['PLATFORM_PROJECT_ID'] || 'vertex-platform-dev';
const MASTER_STOREFRONT_PROJECT =
  process.env['MASTER_STOREFRONT_PROJECT_ID'] || 'ecommerce-vertex-dev';
const CLIENT_ID =
  process.env['OAUTH_CLIENT_ID'] ||
  '988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com';

async function getToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  return token || '';
}

async function api<T>(url: string, token: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
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
    // Falla → /signin/oauth/error u otra página intermedia.
    return location.startsWith(redirectUri);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const token = await getToken();
  const base = `https://firestore.googleapis.com/v1/projects/${PLATFORM_PROJECT}/databases/(default)/documents`;

  // 1. Stores activos → shard
  const storesRes = await api<{ documents?: Array<{ name: string; fields: Record<string, any> }> }>(
    `${base}/stores?pageSize=300`,
    token,
  );
  const byShard = new Map<string, number>();
  for (const doc of storesRes.documents ?? []) {
    const f = doc.fields ?? {};
    const pid = f['firebaseProjectId']?.stringValue ?? '';
    if (pid && pid !== MASTER_STOREFRONT_PROJECT) {
      byShard.set(pid, (byShard.get(pid) ?? 0) + 1);
    }
  }

  if (byShard.size === 0) {
    console.log(
      `No se encontraron tiendas en proyectos shard (master: ${MASTER_STOREFRONT_PROJECT}).`,
    );
    return;
  }

  console.log(`=== Verificación de redirect URIs OAuth (platform: ${PLATFORM_PROJECT}) ===`);
  console.log(`clientId: ${CLIENT_ID}\n`);

  const consoleClientUrl = `https://console.cloud.google.com/apis/credentials?project=${MASTER_STOREFRONT_PROJECT}`;
  let missing = 0;

  for (const [shard, count] of [...byShard.entries()].sort()) {
    const redirectUri = `https://${shard}.firebaseapp.com/__/auth/handler`;
    const ok = await verifyRedirectUri(CLIENT_ID, redirectUri);
    if (ok) {
      console.log(`✅ ${shard} (${count} tiendas) — URI registrado`);
    } else {
      missing++;
      console.log(`❌ ${shard} (${count} tiendas) — FALTA registrar el redirect URI`);
      console.log(`   → ${redirectUri}`);
    }
  }

  console.log('');
  if (missing > 0) {
    console.log(`⚠️  ${missing} shard(s) sin redirect URI. Registralo en Google Cloud Console:`);
    console.log(`   1. Abrí: ${consoleClientUrl}`);
    console.log(`   2. Client OAuth: ${CLIENT_ID}`);
    console.log(
      `   3. Authorized redirect URIs → agregá https://<shard>.firebaseapp.com/__/auth/handler`,
    );
    console.log(
      '   (único paso manual — Google no expone API para esto; una vez por shard ~35 tiendas)',
    );
    process.exitCode = 1;
  } else {
    console.log('✅ Todos los shards tienen su redirect URI registrado.');
  }
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
