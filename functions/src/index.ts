import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { OAuth2Client } from 'google-auth-library';

initializeApp();

// ─── Types ────────────────────────────────────────────────────────────────────

interface ManageAdminPayload {
  email: string;
  action: 'add' | 'remove';
}

interface AdminInfo {
  uid: string;
  email: string;
  displayName: string | undefined;
  photoURL: string | undefined;
}

interface CreateStorePayload {
  name: string;
  slug: string;
  ownerEmail: string;
  plan: string;
  primaryColor: string;
  logoUrl?: string;
  customDomain?: string;
}

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface ProvisioningStep {
  status: StepStatus;
  label: string;
  error?: string;
}

const PLATFORM_PROJECT = 'vertex-platform-app';
const BILLING_ACCOUNT = '01D2F4-C25DF1-489AE9';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOwnerOAuthClient(): Promise<OAuth2Client> {
  const secrets = new SecretManagerServiceClient();
  const [version] = await secrets.accessSecretVersion({
    name: `projects/${PLATFORM_PROJECT}/secrets/platform-owner-credentials/versions/latest`,
  });
  const creds = JSON.parse(version.payload!.data!.toString()) as {
    client_id: string;
    client_secret: string;
    refresh_token: string;
  };
  const oauth2 = new OAuth2Client(creds.client_id, creds.client_secret);
  oauth2.setCredentials({ refresh_token: creds.refresh_token });
  return oauth2;
}

async function getGitHubPat(): Promise<string> {
  const secrets = new SecretManagerServiceClient();
  const [version] = await secrets.accessSecretVersion({
    name: `projects/${PLATFORM_PROJECT}/secrets/github-pat/versions/latest`,
  });
  return version.payload!.data!.toString().trim();
}

