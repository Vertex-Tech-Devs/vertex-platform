/**
 * delete-prueba-tres.ts
 *
 * Script de limpieza manual para eliminar la tienda "Prueba Tres" del shard compartido.
 * Flujo: tombstone hosting → eliminar hosting site → decrementar shard counter → eliminar Firestore docs.
 *
 * Usage:
 *   npx tsx scripts/delete-prueba-tres.ts
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { OAuth2Client } from 'google-auth-library';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// ─── Config ──────────────────────────────────────────────────────────────────
const PLATFORM_PROJECT = 'vertex-platform-dev';
const STORE_ID = 'e641bddc-628e-407c-b89f-a55e25bd6560';
const SHARD_PROJECT_ID = 'vertex-platform-dev'; // runtimeProjectId
const RUNTIME_SITE_ID = 'vtx-prueba-tres';      // runtimeSiteId
const SHARD_ID = 'shared-dev-01';               // shardId

// ─── Init ─────────────────────────────────────────────────────────────────────
initializeApp({ projectId: PLATFORM_PROJECT });
const db = getFirestore();
const secretsClient = new SecretManagerServiceClient();

async function getOwnerOAuthClient(): Promise<OAuth2Client> {
  let creds: { client_id: string; client_secret: string; refresh_token: string };

  // Try pool first, fall back to single credential secret
  try {
    const [version] = await secretsClient.accessSecretVersion({
      name: `projects/${PLATFORM_PROJECT}/secrets/platform-owner-credentials-pool/versions/latest`,
    });
    const parsed = JSON.parse(version.payload!.data!.toString());
    const owners = Array.isArray(parsed) ? parsed : parsed.owners;
    creds = owners[0];
  } catch {
    const [version] = await secretsClient.accessSecretVersion({
      name: `projects/${PLATFORM_PROJECT}/secrets/platform-owner-credentials/versions/latest`,
    });
    creds = JSON.parse(version.payload!.data!.toString());
  }

  const client = new OAuth2Client(creds.client_id, creds.client_secret);
  client.setCredentials({ refresh_token: creds.refresh_token });
  return client;
}

async function getToken(auth: OAuth2Client): Promise<string> {
  const res = await auth.getAccessToken();
  if (!res.token) throw new Error('Could not obtain OAuth access token');
  return res.token;
}

async function deployTombstone(auth: OAuth2Client, projectId: string, siteId: string): Promise<void> {
  console.log(`[tombstone] Deploying tombstone to ${projectId}/${siteId}...`);
  const token = await getToken(auth);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-goog-user-project': PLATFORM_PROJECT,
  };

  // 1. Create empty version
  const createRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/versions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ config: { redirects: [], rewrites: [], headers: [] } }),
    }
  );
  if (!createRes.ok && createRes.status !== 409) {
    const body = await createRes.text();
    console.warn(`[tombstone] Create version failed (${createRes.status}): ${body}`);
    return;
  }
  const createData = await createRes.json() as { name?: string };
  const versionName = createData.name;
  if (!versionName) {
    console.warn('[tombstone] No version name returned, skipping tombstone.');
    return;
  }

  // 2. Finalize version
  const finalizeRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}?updateMask=status`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'FINALIZED' }),
    }
  );
  if (!finalizeRes.ok) {
    const body = await finalizeRes.text();
    console.warn(`[tombstone] Finalize version failed (${finalizeRes.status}): ${body}`);
    return;
  }

  // 3. Release (publish)
  const releaseRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/releases?versionName=${encodeURIComponent(versionName)}`,
    { method: 'POST', headers, body: JSON.stringify({}) }
  );
  if (!releaseRes.ok) {
    const body = await releaseRes.text();
    console.warn(`[tombstone] Release failed (${releaseRes.status}): ${body}`);
    return;
  }

  console.log('[tombstone] ✓ Tombstone deployed successfully');
}

async function deleteHostingSite(auth: OAuth2Client, projectId: string, siteId: string): Promise<void> {
  console.log(`[delete-site] Deleting hosting site ${projectId}/${siteId}...`);
  const token = await getToken(auth);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-goog-user-project': PLATFORM_PROJECT,
  };

  // Skip if it's the default site
  if (siteId === projectId || siteId === 'default') {
    console.log('[delete-site] Skipping — cannot delete default site.');
    return;
  }

  const res = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}`,
    { method: 'DELETE', headers }
  );

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`[delete-site] Failed (${res.status}): ${body}`);
  }

  console.log(res.status === 404
    ? '[delete-site] Site already gone (404), OK'
    : '[delete-site] ✓ Hosting site deleted');
}

async function decrementShardCounter(shardId: string): Promise<void> {
  console.log(`[shard] Decrementing activeStores on shard ${shardId}...`);
  const shardRef = db.collection('shards').doc(shardId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(shardRef);
    if (!snap.exists) {
      console.warn(`[shard] Shard ${shardId} not found, skipping.`);
      return;
    }
    const current = snap.data()?.activeStores ?? 0;
    tx.update(shardRef, { activeStores: Math.max(0, current - 1), updatedAt: new Date() });
  });
  console.log('[shard] ✓ activeStores decremented');
}

async function deleteStoreDocuments(storeId: string): Promise<void> {
  console.log(`[firestore] Deleting store documents for ${storeId}...`);
  const storeRef = db.collection('stores').doc(storeId);

  // Delete private subcollection
  const privateDocs = await storeRef.collection('private').listDocuments();
  await Promise.all(privateDocs.map((d) => d.delete()));
  console.log(`[firestore]   - deleted ${privateDocs.length} private docs`);

  // Delete invitations subcollection
  const invitationDocs = await storeRef.collection('invitations').listDocuments();
  await Promise.all(invitationDocs.map((d) => d.delete()));
  console.log(`[firestore]   - deleted ${invitationDocs.length} invitation docs`);

  // Delete store document
  await storeRef.delete();
  console.log('[firestore] ✓ Store document deleted');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
void (async () => {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  Vertex Platform — Manual Store Cleanup: Prueba Tres');
  console.log('════════════════════════════════════════════════════════\n');

  try {
    // Verify store exists
    const storeSnap = await db.collection('stores').doc(STORE_ID).get();
    if (!storeSnap.exists) {
      console.log('✓ Store already deleted from Firestore. Nothing to do.');
      process.exit(0);
    }
    console.log(`✓ Store found: "${storeSnap.data()?.name}" (${STORE_ID})`);
    console.log(`  runtimeMode:  ${storeSnap.data()?.runtimeMode}`);
    console.log(`  runtimeSiteId: ${storeSnap.data()?.runtimeSiteId}`);
    console.log('');

    const auth = await getOwnerOAuthClient();
    console.log('✓ OAuth client obtained\n');

    // Step 1: Tombstone
    await deployTombstone(auth, SHARD_PROJECT_ID, RUNTIME_SITE_ID);
    console.log('');

    // Step 2: Delete Hosting site
    await deleteHostingSite(auth, SHARD_PROJECT_ID, RUNTIME_SITE_ID);
    console.log('');

    // Step 3: Decrement shard counter
    await decrementShardCounter(SHARD_ID);
    console.log('');

    // Step 4: Delete Firestore documents
    await deleteStoreDocuments(STORE_ID);
    console.log('');

    console.log('════════════════════════════════════════════════════════');
    console.log('  ✓ Prueba Tres eliminada exitosamente');
    console.log('════════════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error durante la limpieza:', err);
    process.exit(1);
  }
})();
