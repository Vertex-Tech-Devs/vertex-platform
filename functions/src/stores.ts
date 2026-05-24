import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ALLOWED_ORIGINS, PLATFORM_PROJECT, getOwnerOAuthClient, getGitHubPat, apiFetch, retry } from './helpers';
import { resolvePlatformEnvironment, summarizeShardCapacity } from './runtime';
import type { InviteStaffPayload, StoreRuntimeMode, StoreShard, UpdateStoreConfigPayload } from './types';

function resolveRuntimeProjectId(store: {
  runtimeProjectId?: string;
  firebaseProjectId?: string;
}): string {
  const projectId = store.runtimeProjectId ?? store.firebaseProjectId;
  if (!projectId) {
    throw new HttpsError('failed-precondition', 'Store runtime project is not configured.');
  }
  return projectId;
}

function resolveRuntimeSiteId(store: { runtimeSiteId?: string }): string {
  return store.runtimeSiteId ?? 'default';
}

function inferProjectIdFromDefaultUrl(defaultUrl?: string): string | null {
  const raw = (defaultUrl ?? '').trim();
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    const host = (url.hostname || '').toLowerCase();
    const webAppSuffix = '.web.app';
    if (!host.endsWith(webAppSuffix)) {
      return null;
    }

    const projectId = host.slice(0, -webAppSuffix.length).trim();
    return projectId || null;
  } catch {
    return null;
  }
}

async function deleteHostingSite(
  auth: Awaited<ReturnType<typeof getOwnerOAuthClient>>,
  projectId: string,
  siteId: string,
): Promise<void> {
  const tokenRes = await auth.getAccessToken();
  const headers = {
    Authorization: `Bearer ${tokenRes.token}`,
    'Content-Type': 'application/json',
  };

  const domainsRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/domains`,
    { method: 'GET', headers },
  );

  if (domainsRes.ok) {
    const domainsData = (await domainsRes.json()) as { domains?: Array<{ domainName?: string }> };
    const domains = (domainsData.domains ?? [])
      .map((domain) => domain.domainName?.trim())
      .filter((domain): domain is string => !!domain);

    for (const domainName of domains) {
      if (domainName.endsWith('.web.app') || domainName.endsWith('.firebaseapp.com')) {
        continue;
      }

      const deleteDomainRes = await fetch(
        `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/domains/${encodeURIComponent(domainName)}`,
        { method: 'DELETE', headers },
      );

      if (!deleteDomainRes.ok && deleteDomainRes.status !== 404) {
        const body = await deleteDomainRes.text();
        throw new Error(
          `[deleteStore] Failed deleting custom domain ${domainName} from ${projectId}/${siteId}: ${deleteDomainRes.status} ${body}`,
        );
      }
    }
  } else if (domainsRes.status !== 404) {
    const body = await domainsRes.text();
    throw new Error(
      `[deleteStore] Failed listing Hosting domains for ${projectId}/${siteId}: ${domainsRes.status} ${body}`,
    );
  }

  const deleteSiteRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}`,
    { method: 'DELETE', headers },
  );

  if (!deleteSiteRes.ok && deleteSiteRes.status !== 404) {
    const body = await deleteSiteRes.text();
    throw new Error(
      `[deleteStore] Failed deleting Hosting site ${projectId}/${siteId}: ${deleteSiteRes.status} ${body}`,
    );
  }
}

async function deleteProjectAndWait(
  auth: Awaited<ReturnType<typeof getOwnerOAuthClient>>,
  projectId: string,
): Promise<void> {
  const deletion = (await apiFetch(
    auth,
    `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`,
    { method: 'DELETE' },
  )) as { name?: string; done?: boolean; error?: { message?: string } };

  if (!deletion.name) {
    return;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const operation = (await apiFetch(
      auth,
      `https://cloudresourcemanager.googleapis.com/v3/${deletion.name}`,
      { method: 'GET' },
    )) as { done?: boolean; error?: { message?: string } };

    if (operation.done) {
      if (operation.error?.message) {
        throw new Error(`[deleteStore] Project deletion failed for ${projectId}: ${operation.error.message}`);
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`[deleteStore] Project deletion operation timed out for ${projectId}`);
}

export const getRuntimeCapacitySummary = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can inspect runtime capacity.');
    }

    const db = getFirestore();
    const environment = resolvePlatformEnvironment();
    const shardsSnap = await db.collection('shards').where('environment', '==', environment).get();
    const shards = shardsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as StoreShard)
      .filter((shard) => shard.runtimeMode === 'shared-shard');

    return {
      summary: summarizeShardCapacity(shards, environment),
    };
  },
);