async function apiFetch(
  auth: OAuth2Client,
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const tokenRes = await auth.getAccessToken();
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${tokenRes.token}`,
      'Content-Type': 'application/json',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function pollOperation(
  auth: OAuth2Client,
  operationName: string,
  baseUrl: string,
  maxAttempts = 36,
  delayMs = 5000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const op = (await apiFetch(auth, `${baseUrl}/${operationName}`)) as {
      done?: boolean;
      error?: { message: string };
    };
    if (op.done) {
      if (op.error) throw new Error(op.error.message);
      return;
    }
  }
  throw new Error(`Operation ${operationName} timed out after ${maxAttempts * delayMs}ms`);
}

// ─── Cloud Functions ──────────────────────────────────────────────────────────

/**
 * Sets or removes the platformAdmin custom claim on a Firebase Auth user.
 */
export const manageAdmin = onCall<ManageAdminPayload>(async (request) => {
  if (!request.auth?.token['platformAdmin']) {
    throw new HttpsError('permission-denied', 'Only platform admins can manage other admins.');
  }

  const { email, action } = request.data;
  if (!email || !['add', 'remove'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Invalid email or action.');
  }

  const auth = getAuth();
  try {
    const user = await auth.getUserByEmail(email);
    const currentClaims = (user.customClaims as Record<string, unknown>) ?? {};

    if (action === 'add') {
      await auth.setCustomUserClaims(user.uid, { ...currentClaims, platformAdmin: true });
    } else {
      const { platformAdmin: _, ...rest } = currentClaims;
      await auth.setCustomUserClaims(user.uid, rest);
    }
    return { success: true, uid: user.uid };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('no user record')) {
      throw new HttpsError('not-found', `No user found for ${email}. They must sign in first.`);
    }
    throw new HttpsError('internal', msg);
  }
});

/**
 * Lists all platform admins.
 */
export const listAdmins = onCall(async (request) => {
  if (!request.auth?.token['platformAdmin']) {
    throw new HttpsError('permission-denied', 'Only platform admins can list admins.');
  }

  const auth = getAuth();
  const result = await auth.listUsers(1000);
  const admins: AdminInfo[] = result.users
    .filter((u) => (u.customClaims as Record<string, unknown> | undefined)?.['platformAdmin'])
    .map((u) => ({
      uid: u.uid,
      email: u.email ?? '',
      displayName: u.displayName,
      photoURL: u.photoURL,
    }));

  return { admins };
});

/**
 * Provisions a new Firebase project for a store.
 * Steps: createProject → linkBilling → addFirebase → enableApis →
 *        createWebApp → getConfig → initFirestore → triggerDeploy
 */
export const provisionStore = onCall<CreateStorePayload>(
  { timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can provision stores.');
    }

    const { name, slug, ownerEmail, plan, primaryColor, logoUrl, customDomain } = request.data;

    // GCP project IDs: lowercase, 6-30 chars, letters/digits/hyphens, starts with letter
    const projectId = `vtx-${slug}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30);
    const storeId = crypto.randomUUID();
    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);

    const steps: Record<string, ProvisioningStep> = {
      createProject: { status: 'pending', label: 'Crear proyecto GCP' },
      linkBilling: { status: 'pending', label: 'Vincular facturación' },
      addFirebase: { status: 'pending', label: 'Activar Firebase' },
      enableApis: { status: 'pending', label: 'Habilitar APIs' },
      createWebApp: { status: 'pending', label: 'Crear app web' },
      initFirestore: { status: 'pending', label: 'Inicializar Firestore' },
      grantAccess: { status: 'pending', label: 'Configurar permisos de deploy' },
      triggerDeploy: { status: 'pending', label: 'Desplegar tienda' },
    };

    await storeRef.set({
      id: storeId,
      name,
      slug,
      ownerEmail,
      plan,
      primaryColor,
      logoUrl: logoUrl ?? null,
      customDomain: customDomain ?? null,
      firebaseProjectId: projectId,
      defaultUrl: `https://${projectId}.web.app`,
      status: 'provisioning',
      provisioningSteps: steps,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const setStep = async (id: string, status: StepStatus, error?: string) => {
      await storeRef.update({
        [`provisioningSteps.${id}.status`]: status,
        ...(error ? { [`provisioningSteps.${id}.error`]: error } : {}),
        updatedAt: new Date(),
      });
    };

    const fail = async (stepId: string, err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      await setStep(stepId, 'error', msg);
      await storeRef.update({ status: 'error', updatedAt: new Date() });
      throw new HttpsError('internal', `Step ${stepId} failed: ${msg}`);
    };

    let auth: OAuth2Client;
    try {
      auth = await getOwnerOAuthClient();
    } catch {
      await storeRef.update({ status: 'error', updatedAt: new Date() });
      throw new HttpsError(
        'failed-precondition',
        'Owner credentials not found. Run: npm run setup-provisioning'
      );
    }

    // ── Step 1: Create GCP project ─────────────────────────────────────────
    await setStep('createProject', 'running');
    try {
      const op = (await apiFetch(
        auth,
        'https://cloudresourcemanager.googleapis.com/v3/projects',
        { method: 'POST', body: { projectId, displayName: name } }
      )) as { name: string };
      await pollOperation(auth, op.name, 'https://cloudresourcemanager.googleapis.com/v3/operations');
      await setStep('createProject', 'done');
    } catch (err) {
      // Project may already exist (idempotency)
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('409')) {
        return fail('createProject', err);
      }
      await setStep('createProject', 'done');
    }

    // ── Step 2: Link billing ───────────────────────────────────────────────
    await setStep('linkBilling', 'running');
    try {
      await apiFetch(
        auth,
        `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
        {
          method: 'PUT',
          body: { billingAccountName: `billingAccounts/${BILLING_ACCOUNT}` },
        }
      );
      await setStep('linkBilling', 'done');
    } catch (err) {
      return fail('linkBilling', err);
    }

    // ── Step 3: Add Firebase ───────────────────────────────────────────────
    await setStep('addFirebase', 'running');
    try {
      const op = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
        { method: 'POST', body: {} }
      )) as { name: string };
      await pollOperation(auth, op.name, 'https://firebase.googleapis.com/v1beta1/operations');
      await setStep('addFirebase', 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already') && !msg.includes('409')) return fail('addFirebase', err);
      await setStep('addFirebase', 'done');
    }

    // ── Step 4: Enable APIs ────────────────────────────────────────────────
    await setStep('enableApis', 'running');
    try {
      const tokenRes = await auth.getAccessToken();
      const res = await fetch(
        `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json',
          },
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
      if (!res.ok && res.status !== 409) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      await setStep('enableApis', 'done');
    } catch (err) {
      return fail('enableApis', err);
    }

    // ── Step 5: Create web app and get config ──────────────────────────────
    await setStep('createWebApp', 'running');
    let firebaseConfig: Record<string, string>;
    try {
      // Create web app
      const appOp = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
        { method: 'POST', body: { displayName: name } }
      )) as { name: string };
      await pollOperation(auth, appOp.name, 'https://firebase.googleapis.com/v1beta1/operations');

      // Get app ID
      const appsRes = (await apiFetch(
        auth,
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`
      )) as { apps: Array<{ appId: string }> };
      const appId = appsRes.apps[0].appId;

      // Get firebase config
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

      // Store config privately
      await db
        .collection('stores')
        .doc(storeId)
        .collection('private')
        .doc('firebaseConfig')
        .set(firebaseConfig);

      await setStep('createWebApp', 'done');
    } catch (err) {
      return fail('createWebApp', err);
    }

    // ── Step 6: Init Firestore in new project ──────────────────────────────
    await setStep('initFirestore', 'running');
    try {
      // Create Firestore database
      const tokenRes = await auth.getAccessToken();
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=(default)`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'FIRESTORE_NATIVE', locationId: 'us-central' }),
        }
      );

      // Write initial store config to the new Firestore using admin SDK
      const newApp = initializeApp(
        { projectId },
        `store-${storeId}`
      );
      const newDb = getFirestore(newApp);

      await newDb.collection('storeConfig').doc('main').set({
        storeName: name,
        primaryColor,
        secondaryColor: '#ffffff',
        logoUrl: logoUrl ?? null,
        seo: {
          metaTitle: name,
          metaDescription: `Bienvenido a ${name}`,
        },
        social: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await deleteApp(newApp);
      await setStep('initFirestore', 'done');
    } catch (err) {
      // Non-fatal if DB already exists
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists') || msg.includes('409')) {
        await setStep('initFirestore', 'done');
      } else {
        return fail('initFirestore', err);
      }
    }

    // ── Step 7: Grant platform SA deploy access to new project ────────────
    await setStep('grantAccess', 'running');
    try {
      const platformSA = `firebase-adminsdk-fbsvc@${PLATFORM_PROJECT}.iam.gserviceaccount.com`;
      const tokenRes = await auth.getAccessToken();

      // Get current IAM policy
      const policyRes = await fetch(
        `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}:getIamPolicy`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      const policy = (await policyRes.json()) as {
        bindings: Array<{ role: string; members: string[] }>;
        etag: string;
      };

      // Add platform SA as owner
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
          headers: {
            Authorization: `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ policy }),
        }
      );
      await setStep('grantAccess', 'done');
    } catch (err) {
      return fail('grantAccess', err);
    }

    // ── Step 8: Trigger GitHub Actions deploy ──────────────────────────────
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
              primary_color: primaryColor,
            },
          }),
        }
      );
      if (!res.ok && res.status !== 204) {
        throw new Error(`GitHub API: ${res.status} ${await res.text()}`);
      }
      await setStep('triggerDeploy', 'done');
    } catch (err) {
      return fail('triggerDeploy', err);
    }

    // ── Done ───────────────────────────────────────────────────────────────
    await storeRef.update({
      status: 'active',
      lastDeployedAt: new Date(),
      templateVersion: '1.0.0',
      updatedAt: new Date(),
    });

    return { storeId, projectId };
  }
);

// ─── redeployStore ────────────────────────────────────────────────────────────

export const redeployStore = onCall<{ storeId: string }>(async (request) => {
  if (!request.auth?.token['platformAdmin']) {
    throw new HttpsError('permission-denied', 'Only platform admins can redeploy stores.');
  }

  const { storeId } = request.data;
  const db = getFirestore();
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

  const store = storeSnap.data() as {
    firebaseProjectId: string;
    name: string;
    primaryColor: string;
  };

  // Get firebase config from private subcollection
  const configSnap = await db
    .collection('stores')
    .doc(storeId)
    .collection('private')
    .doc('firebaseConfig')
    .get();
  if (!configSnap.exists) throw new HttpsError('not-found', 'Firebase config not found.');

  const firebaseConfig = configSnap.data() as Record<string, string>;
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
          project_id: store.firebaseProjectId,
          firebase_config: JSON.stringify(firebaseConfig),
          store_name: store.name,
          primary_color: store.primaryColor,
        },
      }),
    }
  );

  if (!res.ok && res.status !== 204) {
    throw new HttpsError('internal', `GitHub API: ${res.status} ${await res.text()}`);
  }

  await db.collection('stores').doc(storeId).update({
    lastDeployedAt: new Date(),
    updatedAt: new Date(),
  });

  return { success: true };
});

// ─── deleteStore ──────────────────────────────────────────────────────────────

export const deleteStore = onCall<{ storeId: string }>(
  { timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can delete stores.');
    }

    const { storeId } = request.data;
    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as { firebaseProjectId: string };
    const auth = await getOwnerOAuthClient();

    // Delete GCP project (also removes all Firebase resources)
    try {
      await apiFetch(
        auth,
        `https://cloudresourcemanager.googleapis.com/v3/projects/${store.firebaseProjectId}`,
        { method: 'DELETE' }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If project doesn't exist, continue cleanup
      if (!msg.includes('404') && !msg.includes('not found')) {
        throw new HttpsError('internal', `Failed to delete GCP project: ${msg}`);
      }
    }

    // Delete private subcollection
    const privateRef = db.collection('stores').doc(storeId).collection('private');
    const privateDocs = await privateRef.listDocuments();
    await Promise.all(privateDocs.map((d) => d.delete()));

    // Delete store document
    await db.collection('stores').doc(storeId).delete();

    return { success: true };
  }
);

