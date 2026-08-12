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
 * Ensures that at least 1 pre-provisioned "warm" shared shard (status: 'WARMUP_READY')
 * exists in standby for the current platform environment.
 * If no warm shard exists, it creates and pre-configures a GCP project in the background.
 */
export async function ensureWarmShardAvailable(): Promise<string | null> {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    console.log(
      '[ensureWarmShardAvailable] Emulator mode active. Skipping background warm shard GCP API calls.',
    );
    return null;
  }

  const db = getFirestore();
  const env = resolvePlatformEnvironment(PLATFORM_PROJECT);

  // Check if a warm shard already exists in standby
  const warmSnap = await db
    .collection('infrastructure_shards')
    .where('environment', '==', env)
    .where('status', 'in', ['WARMUP_READY', 'WARMUP_PROVISIONING'])
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

  const shardRef = db.collection('infrastructure_shards').doc(shardId);
  await shardRef.set({
    id: shardId,
    environment: env,
    runtimeMode: 'shared-shard',
    projectId: projectId,
    siteId: 'default',
    region: 'us-central1',
    status: 'WARMUP_PROVISIONING',
    maxCapacity: DEFAULT_MAX_STORES_PER_SHARD,
    currentStores: 0,
    reservedStores: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.info(
    `[ensureWarmShardAvailable] Pre-provisioning warm shard ${shardId} (${projectId})...`,
  );

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

    // 4. Enable Required APIs (WITHOUT appengine.googleapis.com to prevent GCP from creating legacy DATASTORE_MODE databases)
    const apis = [
      'identitytoolkit.googleapis.com',
      'firestore.googleapis.com',
      'firebasehosting.googleapis.com',
      'secretmanager.googleapis.com',
      'cloudresourcemanager.googleapis.com',
      'storage.googleapis.com',
      'firebasestorage.googleapis.com',
    ];
    const enableOp = (await apiFetch(
      auth,
      `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`,
      { method: 'POST', body: { serviceIds: apis } },
    )) as { name: string };
    await pollOperation(auth, enableOp.name, 'https://serviceusage.googleapis.com/v1');

    // 4.5. Initialize Cloud Firestore in FIRESTORE_NATIVE Mode
    try {
      const { ensureServiceEnabled } = await import('./provisioning');
      await ensureServiceEnabled(auth, projectId, 'firestore.googleapis.com');
      const dbOp = (await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=(default)`,
        { method: 'POST', body: { type: 'FIRESTORE_NATIVE', locationId: 'nam5' } },
      )) as { name: string };
      await pollOperation(auth, dbOp.name, 'https://firestore.googleapis.com/v1');
      console.info(
        `[ensureWarmShardAvailable] Initialized FIRESTORE_NATIVE database (default) for ${projectId}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('409')) throw err;
    }

    // 5. Initialize Default Storage Bucket and CORS
    try {
      const bucketName = `${projectId}.firebasestorage.app`;
      await apiFetch(
        auth,
        `https://firebasestorage.googleapis.com/v1beta/projects/${projectId}/defaultBucket`,
        {
          method: 'POST',
          body: { location: 'us-central1' },
        },
      );
      const { configureBucketCors } = await import('./provisioning');
      await configureBucketCors(bucketName);
    } catch (err) {
      console.warn(
        `[ensureWarmShardAvailable] Non-fatal Storage bucket init issue for ${projectId}:`,
        err,
      );
    }

    // 6. Pre-create Web App and cache firebaseConfig for instant zero-latency store provisioning
    try {
      const appOp = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
        { method: 'POST', body: { displayName: `Shard Web App ${randomId}` } },
      )) as { name: string };
      await pollOperation(auth, appOp.name, 'https://firebase.googleapis.com/v1beta1');
      const appsRes = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
      )) as { apps: Array<{ appId: string }> };
      if (appsRes.apps?.length) {
        const appId = appsRes.apps[0].appId;
        const configRes = (await apiFetch(
          auth,
          `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${appId}/config`,
        )) as Record<string, string>;
        const { normalizeStorageBucket } = await import('./provisioning');
        const firebaseConfig = {
          apiKey: configRes['apiKey'],
          authDomain: `${projectId}.firebaseapp.com`,
          projectId: projectId,
          storageBucket: normalizeStorageBucket(projectId, configRes['storageBucket']),
          messagingSenderId: configRes['messagingSenderId'],
          appId: configRes['appId'],
        };
        await shardRef.update({ firebaseConfig });
      }

      // 6.5. Pre-configure Google OAuth IdP provider with Master OAuth credentials
      try {
        const masterProjectId = (await import('./provisioning')).getMasterStorefrontProjectId();
        const masterIdpConfig = (await apiFetch(
          auth,
          `https://identitytoolkit.googleapis.com/v2/projects/${masterProjectId}/defaultSupportedIdpConfigs/google.com`,
          { quotaProject: masterProjectId },
        )) as { clientId?: string; clientSecret?: string };

        if (masterIdpConfig?.clientId && masterIdpConfig?.clientSecret) {
          const bodyData = {
            enabled: true,
            clientId: masterIdpConfig.clientId,
            clientSecret: masterIdpConfig.clientSecret,
          };
          try {
            await apiFetch(
              auth,
              `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/defaultSupportedIdpConfigs?idpId=google.com`,
              {
                method: 'POST',
                body: {
                  ...bodyData,
                  name: `projects/${projectId}/defaultSupportedIdpConfigs/google.com`,
                },
                quotaProject: projectId,
              },
            );
          } catch {
            await apiFetch(
              auth,
              `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/defaultSupportedIdpConfigs/google.com?updateMask=clientId,clientSecret,enabled`,
              {
                method: 'PATCH',
                body: bodyData,
                quotaProject: projectId,
              },
            );
          }
          console.info(
            `[ensureWarmShardAvailable] Pre-configured Google OAuth IdP on warm shard project ${projectId}`,
          );
        }
      } catch (idpErr) {
        console.warn(
          `[ensureWarmShardAvailable] Non-fatal Google OAuth IdP config issue for ${projectId}:`,
          idpErr,
        );
      }
    } catch (err) {
      console.warn(`[ensureWarmShardAvailable] Non-fatal WebApp init issue for ${projectId}:`, err);
    }

    // 7. Auto-deploy initial Firestore security rules and composite indexes
    try {
      const { deployStorefrontRules, ensureCompositeIndexes } = await import('./provisioning');
      await deployStorefrontRules(auth, projectId);
      await ensureCompositeIndexes(auth, projectId);
    } catch (err) {
      console.warn(
        `[ensureWarmShardAvailable] Non-fatal Rules/Indexes deploy issue for ${projectId}:`,
        err,
      );
    }

    // Update shard status to WARMUP_READY
    await shardRef.update({
      status: 'WARMUP_READY',
      updatedAt: new Date(),
    });

    console.info(
      `[ensureWarmShardAvailable] Warm shard ${shardId} (${projectId}) is fully pre-provisioned and READY.`,
    );
    return shardId;
  } catch (err) {
    console.error(`[ensureWarmShardAvailable] Failed to pre-provision warm shard ${shardId}:`, err);
    await shardRef.update({
      status: 'FULL', // Mark as full to exclude failed warmups
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
    const db = getFirestore();
    const env = resolvePlatformEnvironment(PLATFORM_PROJECT);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Purge stale failed warm shard records with 0 active stores
    const staleFailedSnap = await db
      .collection('infrastructure_shards')
      .where('environment', '==', env)
      .where('currentStores', '==', 0)
      .where('status', '==', 'FULL')
      .get();

    for (const doc of staleFailedSnap.docs) {
      const data = doc.data();
      const updatedAt = data['updatedAt']?.toDate
        ? data['updatedAt'].toDate()
        : new Date(data['updatedAt']);
      if (updatedAt < cutoff) {
        console.info(`[checkWarmShardBuffer] Purging stale failed warm shard record ${doc.id}`);
        await doc.ref.delete();
      }
    }

    await ensureWarmShardAvailable();
  });