async function ensureEmailPasswordSignInEnabled(auth: Awaited<ReturnType<typeof getOwnerOAuthClient>>, projectId: string): Promise<void> {
  const initIdentityPlatform = async (): Promise<void> => {
    try {
      await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`,
        {
          method: 'POST',
          body: {},
          quotaProject: projectId,
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('ALREADY_EXISTS') && !msg.includes('already exists') && !msg.includes('409')) {
        throw err;
      }
    }

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
      }
    );
  };

  await retry(initIdentityPlatform, 5, 8000);
}

function maskToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

async function validateMercadoPagoCredentials(
  accessToken: string,
  webhookUrl?: string
): Promise<{ message: string; accountEmail?: string; userId?: string }> {
  const token = accessToken.trim();
  if (!token) {
    throw new HttpsError('invalid-argument', 'El access token de Mercado Pago es obligatorio.');
  }

  const webhook = (webhookUrl || '').trim();
  if (webhook && !/^https:\/\//i.test(webhook)) {
    throw new HttpsError('invalid-argument', 'El webhook de Mercado Pago debe comenzar con https://');
  }

  try {
    const res = await fetch('https://api.mercadopago.com/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const details = await res.text();
      throw new Error(`Mercado Pago respondió ${res.status}: ${details}`);
    }

    const user = (await res.json()) as { id?: number | string; email?: string };
    return {
      message: `Credenciales válidas para ${user.email || 'cuenta sin email'}.`,
      accountEmail: user.email || undefined,
      userId: user.id ? String(user.id) : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('invalid-argument', `No se pudieron validar las credenciales de Mercado Pago. ${msg}`);
  }
}

async function upsertSecretInProject(
  auth: Awaited<ReturnType<typeof getOwnerOAuthClient>>,
  projectId: string,
  secretId: string,
  secretValue: string
): Promise<void> {
  const tokenRes = await auth.getAccessToken();
  const headers = {
    Authorization: `Bearer ${tokenRes.token}`,
    'Content-Type': 'application/json',
  };

  const createRes = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets?secretId=${encodeURIComponent(secretId)}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ replication: { automatic: {} } }),
    }
  );

  if (!createRes.ok && createRes.status !== 409) {
    const text = await createRes.text();
    throw new HttpsError('internal', `No se pudo crear el secreto de Mercado Pago: ${createRes.status} ${text}`);
  }

  const addVersionRes = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${encodeURIComponent(secretId)}:addVersion`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ payload: { data: Buffer.from(secretValue, 'utf8').toString('base64') } }),
    }
  );

  if (!addVersionRes.ok) {
    const text = await addVersionRes.text();
    throw new HttpsError('internal', `No se pudo guardar versión del secreto de Mercado Pago: ${addVersionRes.status} ${text}`);
  }
}

export const redeployStore = onCall<{ storeId: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can redeploy stores.');
    }

    const { storeId } = request.data;
    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      name: string;
      templateVersion?: string;
    };
    const projectId = resolveRuntimeProjectId(store);
    const ref = store.templateVersion ? `refs/tags/v${store.templateVersion}` : undefined;

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
            project_id: projectId,
            firebase_config: JSON.stringify(firebaseConfig),
            store_name: store.name,
            ref: ref,
          },
        }),
      }
    );

    if (!res.ok && res.status !== 204) {
      const body = await res.text();
      console.error('redeployStore GitHub dispatch error:', res.status, body);
      throw new HttpsError('internal', 'Failed to trigger deployment. Please try again.');
    }

    await db.collection('stores').doc(storeId).update({
      lastDeployedAt: new Date(),
      updatedAt: new Date(),
    });

    return { success: true };
  }
);

