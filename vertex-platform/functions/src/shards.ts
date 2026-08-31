import { getFirestore } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { resolvePlatformEnvironment, DEFAULT_MAX_STORES_PER_SHARD } from './runtime';
import {
  PLATFORM_PROJECT,
  getOwnerOAuthClient,
  pickBillingAccount,
  apiFetch,
  pollOperation,
  sendDirectEmail,
} from './helpers';

/**
 * Lee una variable de entorno numérica con fallback seguro (evita NaN con
 * valores basura que romperían la lógica de pool/alertas).
 */
function readEnvInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : fallback;
}

/**
 * Umbral de pool bajo: cuando quedan ≤ POOL_LOW_THRESHOLD shards disponibles
 * (WARMUP_READY + ACTIVE con cupo), se dispara la alerta (in-app + email).
 * "Disponible" = puede recibir tiendas nuevas sin configuración.
 * Configurable por entorno con POOL_LOW_THRESHOLD.
 */
export const POOL_LOW_THRESHOLD = readEnvInt('POOL_LOW_THRESHOLD', 25);

/** Emails a los que llegan las notificaciones de pool bajo. */
const POOL_ALERT_EMAILS = (
  process.env['POOL_ALERT_EMAIL'] ||
  'juan.l.espeche@gmail.com,leivalihue@gmail.com,vertex.tech.dev@gmail.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Devuelve cuántos shards disponibles (con cupo) hay para el entorno. */
export async function countAvailableShards(
  db: FirebaseFirestore.Firestore,
  env: string,
): Promise<number> {
  const snap = await db.collection('infrastructure_shards').where('environment', '==', env).get();
  let available = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const status = data['status'] as string;
    const current = Number(data['currentStores'] ?? 0);
    const maxCap = Number(data['maxCapacity'] ?? DEFAULT_MAX_STORES_PER_SHARD);
    if (status === 'WARMUP_READY' || (status === 'ACTIVE' && current < maxCap)) {
      available++;
    }
  }
  return available;
}

/**
 * Detecta pool bajo y notifica (in-app + email) con dedupe de 24h.
 * El flag in-app lo lee el panel (stores-list) para mostrar el banner.
 */
export async function checkPoolLowAndAlert(
  db: FirebaseFirestore.Firestore,
  env: string,
): Promise<number> {
  const available = await countAvailableShards(db, env);
  const shortEnv = env === 'production' ? 'prod' : 'dev';
  const alertRef = db.collection('system_alerts').doc(`pool_low_${env}`);
  const shortAlertRef = db.collection('system_alerts').doc(`pool_low_${shortEnv}`);

  // Recomendación: cuántos shards crear de un tirón para volver al objetivo del scheduler.
  const WARM_SHARD_TARGET = readEnvInt('WARM_SHARD_TARGET', 10);
  const recommendedCount = Math.max(WARM_SHARD_TARGET, 10);

  if (available > POOL_LOW_THRESHOLD) {
    // Pool OK: limpiar la alerta activa si existía.
    const clearPayload = {
      active: false,
      updatedAt: new Date(),
    };
    await Promise.all([alertRef.set(clearPayload), shortAlertRef.set(clearPayload)]);
    return available;
  }

  const alertSnap = await alertRef.get();
  const lastAlertedAt = alertSnap.exists
    ? (alertSnap.data()?.['lastAlertedAt']?.toDate?.() ?? new Date(0))
    : new Date(0);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const shouldNotify = lastAlertedAt < oneDayAgo;

  const command = `npx tsx scripts/provision-shards.ts --target ${recommendedCount} --env ${shortEnv}`;
  const alertData = {
    active: true,
    availableShards: available,
    threshold: POOL_LOW_THRESHOLD,
    recommendedCount,
    command,
    lastAlertedAt: shouldNotify ? new Date() : lastAlertedAt,
    updatedAt: new Date(),
  };

  await Promise.all([alertRef.set(alertData), shortAlertRef.set(alertData)]);

  if (shouldNotify) {
    console.warn(
      `[checkPoolLowAndAlert] Pool bajo (${available} ≤ ${POOL_LOW_THRESHOLD}) — notificando a ${POOL_ALERT_EMAILS.join(', ')}`,
    );
    for (const recipient of POOL_ALERT_EMAILS) {
      try {
        await sendDirectEmail(
          recipient,
          `⚠️ Vertex — Pool de shards bajo (${available} disponibles)`,
          `<p>El pool de shards de <strong>${env}</strong> está bajo:</p>
           <p><strong>${available}</strong> shard(s) disponible(s) (umbral: ${POOL_LOW_THRESHOLD}).</p>
           <p>Provisioná <strong>${recommendedCount}</strong> shards de un tirón con:
           <code>${command}</code></p>
           <p>Después registrá los redirect URIs que imprime el script (paso manual en
           Google Cloud Console, una vez por shard) y verificá con
           <code>npx tsx scripts/check-oauth-redirects.ts</code>.</p>
           <p>O el scheduler lo hará automáticamente (WARM_SHARD_TARGET=${WARM_SHARD_TARGET}).</p>`,
          `Pool de shards bajo (${available} disponibles) en ${env}. Ejecutá: ${command}`,
        );
      } catch (err) {
        console.error(`[checkPoolLowAndAlert] Falló el envío del email a ${recipient}:`, err);
      }
    }
  }
  return available;
}

