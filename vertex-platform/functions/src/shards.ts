import { getFirestore } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { resolvePlatformEnvironment, DEFAULT_MAX_STORES_PER_SHARD } from './runtime';
import {
  PLATFORM_PROJECT,
  getOwnerOAuthClient,
  pickBillingAccount,
  apiFetch,
  pollOperation,
} from './helpers';

/**
 * Ensures that at least 1 pre-provisioned "warm" shared shard (status: 'warmup_ready')
 * exists in standby for the current platform environment.
 * If no warm shard exists, it creates and pre-configures a GCP project in the background.
 */
export async function ensureWarmShardAvailable(): Promise<string | null> {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    console.log('[ensureWarmShardAvailable] Emulator mode active. Skipping background warm shard GCP API calls.');
    return null;
  }

  const db = getFirestore();
  const env = resolvePlatformEnvironment(PLATFORM_PROJECT);

  // Check if a warm shard already exists in standby
  const warmSnap = await db
    .collection('shards')
    .where('environment', '==', env)
    .where('status', 'in', ['warmup_ready', 'warmup_provisioning'])
    .limit(1)
    .get();

  if (!warmSnap.empty) {
    const existing = warmSnap.docs[0];
    console.info(
      `[ensureWarmShardAvailable] Standby warm shard already exists: ${existing.id} (${existing.data()['status']})`,
    );
    return existing.id;
  }

  // Pre-provision a new GCP project as a warm shard
  const randomId = Math.random().toString(36).substring(2, 10);
  const shardId = `shard-${env}-${randomId}`;
  const projectId = `vtx-sd-${randomId}`;

  const shardRef = db.collection('shards').doc(shardId);
  await shardRef.set({
    id: shardId,
    environment: env,
    runtimeMode: 'shared-shard',
    projectId: projectId,
    siteId: 'default',
    region: 'us-central1',
    status: 'warmup_provisioning',
    maxStores: DEFAULT_MAX_STORES_PER_SHARD,
    activeStores: 0,
    reservedStores: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.info(`[ensureWarmShardAvailable] Pre-provisioning warm shard ${shardId} (${projectId})...`);

  try {
    const auth = await getOwnerOAuthClient();

    // 1. Create GCP Project
    try {
      const parentOrgOrFolder = process.env['GCP_ORGANIZATION_ID']
        ? { parent: { type: 'organization', id: process.env['GCP_ORGANIZATION_ID'] } }
        : process.env['GCP_FOLDER_ID']
          ? { parent: { type: 'folder', id: process.env['GCP_FOLDER_ID'] } }
          : {};
      const op = (await apiFetch(auth, 'https://cloudresourcemanager.googleapis.com/v3/projects', {
        method: 'POST',
        body: {
          projectId,
          displayName: `Vertex Shard ${randomId}`,
          ...parentOrgOrFolder,
        },
      })) as { name: string };
      await pollOperation(auth, op.name, 'https://cloudresourcemanager.googleapis.com/v3');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('409')) throw err;
    }

    // 2. Link Billing
    const billingAccountId = await pickBillingAccount(db);
    await apiFetch(
      auth,
      `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
      {
        method: 'PUT',
        body: { billingAccountName: `billingAccounts/${billingAccountId}` },
      },
    );

    // 3. Add Firebase
    try {
      const fbOp = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
        { method: 'POST', body: {} },
      )) as { name: string };
      await pollOperation(auth, fbOp.name, 'https://firebase.googleapis.com/v1beta1');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('409')) throw err;
    }

    // 4. Enable Required APIs
    const apis = [
      'identitytoolkit.googleapis.com',
      'firestore.googleapis.com',
      'firebasehosting.googleapis.com',
      'secretmanager.googleapis.com',
      'cloudresourcemanager.googleapis.com',
    ];
    const enableOp = (await apiFetch(
      auth,
      `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`,
      { method: 'POST', body: { serviceIds: apis } },
    )) as { name: string };
    await pollOperation(auth, enableOp.name, 'https://serviceusage.googleapis.com/v1');

    // Update shard status to warmup_ready
    await shardRef.update({
      status: 'warmup_ready',
      updatedAt: new Date(),
    });

    console.info(`[ensureWarmShardAvailable] Warm shard ${shardId} (${projectId}) is fully pre-provisioned and READY.`);
    return shardId;
  } catch (err) {
    console.error(`[ensureWarmShardAvailable] Failed to pre-provision warm shard ${shardId}:`, err);
    await shardRef.update({
      status: 'full', // Mark as full to exclude failed warmups
      updatedAt: new Date(),
    });
    return null;
  }
}

/**
 * Scheduled Cloud Function to ensure a warm shard is always available in standby.
 * Runs every 6 hours or on demand.
 */
export const checkWarmShardBuffer = functions.pubsub
  .schedule('0 */6 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    await ensureWarmShardAvailable();
  });