export const deleteStore = onCall<{ storeId: string }>(
  { timeoutSeconds: 300, cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can delete stores.');
    }

    const { storeId } = request.data;
    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      runtimeSiteId?: string;
      runtimeMode?: StoreRuntimeMode;
      defaultUrl?: string;
    };
    const auth = await getOwnerOAuthClient();

    const siteId = resolveRuntimeSiteId(store);
    const runtimeMode = store.runtimeMode ?? 'dedicated-project';
    const inferredProjectId = inferProjectIdFromDefaultUrl(store.defaultUrl);
    const candidateProjectIds = Array.from(
      new Set(
        [store.runtimeProjectId, store.firebaseProjectId, inferredProjectId]
          .map((value) => (value || '').trim())
          .filter((value) => value.length > 0),
      ),
    );

    if (candidateProjectIds.length > 0) {
      for (const projectId of candidateProjectIds) {
        try {
          await deleteHostingSite(auth, projectId, siteId);
        } catch (err) {
          console.error(`[deleteStore] Hosting cleanup error for ${projectId}/${siteId}:`, err);
          throw new HttpsError(
            'internal',
            'No se pudo limpiar Firebase Hosting de la tienda. No se eliminaron datos locales para evitar estado inconsistente.',
          );
        }
      }

      if (runtimeMode === 'dedicated-project') {
        for (const projectId of candidateProjectIds) {
          try {
            await deleteProjectAndWait(auth, projectId);
          } catch (err) {
            console.error(`[deleteStore] GCP project deletion error for ${projectId}:`, err);
            throw new HttpsError(
              'internal',
              'No se pudo eliminar el proyecto GCP asociado. No se eliminaron datos locales para evitar recursos huérfanos.',
            );
          }
        }
      }
    }

    // Delete 'private' subcollection
    const privateRef = db.collection('stores').doc(storeId).collection('private');
    const privateDocs = await privateRef.listDocuments();
    await Promise.all(privateDocs.map((d) => d.delete()));

    // Delete 'invitations' subcollection
    const invitationsRef = db.collection('stores').doc(storeId).collection('invitations');
    const invitationsDocs = await invitationsRef.listDocuments();
    await Promise.all(invitationsDocs.map((d) => d.delete()));

    // Delete store document
    await db.collection('stores').doc(storeId).delete();

    return { success: true };
  }
);

export const connectDomain = onCall<{ storeId: string; domain: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
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

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      runtimeSiteId?: string;
    };
    const projectId = resolveRuntimeProjectId(store);
    const siteId = resolveRuntimeSiteId(store);
    const auth = await getOwnerOAuthClient();

    const tokenRes = await auth.getAccessToken();
    const res = await fetch(
      `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/domains`,
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
      console.error('connectDomain Firebase Hosting error:', res.status, text);
      throw new HttpsError('internal', 'Failed to connect domain. Please try again.');
    }

    const result = (await res.json()) as {
      requiredDnsUpdates?: {
        discovered?: Array<{
          domainName?: string;
          type?: string;
          rdata?: string;
          requiredAction?: string;
        }>;
      };
    };

    await db.collection('stores').doc(storeId).update({
      customDomain: domain,
      updatedAt: new Date(),
    });

    const dnsRecords = (result.requiredDnsUpdates?.discovered ?? []).map((record) => ({
      domainName: record.domainName || '@',
      type: record.type || 'A',
      rdata: record.rdata || '',
      requiredAction: record.requiredAction || 'ADD',
    }));
    return { success: true, dnsRecords };
  }
);

export const getActiveStores = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
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
          firebaseProjectId?: string;
          runtimeProjectId?: string;
        };
        const projectId = resolveRuntimeProjectId(store);

        const configSnap = await db
          .collection('stores')
          .doc(doc.id)
          .collection('private')
          .doc('firebaseConfig')
          .get();

        return {
          storeId: store.id,
          projectId,
          storeName: store.name,
          firebaseConfig: configSnap.exists ? JSON.stringify(configSnap.data()) : null,
        };
      })
    );

    return { stores: stores.filter((s) => s.firebaseConfig !== null) };
  }
);

