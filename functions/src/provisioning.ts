import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import type { OAuth2Client } from 'google-auth-library';
import type { CreateStorePayload, StepStatus, ProvisioningStep } from './types';
import {
  ALLOWED_ORIGINS,
  PLATFORM_PROJECT,
  getOwnerOAuthClient,
  getGitHubPat,
  apiFetch,
  retry,
  pollOperation,
  pickBillingAccount,
} from './helpers';

export const provisionStore = onCall<CreateStorePayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can provision stores.');
    }

    const { name, slug, ownerEmail, plan, logoUrl, customDomain } = request.data;

    if (!name?.trim() || !ownerEmail?.trim() || !plan?.trim()) {
      throw new HttpsError('invalid-argument', 'name, ownerEmail, and plan are required.');
    }
    if (!/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/.test(slug)) {
      throw new HttpsError(
        'invalid-argument',
        'slug must be 3–20 lowercase letters, numbers, or hyphens, and cannot start or end with a hyphen.'
      );
    }

    const db = getFirestore();
    const existingSlug = await db.collection('stores').where('slug', '==', slug).limit(1).get();
    if (!existingSlug.empty) {
      throw new HttpsError('already-exists', `A store with slug "${slug}" already exists.`);
    }

    const projectId = `vtx-${slug}`.slice(0, 30);
    const storeId = crypto.randomUUID();

    let billingAccountId: string;
    try {
      billingAccountId = await pickBillingAccount(db);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpsError('resource-exhausted', msg);
    }

    const steps: Record<string, ProvisioningStep> = {
      createProject: { status: 'pending', label: 'Crear proyecto GCP' },
      linkBilling:   { status: 'pending', label: 'Vincular facturación' },
      addFirebase:   { status: 'pending', label: 'Activar Firebase' },
      enableApis:    { status: 'pending', label: 'Habilitar APIs' },
      createWebApp:  { status: 'pending', label: 'Crear app web' },
      initFirestore: { status: 'pending', label: 'Inicializar Firestore' },
      grantAccess:   { status: 'pending', label: 'Configurar permisos de deploy' },
      triggerDeploy: { status: 'pending', label: 'Desplegar tienda' },
    };

    await db.collection('stores').doc(storeId).set({
      id: storeId,
      name,
      slug,
      ownerEmail,
      plan,
      logoUrl: logoUrl ?? null,
      customDomain: customDomain ?? null,
      firebaseProjectId: projectId,
      defaultUrl: `https://${projectId}.web.app`,
      billingAccountId,
      status: 'provisioning',
      provisioningSteps: steps,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { storeId, projectId };
  }
);