/**
 * Ensures that at least 1 pre-provisioned "warm" shared shard (status: 'WARMUP_READY')
 * exists in standby for the current platform environment.
 * If no warm shard exists, it creates and pre-configures a GCP project in the background.
 */
export async function ensureWarmShardAvailable(forceCreate = false): Promise<string | null> {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    console.log(
      '[ensureWarmShardAvailable] Emulator mode active. Skipping background warm shard GCP API calls.',
    );
    return null;
  }

  const db = getFirestore();
  const env = resolvePlatformEnvironment(PLATFORM_PROJECT);

  // Check if a warm shard already exists in standby (salvo forceCreate — usado por
  // el scheduler para rellenar el pool hasta el objetivo, creando shards nuevos).
  const warmSnap = await db
    .collection('infrastructure_shards')
    .where('environment', '==', env)
    .where('status', 'in', ['WARMUP_READY', 'WARMUP_PROVISIONING'])
    .limit(1)
    .get();

  if (!warmSnap.empty && !forceCreate) {
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

      // 6.6. Ensure API Key referrer restrictions are cleared so multi-tenant hosting domains are allowed
      try {
        const numericProjectRes = (await apiFetch(
          auth,
          `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
        )) as { projectNumber?: string };
        const projectNumber = numericProjectRes.projectNumber;
        if (projectNumber) {
          const keysRes = (await apiFetch(
            auth,
            `https://apikeys.googleapis.com/v2/projects/${projectNumber}/locations/global/keys`,
          )) as { keys?: Array<{ name: string; restrictions?: Record<string, unknown> }> };
          for (const key of keysRes.keys || []) {
            if (key.restrictions && Object.keys(key.restrictions).length > 0) {
              await apiFetch(
                auth,
                `https://apikeys.googleapis.com/v2/${key.name}?updateMask=restrictions`,
                {
                  method: 'PATCH',
                  body: { restrictions: {} },
                },
              );
              console.info(
                `[ensureWarmShardAvailable] Cleared API key restrictions on ${key.name}`,
              );
            }
          }
        }
      } catch (apiKeyErr) {
        console.warn(
          `[ensureWarmShardAvailable] Non-fatal API Key restriction clear issue for ${projectId}:`,
          apiKeyErr,
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

    // Purge stale failed warm shard records with 0 active stores.
    // FULL: fallo conocido. WARMUP_PROVISIONING: quedó colgado (función murió a
    // mitad de provisioning) y no debe contar para el objetivo ni ocupar cupo.
    const staleFailedSnap = await db
      .collection('infrastructure_shards')
      .where('environment', '==', env)
      .where('currentStores', '==', 0)
      .where('status', 'in', ['FULL', 'WARMUP_PROVISIONING'])
      .get();

    for (const doc of staleFailedSnap.docs) {
      const data = doc.data();
      const updatedAt = data['updatedAt']?.toDate
        ? data['updatedAt'].toDate()
        : new Date(data['updatedAt']);
      // FULL: >24h. WARMUP_PROVISIONING: >12h (un ciclo de scheduler completo).
      const staleAfter = data['status'] === 'WARMUP_PROVISIONING' ? 12 * 3600_000 : 24 * 3600_000;
      if (updatedAt < new Date(Date.now() - staleAfter)) {
        console.info(
          `[checkWarmShardBuffer] Purging stale ${data['status']} shard record ${doc.id} (updatedAt ${updatedAt.toISOString()})`,
        );
        await doc.ref.delete();
      }
    }

    // ── Pool objetivo: mantener al menos WARM_SHARD_TARGET shards calientes ──
    // Así el pool de capacidad queda profundo sin configuración manual:
    // el scheduler provisiona shards nuevos hasta alcanzar el objetivo.
    // Default 10 (configurable con WARM_SHARD_TARGET).
    const WARM_SHARD_TARGET = readEnvInt('WARM_SHARD_TARGET', 10);
    const warmSnap = await db
      .collection('infrastructure_shards')
      .where('environment', '==', env)
      .where('status', 'in', ['WARMUP_READY', 'WARMUP_PROVISIONING'])
      .get();
    const warmCount = warmSnap.size;
    if (warmCount < WARM_SHARD_TARGET) {
      const toCreate = Math.max(0, WARM_SHARD_TARGET - warmCount); // crear hasta el objetivo
      console.info(
        `[checkWarmShardBuffer] Pool caliente bajo: ${warmCount}/${WARM_SHARD_TARGET}. Provisionando ${toCreate} shard(s)...`,
      );
      let consecutiveFailures = 0;
      for (let i = 0; i < toCreate; i++) {
        // forceCreate: ignora el short-circuit de "ya existe un warm" para rellenar
        // el pool hasta el objetivo (sin esto solo se creaba 1 shard).
        const created = await ensureWarmShardAvailable(true);
        if (!created) {
          consecutiveFailures++;
          if (consecutiveFailures >= 2) {
            console.warn(
              '[checkWarmShardBuffer] Fallos consecutivos al provisionar (¿cuota de proyectos GCP agotada?). Abortando el ciclo para no contaminar el pool.',
            );
            break;
          }
        } else {
          consecutiveFailures = 0;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } else {
      console.info(`[checkWarmShardBuffer] Pool caliente OK: ${warmCount}/${WARM_SHARD_TARGET}`);
    }

    // ── Alerta de pool bajo (in-app + email, dedupe 24h) ──
    const available = await checkPoolLowAndAlert(db, env);
    console.info(`[checkWarmShardBuffer] Shards disponibles: ${available}`);
  });