export const updateStoreConfig = onCall<UpdateStoreConfigPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can update store configs.');
    }

    const { storeId, config } = request.data;
    if (!storeId || !config) {
      throw new HttpsError('invalid-argument', 'storeId and config are required.');
    }

    const configToSave = JSON.parse(JSON.stringify(config)) as Record<string, any>;
    const mercadoPago = configToSave['payments']?.['mercadoPago'] as Record<string, any> | undefined;
    if (mercadoPago) {
      mercadoPago['publicKey'] = String(mercadoPago['publicKey'] || '').trim();
      mercadoPago['accessToken'] = String(mercadoPago['accessToken'] || '').trim();
      mercadoPago['webhookUrl'] = String(mercadoPago['webhookUrl'] || '').trim();
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as { firebaseProjectId?: string; runtimeProjectId?: string };
    const projectId = resolveRuntimeProjectId(store);
    const auth = await getOwnerOAuthClient();

    if (mercadoPago) {
      if (mercadoPago['accessToken']) {
        const validation = await validateMercadoPagoCredentials(mercadoPago['accessToken'], mercadoPago['webhookUrl']);
        await upsertSecretInProject(auth, projectId, 'mp-access-token', mercadoPago['accessToken']);

        mercadoPago['accessTokenSecret'] = 'mp-access-token';
        mercadoPago['accessTokenMasked'] = maskToken(mercadoPago['accessToken']);
        mercadoPago['accountEmail'] = validation.accountEmail || '';
        mercadoPago['accountUserId'] = validation.userId || '';
        mercadoPago['validationStatus'] = 'valid';
        mercadoPago['validationMessage'] = validation.message;
        mercadoPago['validatedAt'] = new Date().toISOString();
      } else if (mercadoPago['accessTokenSecret']) {
        mercadoPago['validationStatus'] = mercadoPago['validationStatus'] || 'valid';
        mercadoPago['validationMessage'] = mercadoPago['validationMessage'] || 'Token almacenado en Secret Manager.';
      } else {
        mercadoPago['validationStatus'] = 'pending';
        mercadoPago['validationMessage'] = 'Sin token configurado.';
      }

      delete mercadoPago['accessToken'];
    }

    const { toFirestoreFields } = require('./seeds');

    let existingFields: Record<string, any> = {};
    try {
      const existingDoc = await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/storeConfig`,
        { quotaProject: projectId }
      ) as { fields?: Record<string, any> };
      existingFields = existingDoc.fields || {};
    } catch (err) {
      console.warn(`storeConfig did not exist for ${projectId}, creating new.`, err);
    }

    const incomingFields = toFirestoreFields(configToSave).fields;
    const mergedFields = { ...existingFields, ...incomingFields };

    await retry(
      () => apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/storeConfig`,
        {
          method: 'PATCH',
          body: { fields: mergedFields },
          quotaProject: projectId
        }
      ),
      5,
      6000
    );

    const centralUpdates: Record<string, any> = { updatedAt: new Date() };
    if (configToSave.storeName) centralUpdates.name = configToSave.storeName;
    if (configToSave.logoUrl !== undefined) centralUpdates.logoUrl = configToSave.logoUrl;
    await db.collection('stores').doc(storeId).update(centralUpdates);

    return { success: true };
  }
);

