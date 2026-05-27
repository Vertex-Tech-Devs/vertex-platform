import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import type { OAuth2Client } from 'google-auth-library';
import type {
  CreateStorePayload,
  StepStatus,
  ProvisioningStep,
  StoreRuntimeMode,
  StoreShard,
} from './types';
import {
  ALLOWED_ORIGINS,
  PLATFORM_PROJECT,
  getOwnerOAuthClient,
  getGitHubPat,
  apiFetch,
  retry,
  pollOperation,
  pickBillingAccount,
  listProvisioningOwnerCandidates,
} from './helpers';
import { seedStoreData } from './seeds';
import { resolvePlatformEnvironment, getAvailableShardSlots } from './runtime';

const CURRENT_TEMPLATE_VERSION = '1.0.0';
const CURRENT_STORE_SCHEMA_VERSION = 1;

export const provisionStore = onCall<CreateStorePayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can provision stores.');
    }

    const {
      name,
      slug,
      ownerEmail,
      logoUrl,
      customDomain,
      verticalId,
      includeMockData = true,
      dedicatedProject,
    } = request.data;

    if (!name?.trim() || !ownerEmail?.trim()) {
      throw new HttpsError('invalid-argument', 'name and ownerEmail are required.');
    }
    if (!/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/.test(slug)) {
      throw new HttpsError(
        'invalid-argument',
        'slug must be 3–20 lowercase letters, numbers, or hyphens, and cannot start or end with a hyphen.',
      );
    }

    const db = getFirestore();
    const existingSlug = await db.collection('stores').where('slug', '==', slug).limit(1).get();
    if (!existingSlug.empty) {
      throw new HttpsError('already-exists', `A store with slug "${slug}" already exists.`);
    }

    // Dynamic Shard Selection logic: Recommend and use shared-shard by default if active shard capacity is available
    const env = resolvePlatformEnvironment(PLATFORM_PROJECT);
    const shardsSnap = await db
      .collection('shards')
      .where('environment', '==', env)
      .where('status', '==', 'active')
      .get();

    let selectedShard: StoreShard | null = null;
    let maxAvailableSlots = 0;

    (shardsSnap?.docs || []).forEach((doc) => {
      const shard = { id: doc.id, ...doc.data() } as StoreShard;
      const availableSlots = getAvailableShardSlots(shard);
      if (availableSlots > maxAvailableSlots) {
        maxAvailableSlots = availableSlots;
        selectedShard = shard;
      }
    });

    let runtimeMode: StoreRuntimeMode = 'shared-shard';
    let shardId: string | null = null;
    let projectId = `vtx-${slug}`.slice(0, 30);
    let runtimeSiteId = 'default';
    let isNewShard = false;

    if (dedicatedProject === true) {
      runtimeMode = 'dedicated-project';
      projectId = `vtx-${slug}`.slice(0, 30);
      runtimeSiteId = 'default';
    } else {
      if (selectedShard) {
        runtimeMode = 'shared-shard';
        shardId = (selectedShard as StoreShard).id;
        projectId = (selectedShard as StoreShard).projectId;
        runtimeSiteId = `vtx-${slug}`.slice(0, 30);
        isNewShard = false;
      } else {
        // Generate a new shared-shard project autonomously!
        runtimeMode = 'shared-shard';
        isNewShard = true;
        const randomId = crypto.randomUUID().slice(0, 8);
        shardId = `shard-${env}-${randomId}`;
        projectId = `vtx-sd-${randomId}`;
        runtimeSiteId = `vtx-${slug}`.slice(0, 30);
      }
    }

    const storeId = crypto.randomUUID();
    const tenantId = slug;

    const needsNewGcpProject = runtimeMode === 'dedicated-project' || isNewShard;
    let billingAccountId: string | null = null;
    if (needsNewGcpProject) {
      try {
        billingAccountId = await pickBillingAccount(db);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new HttpsError('resource-exhausted', msg);
      }

      try {
        await listProvisioningOwnerCandidates(db);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new HttpsError('resource-exhausted', msg);
      }
    }

    const skipGcpSteps = runtimeMode === 'shared-shard' && !isNewShard;
    const steps: Record<string, ProvisioningStep> = {
      createProject: { status: skipGcpSteps ? 'done' : 'pending', label: 'Crear proyecto GCP' },
      linkBilling: { status: skipGcpSteps ? 'done' : 'pending', label: 'Vincular facturación' },
      addFirebase: { status: skipGcpSteps ? 'done' : 'pending', label: 'Activar Firebase' },
      enableApis: { status: skipGcpSteps ? 'done' : 'pending', label: 'Habilitar APIs' },
      createWebApp: { status: 'pending', label: 'Crear app web' },
      initFirestore: { status: 'pending', label: 'Inicializar Firestore' },
      configureEmail: { status: 'pending', label: 'Configurar sistema de emails' },
      initAdmin: { status: 'pending', label: 'Crear usuario administrador' },
      grantAccess: { status: 'pending', label: 'Configurar permisos de deploy' },
      triggerDeploy: { status: 'pending', label: 'Desplegar tienda' },
    };

    await db
      .collection('stores')
      .doc(storeId)
      .set({
        id: storeId,
        name,
        slug,
        ownerEmail,
        logoUrl: logoUrl ?? null,
        customDomain: customDomain ?? null,
        verticalId: verticalId ?? null,
        runtimeMode,
        tenantId,
        shardId,
        runtimeProjectId: projectId,
        runtimeSiteId,
        firebaseProjectId: projectId,
        defaultUrl:
          runtimeMode === 'shared-shard'
            ? `https://${runtimeSiteId}.web.app`
            : `https://${projectId}.web.app`,
        billingAccountId,
        isNewShard,
        includeMockData: includeMockData !== false,
        status: 'provisioning',
        provisioningSteps: steps,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return { storeId, projectId };
  },
);