// ─── connectDomain ────────────────────────────────────────────────────────────

export const connectDomain = onCall<{ storeId: string; domain: string }>(async (request) => {
  if (!request.auth?.token['platformAdmin']) {
    throw new HttpsError('permission-denied', 'Only platform admins can connect domains.');
  }

  const { storeId, domain } = request.data;
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new HttpsError('invalid-argument', 'Invalid domain format.');
  }

  const db = getFirestore();
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

  const store = storeSnap.data() as { firebaseProjectId: string };
  const auth = await getOwnerOAuthClient();

  // Add custom domain to Firebase Hosting
  const tokenRes = await auth.getAccessToken();
  const res = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${store.firebaseProjectId}/sites/default/domains`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenRes.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domainName: domain }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError('internal', `Firebase Hosting API: ${res.status} ${text}`);
  }

  const result = (await res.json()) as {
    requiredDnsUpdates?: { discovered?: Array<{ rdata: string; requiredAction: string }> };
  };

  // Save domain to store
  await db.collection('stores').doc(storeId).update({
    customDomain: domain,
    updatedAt: new Date(),
  });

  // Return DNS records the user needs to configure
  const dnsRecords = result.requiredDnsUpdates?.discovered ?? [];
  return { success: true, dnsRecords };
});

// ─── getActiveStores — called by GitHub Actions to get deploy matrix ──────────
// Uses a shared secret token for machine-to-machine auth (no Firebase user needed)

export const getActiveStores = onCall(async (request) => {
  // Allow platform admins OR GitHub Actions via deploy token
  const deployToken = request.data?.deployToken as string | undefined;
  const isAdmin = !!request.auth?.token['platformAdmin'];

  if (!isAdmin && deployToken) {
    const secrets = new SecretManagerServiceClient();
    const [version] = await secrets.accessSecretVersion({
      name: `projects/${PLATFORM_PROJECT}/secrets/deploy-token/versions/latest`,
    });
    const expected = version.payload!.data!.toString().trim();
    if (deployToken !== expected) {
      throw new HttpsError('permission-denied', 'Invalid deploy token.');
    }
  } else if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Unauthorized.');
  }

  const db = getFirestore();
  const snap = await db.collection('stores').where('status', '==', 'active').get();

  const stores = await Promise.all(
    snap.docs.map(async (doc) => {
      const store = doc.data() as {
        id: string;
        name: string;
        firebaseProjectId: string;
        primaryColor: string;
      };

      const configSnap = await db
        .collection('stores')
        .doc(doc.id)
        .collection('private')
        .doc('firebaseConfig')
        .get();

      return {
        storeId: store.id,
        projectId: store.firebaseProjectId,
        storeName: store.name,
        primaryColor: store.primaryColor,
        firebaseConfig: configSnap.exists ? JSON.stringify(configSnap.data()) : null,
      };
    })
  );

  return { stores: stores.filter((s) => s.firebaseConfig !== null) };
});