export const getStoreConfig = onCall<{ storeId: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can view store configs.');
    }

    const { storeId } = request.data;
    if (!storeId) {
      throw new HttpsError('invalid-argument', 'storeId is required.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as { firebaseProjectId?: string; runtimeProjectId?: string };
    const projectId = resolveRuntimeProjectId(store);
    const auth = await getOwnerOAuthClient();

    try {
      const existingDoc = await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/storeConfig`,
        { quotaProject: projectId }
      ) as { fields?: Record<string, any> };

      const parseValue = (val: any): any => {
        if (!val) return null;
        if ('stringValue' in val) return val.stringValue;
        if ('doubleValue' in val) return Number(val.doubleValue);
        if ('integerValue' in val) return Number(val.integerValue);
        if ('booleanValue' in val) return val.booleanValue;
        if ('timestampValue' in val) return val.timestampValue;
        if ('arrayValue' in val) {
          const vals = val.arrayValue?.values || [];
          return vals.map((v: any) => parseValue(v));
        }
        if ('mapValue' in val) {
          const fields = val.mapValue?.fields || {};
          const obj: Record<string, any> = {};
          for (const [k, v] of Object.entries(fields)) {
            obj[k] = parseValue(v);
          }
          return obj;
        }
        if ('nullValue' in val) return null;
        return null;
      };

      const fields = existingDoc.fields || {};
      const config: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) {
        config[k] = parseValue(v);
      }
      return { config };
    } catch (err) {
      console.warn(`storeConfig did not exist for ${projectId}`, err);
      return { config: null };
    }
  }
);


export const inviteStaff = onCall<InviteStaffPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can invite staff.');
    }

    const { storeId, email, role } = request.data;
    if (!storeId || !email || !role) {
      throw new HttpsError('invalid-argument', 'storeId, email, and role are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();
    const allowedRoles = new Set(['admin', 'warehouse', 'fulfillment', 'analyst']);
    if (!allowedRoles.has(normalizedRole)) {
      throw new HttpsError('invalid-argument', 'Invalid role for staff invitation.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as { firebaseProjectId?: string; runtimeProjectId?: string };
    const projectId = resolveRuntimeProjectId(store);

    const token = crypto.randomUUID();
    const invitationId = crypto.randomUUID();
    await db.collection('stores').doc(storeId).collection('invitations').doc(invitationId).set({
      id: invitationId,
      email: normalizedEmail,
      role: normalizedRole,
      token,
      status: 'pending',
      createdAt: new Date(),
    });

    let auth;
    try {
      auth = await getOwnerOAuthClient();
    } catch (err) {
      console.error('[inviteStaff] Failed to load GCP owner credentials.', err);
      throw new HttpsError(
        'failed-precondition',
        'No se pudo enviar la invitación real porque faltan credenciales de aprovisionamiento.'
      );
    }

    await ensureEmailPasswordSignInEnabled(auth, projectId);

    let uid: string;
    try {
      const createRes = await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
        {
          method: 'POST',
          body: { email: normalizedEmail, emailVerified: false },
          quotaProject: projectId,
        }
      ) as { localId: string };
      uid = createRes.localId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('EMAIL_EXISTS')) {
        console.error(`[inviteStaff] Failed to create auth user in ${projectId}:`, err);
        throw new HttpsError('internal', 'No se pudo crear el usuario en Firebase Auth del subproyecto.');
      }

      const lookup = (await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
        { method: 'POST', body: { email: [normalizedEmail] }, quotaProject: projectId }
      )) as { users?: Array<{ localId: string }> };

      const existing = lookup.users?.[0]?.localId;
      if (!existing) {
        throw new HttpsError('internal', 'No se encontró el usuario existente para completar la invitación.');
      }
      uid = existing;
    }

    try {
      await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
        {
          method: 'POST',
          body: {
            localId: uid,
            customAttributes: JSON.stringify({ role: normalizedRole, storeId }),
          },
          quotaProject: projectId,
        }
      );

      const { toFirestoreFields } = require('./seeds');
      const userDoc = {
        email: normalizedEmail,
        role: normalizedRole,
        displayName: '',
        joinedAt: new Date(),
      };

      await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(userDoc),
          quotaProject: projectId,
        }
      );
    } catch (err) {
      console.error(`[inviteStaff] Failed to sync claims/profile in ${projectId}:`, err);
      throw new HttpsError('internal', 'No se pudo asignar rol y perfil al usuario invitado.');
    }

    let inviteEmailSent = true;
    try {
      await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`,
        {
          method: 'POST',
          body: { requestType: 'PASSWORD_RESET', email: normalizedEmail },
          quotaProject: projectId,
        }
      );

      await db.collection('stores').doc(storeId).collection('invitations').doc(invitationId).update({
        inviteEmailSentAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (err) {
      inviteEmailSent = false;
      console.error('[inviteStaff] Failed to dispatch invitation email.', err);
      await db.collection('stores').doc(storeId).collection('invitations').doc(invitationId).update({
        inviteEmailErrorAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { success: true, token, inviteEmailSent };
  }
);

export const getStoreStaff = onCall<{ storeId: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can view store staff.');
    }

    const { storeId } = request.data;
    if (!storeId) {
      throw new HttpsError('invalid-argument', 'storeId is required.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as { firebaseProjectId?: string; runtimeProjectId?: string };
    const projectId = resolveRuntimeProjectId(store);

    let users: Array<{ uid: string; email: string; role: string; displayName?: string; joinedAt?: string }> = [];
    try {
      const auth = await getOwnerOAuthClient();
      const usersRes = await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`,
        { quotaProject: projectId }
      ) as { documents?: Array<{ name: string; fields: Record<string, any> }> };

      if (usersRes.documents) {
        users = usersRes.documents.map((doc) => {
          const parts = doc.name.split('/');
          const uid = parts[parts.length - 1];
          const fields = doc.fields;

          return {
            uid,
            email: fields['email']?.stringValue || '',
            role: fields['role']?.stringValue || '',
            displayName: fields['displayName']?.stringValue || '',
            joinedAt: fields['joinedAt']?.timestampValue || '',
          };
        });
      }
    } catch (err) {
      console.warn(`[getStoreStaff] Failed to load auth users for project ${projectId}. Likely missing GCP credentials or project does not exist physically.`, err);
    }

    let invitations: any[] = [];
    try {
      const invitationsSnap = await db.collection('stores').doc(storeId).collection('invitations').get();
      invitations = invitationsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: data['email'],
          role: data['role'],
          status: data['status'],
          createdAt: data['createdAt']?.toDate().toISOString(),
        };
      });
    } catch (err) {
      console.error(`[getStoreStaff] Failed to load local invitations from Firestore:`, err);
    }

    return { users, staff: users, invitations };
  }
);

export const verifyDomainDNSStatus = onCall<{ storeId: string; domain: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can verify domains.');
    }

    const { storeId, domain } = request.data;
    if (!storeId || !domain) {
      throw new HttpsError('invalid-argument', 'storeId and domain are required.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      runtimeSiteId?: string;
    };
    const projectId = resolveRuntimeProjectId(store);
    const siteId = resolveRuntimeSiteId(store);
    const auth = await getOwnerOAuthClient();

    const tokenRes = await auth.getAccessToken();
    const res = await fetch(
      `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/domains/${domain}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenRes.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('verifyDomainDNSStatus Firebase Hosting error:', res.status, text);
      throw new HttpsError('internal', 'Failed to retrieve domain status.');
    }

    const result = (await res.json()) as {
      status?: string;
      requiredDnsUpdates?: {
        discovered?: Array<{
          domainName?: string;
          type?: string;
          rdata?: string;
          requiredAction?: string;
        }>;
      };
    };

    const rawStatus = result.status || 'PENDING';
    const normalizedStatus = rawStatus === 'ACTIVE' || rawStatus === 'LIVE' ? 'live' : 'pending';
    const dnsRecords = (result.requiredDnsUpdates?.discovered ?? []).map((record) => ({
      domainName: record.domainName || '@',
      type: record.type || 'A',
      rdata: record.rdata || '',
      requiredAction: record.requiredAction || 'ADD',
    }));

    return { success: true, status: normalizedStatus, rawStatus, dnsRecords };
  }
);

export const seedStore = onCall<{ storeId: string; includeMockData?: boolean }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can seed store data.');
    }

    const { storeId, includeMockData = true } = request.data;
    if (!storeId) {
      throw new HttpsError('invalid-argument', 'storeId is required.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as {
      name: string;
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      verticalId?: string;
    };
    const projectId = resolveRuntimeProjectId(store);
    const fallbackProjectId =
      store.firebaseProjectId && store.firebaseProjectId !== projectId ? store.firebaseProjectId : null;
    const verticalId = store.verticalId || 'retail';

    const auth = await getOwnerOAuthClient();
    const { seedStoreData } = require('./seeds');

    try {
      await seedStoreData(auth, projectId, verticalId, store.name, includeMockData !== false);
      return { success: true };
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      const shouldRetryWithFallback =
        !!fallbackProjectId &&
        (message.toLowerCase().includes('permission denied') ||
          message.toLowerCase().includes('service_disabled') ||
          message.toLowerCase().includes('consumer_invalid'));

      if (shouldRetryWithFallback) {
        try {
          await seedStoreData(auth, fallbackProjectId, verticalId, store.name, includeMockData !== false);
          await db.collection('stores').doc(storeId).update({
            runtimeProjectId: fallbackProjectId,
            updatedAt: new Date(),
          });
          return { success: true, warning: `runtimeProjectId updated to ${fallbackProjectId}` };
        } catch (fallbackErr) {
          console.error(
            `Error seeding store ${storeId} (fallback project: ${fallbackProjectId}):`,
            fallbackErr,
          );
        }
      }

      console.error(`Error seeding store ${storeId} (project: ${projectId}):`, err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpsError('internal', `Failed to seed store data: ${msg}`);
    }
  }
);

export const generatePasswordResetLink = onCall<{ storeId: string; email: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can generate reset links.');
    }

    const { storeId, email } = request.data;
    if (!storeId || !email) {
      throw new HttpsError('invalid-argument', 'storeId and email are required.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as { firebaseProjectId?: string; runtimeProjectId?: string };
    const projectId = resolveRuntimeProjectId(store);
    const auth = await getOwnerOAuthClient();

    try {
      const oobRes = (await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`,
        {
          method: 'POST',
          body: { requestType: 'PASSWORD_RESET', email, returnOobLink: true },
          quotaProject: projectId,
        }
      )) as { oobCode?: string; oobLink?: string };

      const actionLink =
        oobRes.oobLink ||
        (oobRes.oobCode
          ? `https://${projectId}.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=${oobRes.oobCode}`
          : '');

      if (!actionLink) {
        throw new Error('No reset link was returned by Identity Toolkit.');
      }
      return { success: true, actionLink };
    } catch (err: any) {
      console.error(`[generatePasswordResetLink] Failed for ${email} in ${projectId}:`, err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpsError('internal', `Failed to generate link: ${msg}`);
    }
  }
);