async function executeProvisioningSteps(storeId: string): Promise<void> {
  const db = getFirestore();
  const storeRef = db.collection('stores').doc(storeId);

  const currentSnap = await storeRef.get();
  const currentData = currentSnap.data();
  if (!currentData || !['provisioning', 'error'].includes(currentData['status'])) return;

  const {
    name,
    logoUrl,
    ownerEmail,
    firebaseProjectId: projectId,
    billingAccountId,
    verticalId,
    includeMockData,
    runtimeMode,
    runtimeSiteId,
    isNewShard,
  } = currentData as {
    name: string;
    logoUrl: string | null;
    ownerEmail: string;
    firebaseProjectId: string;
    billingAccountId: string;
    verticalId?: string;
    includeMockData?: boolean;
    runtimeMode?: StoreRuntimeMode;
    runtimeSiteId?: string;
    isNewShard?: boolean;
  };
  let provisioningOwnerId =
    typeof currentData['provisioningOwnerId'] === 'string'
      ? (currentData['provisioningOwnerId'] as string)
      : undefined;

  const currentSteps = (currentData['provisioningSteps'] ?? {}) as Record<string, ProvisioningStep>;
  const isDone = (stepId: string): boolean => currentSteps[stepId]?.status === 'done';

  const setStep = async (id: string, status: StepStatus, error?: string): Promise<void> => {
    await storeRef.update({
      [`provisioningSteps.${id}.status`]: status,
      ...(error ? { [`provisioningSteps.${id}.error`]: error } : {}),
      updatedAt: new Date(),
    });
  };

  const isProjectQuotaExceeded = (value: string): boolean => {
    const normalized = value.toLowerCase();
    return (
      normalized.includes('exceeded your allotted project quota') ||
      normalized.includes('project quota') ||
      normalized.includes('quota exceeded for projects') ||
      normalized.includes('cuota de creación de proyectos')
    );
  };

  const assignProvisioningOwner = async (ownerId: string): Promise<OAuth2Client> => {
    const nextAuth = await getOwnerOAuthClient(ownerId);
    if (provisioningOwnerId !== ownerId) {
      provisioningOwnerId = ownerId;
      await storeRef.update({ provisioningOwnerId: ownerId, updatedAt: new Date() });
    }
    return nextAuth;
  };

  const formatProvisioningError = (stepId: string, err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const normalized = raw.toLowerCase();

    if (
      stepId === 'createProject' &&
      (isProjectQuotaExceeded(raw) ||
        normalized.includes('all provisioning owner accounts are at capacity'))
    ) {
      return 'No se pudo crear el proyecto GCP porque las credenciales de aprovisionamiento agotaron su capacidad de alta de proyectos. Agregá otra cuenta en platform-owner-credentials-pool o aumentá la cuota de Google Cloud y luego reintentá.';
    }

    if (
      stepId === 'linkBilling' &&
      (normalized.includes('cloud billing quota exceeded') ||
        normalized.includes('failed_precondition') ||
        normalized.includes('billing quota'))
    ) {
      return 'No se pudo vincular la facturacion porque la cuota de Cloud Billing fue excedida para la cuenta seleccionada. Aumenta la cuota o usa otra cuenta de facturacion: https://support.google.com/code/contact/billing_quota_increase';
    }

    if (
      stepId === 'linkBilling' &&
      (normalized.includes('permission_denied') ||
        normalized.includes('does not have permission') ||
        normalized.includes('403 forbidden'))
    ) {
      return 'No se pudo vincular la facturacion porque las credenciales de aprovisionamiento no tienen permisos suficientes sobre la cuenta de facturacion. Otorga roles billing.user / billing.projectManager a la cuenta de aprovisionamiento y reintenta.';
    }

    if (raw.length > 800) {
      return `${raw.slice(0, 800)}...`;
    }

    return raw;
  };

  const fail = async (stepId: string, err: unknown): Promise<void> => {
    const msg = formatProvisioningError(stepId, err);
    console.error(`[provisioning:${stepId}]`, err);
    await setStep(stepId, 'error', msg);
    await storeRef.update({ status: 'error', updatedAt: new Date() });
  };

  let auth: OAuth2Client;
  try {
    auth = provisioningOwnerId
      ? await getOwnerOAuthClient(provisioningOwnerId)
      : await getOwnerOAuthClient();
  } catch {
    await storeRef.update({ status: 'error', updatedAt: new Date() });
    return;
  }

  // Verify that the GCP project exists and is active if createProject is already marked as done
  let projectIsActive = false;
  if (isDone('createProject')) {
    try {
      const projRes = (await apiFetch(
        auth,
        `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`,
      )) as { state: string };
      if (projRes.state === 'ACTIVE') {
        projectIsActive = true;
      }
    } catch {
      // If the project doesn't exist or is inaccessible, projectIsActive remains false
    }
  }

  if (isDone('createProject') && !projectIsActive) {
    const suffix = `-${Math.random().toString(36).substring(2, 6)}`;
    const newProjectId = `${projectId.substring(0, 30 - suffix.length)}${suffix}`;

    await storeRef.update({
      firebaseProjectId: newProjectId,
      runtimeProjectId: newProjectId,
      defaultUrl: `https://${newProjectId}.web.app`,
      'provisioningSteps.createProject.status': 'pending',
      'provisioningSteps.createProject.error': null,
      'provisioningSteps.linkBilling.status': 'pending',
      'provisioningSteps.linkBilling.error': null,
      'provisioningSteps.addFirebase.status': 'pending',
      'provisioningSteps.addFirebase.error': null,
      'provisioningSteps.enableApis.status': 'pending',
      'provisioningSteps.enableApis.error': null,
      'provisioningSteps.createWebApp.status': 'pending',
      'provisioningSteps.createWebApp.error': null,
      'provisioningSteps.initFirestore.status': 'pending',
      'provisioningSteps.initFirestore.error': null,
      'provisioningSteps.configureEmail.status': 'pending',
      'provisioningSteps.configureEmail.error': null,
      'provisioningSteps.initAdmin.status': 'pending',
      'provisioningSteps.initAdmin.error': null,
      'provisioningSteps.grantAccess.status': 'pending',
      'provisioningSteps.grantAccess.error': null,
      'provisioningSteps.triggerDeploy.status': 'pending',
      'provisioningSteps.triggerDeploy.error': null,
      updatedAt: new Date(),
    });

    await executeProvisioningSteps(storeId);
    return;
  }

  // ── Step 1: Create GCP project ─────────────────────────────────────────
  if (!isDone('createProject')) {
    await setStep('createProject', 'running');
    try {
      const maxQuotaRetryRounds = 3;
      let createProjectError: unknown = null;

      for (let round = 1; round <= maxQuotaRetryRounds; round++) {
        const ownerCandidates = await listProvisioningOwnerCandidates(db, provisioningOwnerId);
        let created = false;

        for (const candidate of ownerCandidates) {
          try {
            auth = await assignProvisioningOwner(candidate.id);
            const op = (await apiFetch(
              auth,
              'https://cloudresourcemanager.googleapis.com/v3/projects',
              {
                method: 'POST',
                body: { projectId, displayName: name },
              },
            )) as { name: string };
            await pollOperation(auth, op.name, 'https://cloudresourcemanager.googleapis.com/v3');
            createProjectError = null;
            created = true;
            break;
          } catch (err) {
            createProjectError = err;
            const raw = err instanceof Error ? err.message : String(err);
            const isQuotaError = isProjectQuotaExceeded(raw);
            const isLastCandidate =
              candidate.id === ownerCandidates[ownerCandidates.length - 1]?.id;

            if (!isQuotaError || isLastCandidate) {
              if (!isQuotaError) {
                throw err;
              }
              continue;
            }

            console.warn(
              `[provisioning:createProject] El owner ${candidate.id} agotó su cuota de proyectos. Reintentando con otra credencial.`,
            );
          }
        }

        if (created) {
          break;
        }

        const raw =
          createProjectError instanceof Error
            ? createProjectError.message
            : String(createProjectError);
        if (!isProjectQuotaExceeded(raw) || round === maxQuotaRetryRounds) {
          throw createProjectError;
        }

        const delayMs = 20000 * round;
        console.warn(
          `[provisioning:createProject] Cuota de creación de proyectos agotada en la ronda ${round}/${maxQuotaRetryRounds}. Reintentando en ${Math.round(delayMs / 1000)}s.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (createProjectError) throw createProjectError;

      await setStep('createProject', 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('409')) {
        await fail('createProject', err);
        return;
      }
      await setStep('createProject', 'done');
    }
  }

  // ── Step 2: Link billing ───────────────────────────────────────────────
  if (!isDone('linkBilling')) {
    await setStep('linkBilling', 'running');
    try {
      let activeBillingAccountId = billingAccountId;
      let success = false;
      let attemptsLeft = 3; // Permitir reintentar con hasta 3 cuentas de facturación distintas
      let lastError: unknown;

      while (attemptsLeft > 0 && !success) {
        try {
          await retry(
            () =>
              apiFetch(
                auth,
                `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
                {
                  method: 'PUT',
                  body: { billingAccountName: `billingAccounts/${activeBillingAccountId}` },
                },
              ),
            3,
            4000,
          );
          success = true;
        } catch (err) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          const normalized = errMsg.toLowerCase();

          // Si es un error de cuota/límite de facturación en GCP, desactivamos la cuenta en BD y buscamos otra
          if (
            normalized.includes('cloud billing quota exceeded') ||
            normalized.includes('failed_precondition') ||
            normalized.includes('quota') ||
            normalized.includes('billing quota') ||
            normalized.includes('limit exceeded')
          ) {
            console.warn(
              `[provisioning:linkBilling] La cuenta de facturación ${activeBillingAccountId} falló por cuota excedida. Desactivándola y reintentando con otra.`,
            );

            try {
              // Desactivar la cuenta fallida para que el motor no la vuelva a seleccionar
              await db.collection('billingAccounts').doc(activeBillingAccountId).update({
                active: false,
                deactivatedReason: 'Cuota de proyectos excedida en GCP',
                deactivatedAt: new Date(),
              });

              // Buscar y seleccionar una nueva cuenta de facturación activa
              const newAccountId = await pickBillingAccount(db);
              console.info(
                `[provisioning:linkBilling] Nueva cuenta de facturación seleccionada: ${newAccountId}`,
              );

              // Actualizar el ID en la variable local y en el documento de la tienda en Firestore
              activeBillingAccountId = newAccountId;
              await storeRef.update({ billingAccountId: newAccountId });
              attemptsLeft--;
            } catch (selectErr) {
              console.error(
                '[provisioning:linkBilling] No se pudo encontrar otra cuenta de facturación de reemplazo activa:',
                selectErr,
              );
              throw err; // Relanzar el error original de facturación si no hay reemplazo
            }
          } else {
            throw err; // Relanzar si es otro tipo de error de red o API
          }
        }
      }

      if (success) {
        await setStep('linkBilling', 'done');
      } else {
        throw lastError ?? new Error('Failed to link billing account after retries.');
      }
    } catch (err) {
      await fail('linkBilling', err);
      return;
    }
  }

  // ── Step 3: Add Firebase ───────────────────────────────────────────────
  if (!isDone('addFirebase')) {
    await setStep('addFirebase', 'running');
    try {
      const op = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
        { method: 'POST', body: {} },
      )) as { name: string };
      await pollOperation(auth, op.name, 'https://firebase.googleapis.com/v1beta1');
      await setStep('addFirebase', 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already') && !msg.includes('409')) {
        await fail('addFirebase', err);
        return;
      }
      await setStep('addFirebase', 'done');
    }
  }

  // ── Step 4: Enable APIs ────────────────────────────────────────────────
  if (!isDone('enableApis')) {
    await setStep('enableApis', 'running');
    try {
      const enableOp = (await apiFetch(
        auth,
        `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`,
        {
          method: 'POST',
          body: {
            serviceIds: [
              'firestore.googleapis.com',
              'identitytoolkit.googleapis.com',
              'storage.googleapis.com',
              'cloudresourcemanager.googleapis.com',
            ],
          },
        },
      )) as { name: string; done?: boolean };
      if (!enableOp.done) {
        await pollOperation(auth, enableOp.name, 'https://serviceusage.googleapis.com/v1');
      }
      await setStep('enableApis', 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already') && !msg.includes('409')) {
        await fail('enableApis', err);
        return;
      }
      await setStep('enableApis', 'done');
    }
  }

  // If this store provisioning was marked as creating a new shard, register it in the 'shards' collection!
  if (isDone('enableApis') && isNewShard === true) {
    const env = resolvePlatformEnvironment(PLATFORM_PROJECT);
    const shardId = currentData['shardId'] || `shard-${env}-${projectId}`;
    const shardRef = db.collection('shards').doc(shardId);

    const shardSnap = await shardRef.get();
    if (!shardSnap.exists) {
      await shardRef.set({
        id: shardId,
        environment: env,
        runtimeMode: 'shared-shard',
        projectId: projectId,
        siteId: 'default',
        region: 'us-central1',
        status: 'active',
        maxStores: 100, // Capacity for the new shard
        activeStores: 0,
        reservedStores: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.info(
        `[provisioning:enableApis] Successfully registered new shared shard ${shardId} in Firestore shards collection.`,
      );
    }
  }

  // ── Step 5: Create web app and get config ──────────────────────────────
  let firebaseConfig: Record<string, string>;
  if (isDone('createWebApp')) {
    const configSnap = await db
      .collection('stores')
      .doc(storeId)
      .collection('private')
      .doc('firebaseConfig')
      .get();
    firebaseConfig = configSnap.data() as Record<string, string>;
  } else {
    await setStep('createWebApp', 'running');
    try {
      if (runtimeMode === 'shared-shard' && runtimeSiteId) {
        try {
          await apiFetch(
            auth,
            `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites?siteId=${runtimeSiteId}`,
            {
              method: 'POST',
              body: { type: 'USER_SITE' },
            },
          );
          console.info(
            `[provisioning:createWebApp] Created custom hosting site ${runtimeSiteId} on shard ${projectId}`,
          );
        } catch (err: any) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('already exists') && !msg.includes('409')) {
            throw err;
          }
          console.info(
            `[provisioning:createWebApp] Custom hosting site ${runtimeSiteId} already exists on shard ${projectId}`,
          );
        }
      }

      const appOp = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
        { method: 'POST', body: { displayName: name } },
      )) as { name: string };
      await pollOperation(auth, appOp.name, 'https://firebase.googleapis.com/v1beta1');

      const appsRes = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
      )) as { apps: Array<{ appId: string }> };
      const appId = appsRes.apps[0].appId;

      const configRes = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${appId}/config`,
      )) as Record<string, string>;

      firebaseConfig = {
        apiKey: configRes['apiKey'],
        authDomain: configRes['authDomain'],
        projectId: configRes['projectId'],
        storageBucket: configRes['storageBucket'],
        messagingSenderId: configRes['messagingSenderId'],
        appId: configRes['appId'],
      };

      await db
        .collection('stores')
        .doc(storeId)
        .collection('private')
        .doc('firebaseConfig')
        .set(firebaseConfig);
      await setStep('createWebApp', 'done');
    } catch (err) {
      await fail('createWebApp', err);
      return;
    }
  }

  // ── Step 6: Init Firestore + seed store config ─────────────────────────
  if (!isDone('initFirestore')) {
    await setStep('initFirestore', 'running');
    try {
      try {
        const dbOp = (await apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=(default)`,
          { method: 'POST', body: { type: 'FIRESTORE_NATIVE', locationId: 'nam5' } },
        )) as { name: string };
        await pollOperation(auth, dbOp.name, 'https://firestore.googleapis.com/v1');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already exists') && !msg.includes('409')) throw err;
      }

      const now = new Date().toISOString();
      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/storeConfig`,
            {
              method: 'PATCH',
              body: {
                fields: {
                  storeName: { stringValue: name },
                  strapline: { stringValue: '' },
                  logoUrl: logoUrl ? { stringValue: logoUrl } : { nullValue: null },
                  contact: {
                    mapValue: {
                      fields: {
                        email: { stringValue: ownerEmail },
                        phone: { stringValue: '' },
                        whatsapp: { stringValue: '' },
                      },
                    },
                  },
                  seo: {
                    mapValue: {
                      fields: {
                        metaTitle: { stringValue: name },
                        metaDescription: { stringValue: `Bienvenido a ${name}` },
                      },
                    },
                  },
                  features: {
                    mapValue: {
                      fields: {
                        reviewsEnabled: { booleanValue: false },
                        wishlistEnabled: { booleanValue: false },
                        blogEnabled: { booleanValue: false },
                      },
                    },
                  },
                  payments: {
                    mapValue: {
                      fields: {
                        mercadoPago: {
                          mapValue: {
                            fields: {
                              publicKey: { stringValue: '' },
                              accessTokenSecret: { stringValue: 'mp-access-token' },
                              accessTokenMasked: { stringValue: '' },
                              webhookUrl: { stringValue: '' },
                              validationStatus: { stringValue: 'pending' },
                              validationMessage: { stringValue: 'Sin token configurado.' },
                            },
                          },
                        },
                      },
                    },
                  },
                  currency: { stringValue: 'ARS' },
                  currencySymbol: { stringValue: '$' },
                  country: { stringValue: 'AR' },
                  createdAt: { timestampValue: now },
                  updatedAt: { timestampValue: now },
                },
              },
            },
          ),
        5,
        6000,
      );

      if (includeMockData !== false) {
        const effectiveVerticalId = verticalId || 'retail';
        await seedStoreData(auth, projectId, effectiveVerticalId, name, true, true);
      }

      await setStep('initFirestore', 'done');
    } catch (err) {
      await fail('initFirestore', err);
      return;
    }
  }

  // ── Step 6.1: Configure email system defaults ─────────────────────────
  if (!isDone('configureEmail')) {
    await setStep('configureEmail', 'running');
    try {
      const now = new Date().toISOString();

      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/emailTemplates`,
            {
              method: 'PATCH',
              body: {
                fields: {
                  storeOwnerEmail: { stringValue: ownerEmail },
                  storeWhatsappNumber: { stringValue: '' },
                  storeName: { stringValue: name },
                  adminNotification: {
                    mapValue: {
                      fields: {
                        subject: { stringValue: `Nuevo pedido recibido en ${name} - #{orderId}` },
                        template: {
                          stringValue:
                            '<h2>Nuevo pedido #{orderId}</h2><p>Cliente: {clientName}</p><p>Email: {clientEmail}</p><p>Teléfono: {clientPhone}</p><p>Items: {itemsList}</p><p>Total: ${totalAmount}</p>',
                        },
                        showManageButton: { booleanValue: true },
                        showWhatsappButton: { booleanValue: true },
                      },
                    },
                  },
                  customerConfirmation: {
                    mapValue: {
                      fields: {
                        subject: { stringValue: `Confirmación de tu pedido #{orderId}` },
                        template: {
                          stringValue:
                            '<h2>Gracias por tu compra, {clientName}</h2><p>Tu pedido #{orderId} fue recibido correctamente.</p><p>Items: {itemsList}</p><p>Total: ${totalAmount}</p>',
                        },
                        showWhatsappButton: { booleanValue: true },
                      },
                    },
                  },
                  createdAt: { timestampValue: now },
                  updatedAt: { timestampValue: now },
                },
              },
              quotaProject: projectId,
            },
          ),
        5,
        6000,
      );

      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/emailEngine`,
            {
              method: 'PATCH',
              body: {
                fields: {
                  provider: { stringValue: 'firebase-trigger-email' },
                  status: { stringValue: 'ready' },
                  autoConfigured: { booleanValue: true },
                  warning: {
                    stringValue:
                      'La extension firebase-trigger-email debe instalarse y configurarse con SMTP en este proyecto Firebase para que el envio de correos funcione de forma real.',
                  },
                  updatedAt: { timestampValue: now },
                },
              },
              quotaProject: projectId,
            },
          ),
        5,
        6000,
      );

      console.info(
        `[provisioning:configureEmail] Se sembró con éxito la configuración inicial en settings/emailTemplates y settings/emailEngine para el proyecto ${projectId}.`,
      );
      console.warn(
        `[provisioning:configureEmail] ¡ATENCIÓN! La extensión 'firebase-trigger-email' debe ser provista/instalada físicamente en el proyecto Firebase '${projectId}' y vinculada a un servidor SMTP real para el envío efectivo de correos. Consultar docs/email-provisioning.md para más detalles.`,
      );

      await setStep('configureEmail', 'done');
    } catch (err) {
      await fail('configureEmail', err);
      return;
    }
  }

  // ── Step 7: Create store admin user and send invite email ──────────────
  if (!isDone('initAdmin')) {
    await setStep('initAdmin', 'running');
    try {
      // Initialize Identity Platform configuration (enables Email/Password provider)
      const initIdentityPlatform = async (): Promise<void> => {
        // Step 1: Initialize Identity Platform configuration on the target project
        try {
          await apiFetch(
            auth,
            `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`,
            {
              method: 'POST',
              body: {},
              quotaProject: projectId,
            },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          // If Identity Platform is already enabled or initialized, it might throw a 409, ALREADY_EXISTS, or a 400 stating it is already enabled.
          // We can safely ignore this and proceed to configuration.
          if (
            !msg.includes('ALREADY_EXISTS') &&
            !msg.includes('already exists') &&
            !msg.includes('409') &&
            !msg.includes('Identity Platform has already been enabled')
          ) {
            throw err;
          }
        }

        // Step 2: Configure and enable the Email/Password sign-in method
        await apiFetch(
          auth,
          `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn`,
          {
            method: 'PATCH',
            body: {
              signIn: {
                email: {
                  enabled: true,
                },
              },
            },
            quotaProject: projectId,
          },
        );
      };
      await retry(initIdentityPlatform, 5, 8000);

      // Create user (retry to handle API propagation delay after enableApis)
      const createOrFetchUid = async (): Promise<string> => {
        try {
          const res = (await apiFetch(
            auth,
            `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
            {
              method: 'POST',
              body: { email: ownerEmail, emailVerified: false },
              quotaProject: projectId,
            },
          )) as { localId: string };
          return res.localId;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('EMAIL_EXISTS')) throw err;
          const lookup = (await apiFetch(
            auth,
            `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
            { method: 'POST', body: { email: [ownerEmail] }, quotaProject: projectId },
          )) as { users: Array<{ localId: string }> };
          if (!lookup.users?.length)
            throw new Error(`User ${ownerEmail} not found after EMAIL_EXISTS`);
          return lookup.users[0].localId;
        }
      };
      const uid = await retry(createOrFetchUid, 5, 8000);

      // Set admin: true custom claim
      await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
        {
          method: 'POST',
          body: { localId: uid, customAttributes: JSON.stringify({ admin: true }) },
          quotaProject: projectId,
        },
      );

      // Send password reset email as the invite link
      await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`,
        {
          method: 'POST',
          body: { requestType: 'PASSWORD_RESET', email: ownerEmail },
          quotaProject: projectId,
        },
      );

      const oobRes = (await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`,
        {
          method: 'POST',
          body: { requestType: 'PASSWORD_RESET', email: ownerEmail, returnOobLink: true },
          quotaProject: projectId,
        },
      )) as { oobCode?: string; oobLink?: string };

      let actionLink = oobRes.oobLink || '';
      if (actionLink && (actionLink.startsWith('?') || actionLink.startsWith('/'))) {
        const query = actionLink.startsWith('/') ? actionLink : `/${actionLink}`;
        actionLink = `https://${projectId}.firebaseapp.com/__/auth/action${query}`;
      } else if (!actionLink && oobRes.oobCode) {
        actionLink = `https://${projectId}.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=${oobRes.oobCode}`;
      }

      if (actionLink) {
        await storeRef.collection('private').doc('ownerAccess').set(
          {
            email: ownerEmail,
            actionLink,
            generatedAt: new Date(),
          },
          { merge: true },
        );

        // Send welcome email to the store owner with the invitation/password setup link
        const emailSubject = `Bienvenido a Vertex - Configura tu tienda ${name}`;
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #10b981; margin-top: 0;">¡Felicitaciones! Tu tienda está siendo creada</h2>
            <p>Hola,</p>
            <p>Hemos iniciado el aprovisionamiento de tu nueva tienda <strong>${name}</strong> en la plataforma Vertex.</p>
            <p>Para configurar tu contraseña de administrador y acceder a tu panel de control, haz clic en el siguiente enlace:</p>
            <p style="margin: 24px 0; text-align: center;">
              <a href="${actionLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Configurar Contraseña</a>
            </p>
            <p style="color: #6b7280; font-size: 14px;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
            <p style="color: #3b82f6; font-size: 12px; word-break: break-all;">${actionLink}</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">Este correo fue enviado automáticamente por Vertex Platform. Por favor, no respondas a este mensaje.</p>
          </div>
        `;

        await db.collection('mail').add({
          to: [ownerEmail],
          message: {
            subject: emailSubject,
            html: emailHtml,
            text: `Bienvenido a Vertex. Configura tu contraseña de administrador ingresando a: ${actionLink}`,
          },
        });
      }

      await setStep('initAdmin', 'done');
    } catch (err) {
      await fail('initAdmin', err);
      return;
    }
  }

  // ── Step 8: Grant platform SA deploy access ────────────────────────────
  if (!isDone('grantAccess')) {
    await setStep('grantAccess', 'running');
    try {
      const serviceAccounts = Array.from(
        new Set([
          `firebase-adminsdk-fbsvc@${PLATFORM_PROJECT}.iam.gserviceaccount.com`,
          `firebase-adminsdk-fbsvc@vertex-platform-app.iam.gserviceaccount.com`,
        ]),
      );
      const tokenRes = await auth.getAccessToken();

      const policyRes = await fetch(
        `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}:getIamPolicy`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
      );
      const policy = (await policyRes.json()) as {
        bindings: Array<{ role: string; members: string[] }>;
        etag: string;
      };

      let ownerBinding = policy.bindings?.find((b) => b.role === 'roles/owner');
      if (!ownerBinding) {
        ownerBinding = { role: 'roles/owner', members: [] };
        policy.bindings = [...(policy.bindings ?? []), ownerBinding];
      }

      for (const sa of serviceAccounts) {
        const member = `serviceAccount:${sa}`;
        if (!ownerBinding.members.includes(member)) {
          ownerBinding.members.push(member);
        }
      }

      await fetch(
        `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}:setIamPolicy`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ policy }),
        },
      );
      await setStep('grantAccess', 'done');
    } catch (err) {
      await fail('grantAccess', err);
      return;
    }
  }

  // ── Step 9: Trigger GitHub Actions deploy ──────────────────────────────
  if (!isDone('triggerDeploy')) {
    if (currentSteps['triggerDeploy']?.status === 'running') {
      return;
    }
    await setStep('triggerDeploy', 'running');
    try {
      const pat = await getGitHubPat();

      // Fetch the deploy token for this environment to pass to GitHub Action
      const secrets = new SecretManagerServiceClient();
      const [version] = await secrets.accessSecretVersion({
        name: `projects/${PLATFORM_PROJECT}/secrets/deploy-token/versions/latest`,
      });
      const deployTokenValue = version.payload!.data!.toString().trim();

      const res = await fetch(
        'https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/dispatches',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'provision-store',
            client_payload: {
              store_id: storeId,
              project_id: projectId,
              site_id: runtimeSiteId || 'default',
              firebase_config: JSON.stringify(firebaseConfig),
              store_name: name,
              platform_project_id: PLATFORM_PROJECT,
              deploy_token: deployTokenValue,
              ref:
                PLATFORM_PROJECT === 'vertex-platform-dev'
                  ? 'feature/google-oauth-rbac'
                  : undefined,
            },
          }),
        },
      );
      if (!res.ok && res.status !== 204)
        throw new Error(`GitHub API: ${res.status} ${await res.text()}`);
    } catch (err) {
      await fail('triggerDeploy', err);
      return;
    }
  }
}

export const runProvisioning = onDocumentCreated(
  { document: 'stores/{storeId}', timeoutSeconds: 540, memory: '512MiB' },
  async (event) => {
    const data = event.data?.data();
    if (!data || data['status'] !== 'provisioning') return;
    try {
      await executeProvisioningSteps(event.params.storeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[runProvisioning] Unhandled provisioning error for store ${event.params.storeId}:`,
        err,
      );
      await getFirestore()
        .collection('stores')
        .doc(event.params.storeId)
        .update({
          status: 'error',
          updatedAt: new Date(),
          unhandledProvisioningError: message.slice(0, 800),
        });
    }
  },
);