async function executeProvisioningSteps(storeId: string): Promise<void> {
  const db = getFirestore();
  const storeRef = db.collection('stores').doc(storeId);

  const currentSnap = await storeRef.get();
  const currentData = currentSnap.data();
  if (!currentData || !['provisioning', 'error'].includes(currentData['status'])) return;

  const { name, logoUrl, firebaseProjectId: projectId, billingAccountId } = currentData as {
    name: string;
    logoUrl: string | null;
    firebaseProjectId: string;
    billingAccountId: string;
  };

  const currentSteps = (currentData['provisioningSteps'] ?? {}) as Record<string, ProvisioningStep>;
  const isDone = (stepId: string): boolean => currentSteps[stepId]?.status === 'done';

  const setStep = async (id: string, status: StepStatus, error?: string): Promise<void> => {
    await storeRef.update({
      [`provisioningSteps.${id}.status`]: status,
      ...(error ? { [`provisioningSteps.${id}.error`]: error } : {}),
      updatedAt: new Date(),
    });
  };

  const fail = async (stepId: string, err: unknown): Promise<void> => {
    const msg = err instanceof Error ? err.message : String(err);
    await setStep(stepId, 'error', msg);
    await storeRef.update({ status: 'error', updatedAt: new Date() });
  };

  let auth: OAuth2Client;
  try {
    auth = await getOwnerOAuthClient();
  } catch {
    await storeRef.update({ status: 'error', updatedAt: new Date() });
    return;
  }

  // ── Step 1: Create GCP project ─────────────────────────────────────────
  if (!isDone('createProject')) {
    await setStep('createProject', 'running');
    try {
      const op = (await apiFetch(
        auth,
        'https://cloudresourcemanager.googleapis.com/v3/projects',
        { method: 'POST', body: { projectId, displayName: name } }
      )) as { name: string };
      await pollOperation(auth, op.name, 'https://cloudresourcemanager.googleapis.com/v3');
      await setStep('createProject', 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('409')) {
        await fail('createProject', err); return;
      }
      await setStep('createProject', 'done');
    }
  }

  // ── Step 2: Link billing ───────────────────────────────────────────────
  if (!isDone('linkBilling')) {
    await setStep('linkBilling', 'running');
    try {
      await retry(
        () => apiFetch(
          auth,
          `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
          { method: 'PUT', body: { billingAccountName: `billingAccounts/${billingAccountId}` } }
        ),
        5,
        6000
      );
      await setStep('linkBilling', 'done');
    } catch (err) {
      await fail('linkBilling', err); return;
    }
  }

  // ── Step 3: Add Firebase ───────────────────────────────────────────────
  if (!isDone('addFirebase')) {
    await setStep('addFirebase', 'running');
    try {
      const op = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
        { method: 'POST', body: {} }
      )) as { name: string };
      await pollOperation(auth, op.name, 'https://firebase.googleapis.com/v1beta1');
      await setStep('addFirebase', 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already') && !msg.includes('409')) {
        await fail('addFirebase', err); return;
      }
      await setStep('addFirebase', 'done');
    }
  }

  // ── Step 4: Enable APIs ────────────────────────────────────────────────
  if (!isDone('enableApis')) {
    await setStep('enableApis', 'running');
    try {
      const tokenRes = await auth.getAccessToken();
      const res = await fetch(
        `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenRes.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceIds: [
              'firestore.googleapis.com',
              'identitytoolkit.googleapis.com',
              'storage.googleapis.com',
              'cloudresourcemanager.googleapis.com',
            ],
          }),
        }
      );
      if (!res.ok && res.status !== 409) throw new Error(`${res.status}: ${await res.text()}`);
      await setStep('enableApis', 'done');
    } catch (err) {
      await fail('enableApis', err); return;
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
      const appOp = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
        { method: 'POST', body: { displayName: name } }
      )) as { name: string };
      await pollOperation(auth, appOp.name, 'https://firebase.googleapis.com/v1beta1');

      const appsRes = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`
      )) as { apps: Array<{ appId: string }> };
      const appId = appsRes.apps[0].appId;

      const configRes = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${appId}/config`
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
      await fail('createWebApp', err); return;
    }
  }

  // ── Step 6: Init Firestore in new project ──────────────────────────────
  if (!isDone('initFirestore')) {
    await setStep('initFirestore', 'running');
    try {
      try {
        const dbOp = (await apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=(default)`,
          { method: 'POST', body: { type: 'FIRESTORE_NATIVE', locationId: 'nam5' } }
        )) as { name: string };
        await pollOperation(auth, dbOp.name, 'https://firestore.googleapis.com/v1');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already exists') && !msg.includes('409')) throw err;
      }

      const now = new Date().toISOString();
      await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/storeConfig/main`,
        {
          method: 'PATCH',
          body: {
            fields: {
              storeName: { stringValue: name },
              logoUrl: logoUrl ? { stringValue: logoUrl } : { nullValue: null },
              seo: {
                mapValue: {
                  fields: {
                    metaTitle: { stringValue: name },
                    metaDescription: { stringValue: `Bienvenido a ${name}` },
                  },
                },
              },
              social: { mapValue: { fields: {} } },
              createdAt: { timestampValue: now },
              updatedAt: { timestampValue: now },
            },
          },
        }
      );
      await setStep('initFirestore', 'done');
    } catch (err) {
      await fail('initFirestore', err); return;
    }
  }

  // ── Step 7: Grant platform SA deploy access ────────────────────────────
  if (!isDone('grantAccess')) {
    await setStep('grantAccess', 'running');
    try {
      const platformSA = `firebase-adminsdk-fbsvc@${PLATFORM_PROJECT}.iam.gserviceaccount.com`;
      const tokenRes = await auth.getAccessToken();

      const policyRes = await fetch(
        `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}:getIamPolicy`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenRes.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const policy = (await policyRes.json()) as {
        bindings: Array<{ role: string; members: string[] }>;
        etag: string;
      };

      const ownerBinding = policy.bindings?.find((b) => b.role === 'roles/owner');
      const member = `serviceAccount:${platformSA}`;
      if (ownerBinding) {
        if (!ownerBinding.members.includes(member)) ownerBinding.members.push(member);
      } else {
        policy.bindings = [...(policy.bindings ?? []), { role: 'roles/owner', members: [member] }];
      }

      await fetch(
        `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}:setIamPolicy`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenRes.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ policy }),
        }
      );
      await setStep('grantAccess', 'done');
    } catch (err) {
      await fail('grantAccess', err); return;
    }
  }

  // ── Step 8: Trigger GitHub Actions deploy ──────────────────────────────
  if (!isDone('triggerDeploy')) {
    await setStep('triggerDeploy', 'running');
    try {
      const pat = await getGitHubPat();
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
              firebase_config: JSON.stringify(firebaseConfig),
              store_name: name,
            },
          }),
        }
      );
      if (!res.ok && res.status !== 204) throw new Error(`GitHub API: ${res.status} ${await res.text()}`);
      await setStep('triggerDeploy', 'done');
    } catch (err) {
      await fail('triggerDeploy', err); return;
    }
  }

  // ── Done ───────────────────────────────────────────────────────────────
  await storeRef.update({
    status: 'active',
    lastDeployedAt: new Date(),
    templateVersion: '1.0.0',
    updatedAt: new Date(),
  });
}

export const runProvisioning = onDocumentCreated(
  { document: 'stores/{storeId}', timeoutSeconds: 540, memory: '512MiB' },
  async (event) => {
    const data = event.data?.data();
    if (!data || data['status'] !== 'provisioning') return;
    await executeProvisioningSteps(event.params.storeId);
  }
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
    await storeRef.update(updates);

    await executeProvisioningSteps(storeId);
    return { success: true };
  }
);