export const retryProvisioning = onCall<{ storeId: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can retry provisioning.');
    }

    const { storeId } = request.data;
    if (!storeId) {
      throw new HttpsError('invalid-argument', 'storeId is required.');
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const snap = await storeRef.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Store not found.');
    }

    const storeData = snap.data()!;
    if (storeData['status'] !== 'error') {
      throw new HttpsError('failed-precondition', 'Only stores in error status can be retried.');
    }

    const steps = (storeData['provisioningSteps'] ?? {}) as Record<string, ProvisioningStep>;
    const updates: Record<string, unknown> = { status: 'provisioning', updatedAt: new Date() };
    for (const [id, step] of Object.entries(steps)) {
      if (step.status === 'error') {
        updates[`provisioningSteps.${id}.status`] = 'pending';
        updates[`provisioningSteps.${id}.error`] = null;
      }
    }
    if (steps['createProject']?.status === 'error') {
      updates['provisioningOwnerId'] = null;
    }
    await storeRef.update(updates);

    try {
      await executeProvisioningSteps(storeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await storeRef.update({
        status: 'error',
        updatedAt: new Date(),
        unhandledProvisioningError: message.slice(0, 800),
      });
      throw new HttpsError(
        'internal',
        'Provisioning retry failed unexpectedly. Review provisioning error details and try again.',
      );
    }
    return { success: true };
  },
);

export const completeStoreDeployment = onCall<{
  storeId: string;
  success: boolean;
  deployToken: string;
}>({ cors: ALLOWED_ORIGINS, invoker: 'public' }, async (request) => {
  const { storeId, success, deployToken } = request.data;

  if (!storeId || !deployToken) {
    throw new HttpsError('invalid-argument', 'storeId and deployToken are required.');
  }

  // 1. Verify the deploy token using Secret Manager
  const secrets = new SecretManagerServiceClient();
  const [version] = await secrets.accessSecretVersion({
    name: `projects/${PLATFORM_PROJECT}/secrets/deploy-token/versions/latest`,
  });
  const expected = version.payload!.data!.toString().trim();
  if (deployToken !== expected) {
    throw new HttpsError('permission-denied', 'Invalid deploy token.');
  }

  const db = getFirestore();
  const storeRef = db.collection('stores').doc(storeId);
  const snap = await storeRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Store not found.');
  }

  const storeData = snap.data()!;
  if (storeData['status'] === 'active') {
    return { success: true };
  }

  if (storeData['status'] !== 'provisioning' && storeData['status'] !== 'error') {
    throw new HttpsError('failed-precondition', 'Store is not in provisioning or error status.');
  }

  if (success) {
    await storeRef.update({
      'provisioningSteps.triggerDeploy.status': 'done',
      'provisioningSteps.triggerDeploy.error': null,
      status: 'active',
      lastDeployedAt: new Date(),
      templateVersion: CURRENT_TEMPLATE_VERSION,
      schemaVersion: CURRENT_STORE_SCHEMA_VERSION,
      updatedAt: new Date(),
    });

    if (storeData['runtimeMode'] === 'shared-shard' && storeData['shardId']) {
      const shardRef = db.collection('shards').doc(storeData['shardId']);
      try {
        await db.runTransaction(async (transaction) => {
          const shardSnap = await transaction.get(shardRef);
          if (shardSnap.exists) {
            const currentActive = shardSnap.data()?.activeStores || 0;
            transaction.update(shardRef, {
              activeStores: currentActive + 1,
              updatedAt: new Date(),
            });
          }
        });
        console.info(
          `[completeStoreDeployment] Successfully incremented activeStores on shard ${storeData['shardId']}`,
        );
      } catch (err) {
        console.error(
          `[completeStoreDeployment] Failed to increment activeStores on shard ${storeData['shardId']}:`,
          err,
        );
      }
    }
  } else {
    await storeRef.update({
      'provisioningSteps.triggerDeploy.status': 'error',
      'provisioningSteps.triggerDeploy.error':
        'Storefront deployment failed. Check GitHub Action logs for details.',
      status: 'error',
      updatedAt: new Date(),
    });
  }

  return { success: true };
});
