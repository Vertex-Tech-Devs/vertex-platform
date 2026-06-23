import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import {
  ALLOWED_ORIGINS,
  PLATFORM_PROJECT,
  getOwnerOAuthClient,
  getGitHubPat,
  getDeployToken,
  apiFetch,
  retry,
  listProvisioningOwnerCandidates,
  sendDirectEmail,
} from './helpers';
import { resolvePlatformEnvironment, summarizeShardCapacity } from './runtime';
import type {
  InviteStaffPayload,
  StoreRuntimeMode,
  StoreShard,
  UpdateStoreConfigPayload,
} from './types';

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

function isOwnerOrSuperAdmin(
  authEmail: string | undefined,
  ownerEmail: string | undefined,
): boolean {
  if (!authEmail) return false;
  const superAdmins = [
    'juan.l.espeche@gmail.com',
    'leivalihue@gmail.com',
    'vertex.tech.dev@gmail.com',
  ];
  return superAdmins.includes(authEmail) || authEmail === ownerEmail;
}

export async function logAuditAction(
  userId: string,
  email: string | undefined,
  action: string,
  targetId: string,
  result: 'success' | 'failure',
  details?: Record<string, any>,
): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection('auditLog').add({
      userId,
      email: email || null,
      action,
      targetId,
      timestamp: new Date(),
      result,
      details: details || null,
    });
  } catch (err) {
    console.error('[logAuditAction] Failed to write audit log:', err);
  }
}

export async function checkRateLimit(
  uid: string | undefined,
  action: string,
  maxCalls: number,
  windowMinutes: number,
): Promise<void> {
  if (process.env.FUNCTIONS_EMULATOR === 'true') return;
  if (!uid) return;
  const db = getFirestore();
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const snap = await db
    .collection('auditLog')
    .where('userId', '==', uid)
    .where('action', '==', action)
    .where('timestamp', '>', cutoff)
    .get();

  if (snap.size >= maxCalls) {
    throw new HttpsError(
      'resource-exhausted',
      `Límite de solicitudes excedido para la acción: ${action}. Por favor, intentá de nuevo más tarde.`,
    );
  }
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
    'x-goog-user-project': PLATFORM_PROJECT,
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
  } else if (domainsRes.status !== 404 && domainsRes.status !== 403) {
    const body = await domainsRes.text();
    throw new Error(
      `[deleteStore] Failed listing Hosting domains for ${projectId}/${siteId}: ${domainsRes.status} ${body}`,
    );
  } else if (domainsRes.status === 403) {
    // Some owners can delete a site but cannot list domains on it.
    console.warn(
      `[deleteStore] Skipping domain cleanup for ${projectId}/${siteId} due to 403 on domain listing.`,
    );
  }

  if (siteId === projectId || siteId === 'default') {
    console.log(
      `[deleteStore] Site ${siteId} is the default site for project ${projectId}. Skipping site resource deletion call to avoid Firebase error. Custom domains have been successfully cleaned up.`,
    );
    return;
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

async function deployHostingTombstone(
  auth: Awaited<ReturnType<typeof getOwnerOAuthClient>>,
  projectId: string,
  siteId: string,
): Promise<void> {
  const tokenRes = await auth.getAccessToken();
  const headers = {
    Authorization: `Bearer ${tokenRes.token}`,
    'Content-Type': 'application/json',
    'x-goog-user-project': PLATFORM_PROJECT,
  };

  const createVersionRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/versions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: 'CREATED',
        config: {},
      }),
    },
  );

  if (!createVersionRes.ok) {
    const body = await createVersionRes.text();
    throw new Error(
      `[runtimeCleanup] Failed creating tombstone version for ${projectId}/${siteId}: ${createVersionRes.status} ${body}`,
    );
  }

  const createVersionData = (await createVersionRes.json()) as { name?: string };
  const versionName = (createVersionData.name || '').trim();
  if (!versionName) {
    throw new Error(
      `[runtimeCleanup] Missing version name when creating tombstone for ${projectId}/${siteId}.`,
    );
  }

  const populateRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ files: {} }),
    },
  );

  if (!populateRes.ok) {
    const body = await populateRes.text();
    throw new Error(
      `[runtimeCleanup] Failed populating tombstone version for ${projectId}/${siteId}: ${populateRes.status} ${body}`,
    );
  }

  const releaseRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/releases?versionName=${encodeURIComponent(versionName)}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'runtime-cleanup-tombstone' }),
    },
  );

  if (!releaseRes.ok) {
    const body = await releaseRes.text();
    throw new Error(
      `[runtimeCleanup] Failed releasing tombstone version for ${projectId}/${siteId}: ${releaseRes.status} ${body}`,
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
        throw new Error(
          `[deleteStore] Project deletion failed for ${projectId}: ${operation.error.message}`,
        );
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`[deleteStore] Project deletion operation timed out for ${projectId}`);
}

function isProjectAlreadyDeletedOrInactiveError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('project not active') ||
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('failed_precondition')
  );
}

function isHostingAlreadyGoneOrInactiveError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('not found') || msg.includes('404') || msg.includes('site not found');
}

function getCandidateSiteIds(runtimeSiteId: string, projectId: string): string[] {
  const candidates = [runtimeSiteId, projectId, 'default']
    .map((value) => (value || '').trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(candidates));
}

async function withAnyProvisioningOwner<T>(
  db: ReturnType<typeof getFirestore>,
  preferredOwnerId: string | undefined,
  operation: (auth: Awaited<ReturnType<typeof getOwnerOAuthClient>>, ownerId: string) => Promise<T>,
): Promise<T> {
  const owners = await listProvisioningOwnerCandidates(db, preferredOwnerId);
  let lastErr: unknown = null;

  for (const owner of owners) {
    try {
      const ownerAuth = await getOwnerOAuthClient(owner.id);
      return await operation(ownerAuth, owner.id);
    } catch (err) {
      lastErr = err;
      console.error(`[runtimeCleanup] owner ${owner.id} failed:`, err);
    }
  }

  throw lastErr ?? new Error('No provisioning owner could execute runtime cleanup operation.');
}

async function enqueueRuntimeCleanupTask(
  db: ReturnType<typeof getFirestore>,
  payload: {
    storeId?: string;
    preferredOwnerId?: string;
    projectIds: string[];
    siteId: string;
    runtimeMode: StoreRuntimeMode;
    reason: string;
  },
): Promise<void> {
  await db.collection('runtimeCleanupTasks').add({
    storeId: payload.storeId ?? null,
    preferredOwnerId: payload.preferredOwnerId ?? null,
    projectIds: payload.projectIds,
    siteId: payload.siteId,
    runtimeMode: payload.runtimeMode,
    reason: payload.reason,
    status: 'pending',
    attempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export const getRuntimeCapacitySummary = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError(
        'permission-denied',
        'Only platform admins can inspect runtime capacity.',
      );
    }

    const db = getFirestore();
    const environment = resolvePlatformEnvironment();

    // 1. Fetch shards and extract unique projects
    const shardsSnap = await db.collection('shards').where('environment', '==', environment).get();
    const shards = shardsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as StoreShard)
      .filter((shard) => shard.runtimeMode === 'shared-shard');
    const shardProjectIds = new Set(shards.map((s) => s.projectId).filter(Boolean));

    // 2. Fetch dedicated project stores and extract unique projects
    const storesSnap = await db
      .collection('stores')
      .where('runtimeMode', '==', 'dedicated-project')
      .where('status', '==', 'active')
      .get();
    const dedicatedProjectIds = new Set(
      storesSnap.docs.map((doc) => doc.data()['projectId']).filter(Boolean),
    );

    // 3. Count total unique active projects
    const totalActiveProjects = new Set([...shardProjectIds, ...dedicatedProjectIds]).size;

    // 4. Fetch billing account max limit
    const billingAccountsSnap = await db
      .collection('billingAccounts')
      .where('active', '==', true)
      .get();
    let maxProjectsLimit = 15; // default fallback
    if (!billingAccountsSnap.empty) {
      maxProjectsLimit = billingAccountsSnap.docs[0].data()['maxProjects'] || 15;
    }

    // 5. Calculate usage metrics and check warning threshold (80%)
    const projectUsageRatio = maxProjectsLimit > 0 ? totalActiveProjects / maxProjectsLimit : 0;
    const quotaWarning = projectUsageRatio >= 0.8;

    return {
      summary: summarizeShardCapacity(shards, environment),
      totalActiveProjects,
      maxProjectsLimit,
      projectUsageRatio,
      quotaWarning,
    };
  },
);

function maskToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

async function validateMercadoPagoCredentials(
  accessToken: string,
  webhookUrl?: string,
): Promise<{ message: string; accountEmail?: string; userId?: string }> {
  const token = accessToken.trim();
  if (!token) {
    throw new HttpsError('invalid-argument', 'El access token de Mercado Pago es obligatorio.');
  }

  const webhook = (webhookUrl || '').trim();
  if (webhook && !/^https:\/\//i.test(webhook)) {
    throw new HttpsError(
      'invalid-argument',
      'El webhook de Mercado Pago debe comenzar con https://',
    );
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

    // Test call to /v1/preferences to verify preference creation permissions
    const testPrefRes = await fetch('https://api.mercadopago.com/v1/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: 'Test Preference Validation',
            quantity: 1,
            unit_price: 1.0,
          },
        ],
      }),
    });

    if (testPrefRes.status === 403) {
      throw new Error(
        'El token de Mercado Pago no tiene permisos para crear preferencias de pago (/v1/preferences).',
      );
    }

    return {
      message: `Credenciales válidas para ${user.email || 'cuenta sin email'}.`,
      accountEmail: user.email || undefined,
      userId: user.id ? String(user.id) : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError(
      'invalid-argument',
      `No se pudieron validar las credenciales de Mercado Pago. ${msg}`,
    );
  }
}

async function upsertSecretInProject(
  auth: Awaited<ReturnType<typeof getOwnerOAuthClient>>,
  projectId: string,
  secretId: string,
  secretValue: string,
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
    },
  );

  if (!createRes.ok && createRes.status !== 409) {
    const text = await createRes.text();
    throw new HttpsError(
      'internal',
      `No se pudo crear el secreto de Mercado Pago: ${createRes.status} ${text}`,
    );
  }

  const addVersionRes = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${encodeURIComponent(secretId)}:addVersion`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        payload: { data: Buffer.from(secretValue, 'utf8').toString('base64') },
      }),
    },
  );

  if (!addVersionRes.ok) {
    const text = await addVersionRes.text();
    throw new HttpsError(
      'internal',
      `No se pudo guardar versión del secreto de Mercado Pago: ${addVersionRes.status} ${text}`,
    );
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
            tenant_id: store.slug,
            project_id: projectId,
            firebase_config: JSON.stringify(firebaseConfig),
            store_name: store.name,
            ref: ref,
          },
        }),
      },
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
  },
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
      provisioningOwnerId?: string;
      shardId?: string;
    };

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
      await enqueueRuntimeCleanupTask(db, {
        storeId,
        preferredOwnerId: store.provisioningOwnerId,
        projectIds: candidateProjectIds,
        siteId,
        runtimeMode,
        reason: 'deleteStore-postcheck',
      });
    }

    // Delete 'private' subcollection
    const privateRef = db.collection('stores').doc(storeId).collection('private');
    const privateDocs = await privateRef.listDocuments();
    await Promise.all(privateDocs.map((d) => d.delete()));

    // Delete 'invitations' subcollection
    const invitationsRef = db.collection('stores').doc(storeId).collection('invitations');
    const invitationsDocs = await invitationsRef.listDocuments();
    await Promise.all(invitationsDocs.map((d) => d.delete()));

    // Decrement the activeStores count on the shard if this store was hosted on a shared-shard
    if (store.runtimeMode === 'shared-shard' && store.shardId) {
      const shardRef = db.collection('shards').doc(store.shardId);
      try {
        await db.runTransaction(async (transaction) => {
          const shardSnap = await transaction.get(shardRef);
          if (shardSnap.exists) {
            const currentActive = shardSnap.data()?.activeStores || 0;
            transaction.update(shardRef, {
              activeStores: Math.max(0, currentActive - 1),
              updatedAt: new Date(),
            });
          }
        });
      } catch (err) {
        console.error(
          `[deleteStore] Failed to decrement activeStores on shard ${store.shardId}:`,
          err,
        );
      }
    }

    // Delete store document
    await db.collection('stores').doc(storeId).delete();

    await logAuditAction(
      request.auth?.uid || 'unknown',
      request.auth?.token.email as string | undefined,
      'deleteStore',
      storeId,
      'success',
    );

    return { success: true };
  },
);

export const processRuntimeCleanupTask = onDocumentCreated(
  { document: 'runtimeCleanupTasks/{taskId}', timeoutSeconds: 300 },
  async (event) => {
    const snap = event.data;
    if (!snap?.exists) {
      return;
    }

    const db = getFirestore();
    const taskId = event.params['taskId'];
    const taskRef = db.collection('runtimeCleanupTasks').doc(taskId);
    const task = snap.data() as {
      preferredOwnerId?: string | null;
      projectIds?: string[];
      siteId?: string;
      runtimeMode?: StoreRuntimeMode;
      attempts?: number;
    };

    const projectIds = Array.from(
      new Set((task.projectIds ?? []).map((id) => (id || '').trim()).filter((id) => id.length > 0)),
    );
    const siteId = (task.siteId || 'default').trim() || 'default';
    const runtimeMode = task.runtimeMode ?? 'dedicated-project';

    if (projectIds.length === 0) {
      await taskRef.set(
        {
          status: 'error',
          lastError: 'No projectIds provided for cleanup task.',
          updatedAt: new Date(),
        },
        { merge: true },
      );
      return;
    }

    await taskRef.set(
      {
        status: 'running',
        attempts: (task.attempts ?? 0) + 1,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    try {
      if (runtimeMode === 'dedicated-project') {
        for (const projectId of projectIds) {
          const candidateSiteIds = getCandidateSiteIds(siteId, projectId);

          // 1. Clean up hosting site custom domains
          let hostingDeleted = false;
          let hostingCandidateGone = false;
          let lastHostingError: unknown = null;
          for (const candidateSiteId of candidateSiteIds) {
            try {
              await withAnyProvisioningOwner(db, task.preferredOwnerId ?? undefined, async (auth) =>
                deleteHostingSite(auth, projectId, candidateSiteId),
              );
              hostingDeleted = true;
              break;
            } catch (err) {
              if (isHostingAlreadyGoneOrInactiveError(err)) {
                hostingCandidateGone = true;
                continue;
              }
              lastHostingError = err;
            }
          }

          if (!hostingDeleted) {
            if (lastHostingError) {
              throw lastHostingError;
            }
            if (!hostingCandidateGone) {
              throw new Error(
                `[runtimeCleanup] No Hosting site candidate could be validated for ${projectId}.`,
              );
            }
          }

          // 2. Deploy Tombstone immediately (Defensive Fallback)
          // We deploy this BEFORE attempting project deletion so that if project deletion fails or times out,
          // the canal is already safely tombstoned publicly.
          for (const candidateSiteId of candidateSiteIds) {
            try {
              await withAnyProvisioningOwner(db, task.preferredOwnerId ?? undefined, async (auth) =>
                deployHostingTombstone(auth, projectId, candidateSiteId),
              );
              break;
            } catch (err) {
              if (isHostingAlreadyGoneOrInactiveError(err)) {
                continue;
              }
              console.warn(
                `[runtimeCleanup] Tombstone deploy failed for candidate ${candidateSiteId}:`,
                err,
              );
            }
          }

          // 3. Attempt physical project deletion
          try {
            await withAnyProvisioningOwner(db, task.preferredOwnerId ?? undefined, async (auth) =>
              deleteProjectAndWait(auth, projectId),
            );
          } catch (err) {
            if (!isProjectAlreadyDeletedOrInactiveError(err)) {
              throw err;
            }
          }
        }
      } else {
        // shared-shard: tombstone first to deactivate the store immediately,
        // then clean up the custom hosting site (non-blocking if already gone).
        for (const projectId of projectIds) {
          const candidateSiteIds = getCandidateSiteIds(siteId, projectId);

          // 1. Deploy tombstone first so the store goes dark instantly
          for (const candidateSiteId of candidateSiteIds) {
            try {
              await withAnyProvisioningOwner(db, task.preferredOwnerId ?? undefined, async (auth) =>
                deployHostingTombstone(auth, projectId, candidateSiteId),
              );
              break;
            } catch (err) {
              if (isHostingAlreadyGoneOrInactiveError(err)) {
                continue;
              }
              console.warn(
                `[runtimeCleanup] Tombstone deploy failed for shared-shard candidate ${candidateSiteId}:`,
                err,
              );
            }
          }

          // 2. Delete the custom hosting site (skip if it's the project default site)
          let hostingDeleted = false;
          let hostingAlreadyGone = false;
          let lastHostingError: unknown = null;
          for (const candidateSiteId of candidateSiteIds) {
            try {
              await withAnyProvisioningOwner(db, task.preferredOwnerId ?? undefined, async (auth) =>
                deleteHostingSite(auth, projectId, candidateSiteId),
              );
              hostingDeleted = true;
              break;
            } catch (err) {
              if (isHostingAlreadyGoneOrInactiveError(err)) {
                hostingAlreadyGone = true;
                continue;
              }
              lastHostingError = err;
            }
          }

          if (!hostingDeleted && !hostingAlreadyGone && lastHostingError) {
            throw lastHostingError;
          }
        }
      }

      await taskRef.set(
        {
          status: 'done',
          completedAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await taskRef.set(
        {
          status: 'error',
          lastError: msg,
          updatedAt: new Date(),
        },
        { merge: true },
      );
      throw err;
    }
  },
);

export const connectDomain = onCall<{ storeId: string; domain: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can connect domains.');
    }

    const { storeId, domain } = request.data;
    if (!storeId || !/^[a-zA-Z0-9_-]{1,100}$/.test(storeId)) {
      throw new HttpsError('invalid-argument', 'Invalid storeId.');
    }
    if (
      !domain ||
      !/^(?!.*\.\.)(?!.*\.$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(
        domain,
      )
    ) {
      throw new HttpsError('invalid-argument', 'Invalid domain format.');
    }

    await checkRateLimit(request.auth?.uid, 'connectDomain', 10, 15);

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      runtimeSiteId?: string;
      ownerEmail?: string;
    };

    const authEmail = request.auth?.token.email as string | undefined;
    if (!isOwnerOrSuperAdmin(authEmail, store.ownerEmail)) {
      throw new HttpsError('permission-denied', 'You do not have permission to manage this store.');
    }

    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      await db.collection('stores').doc(storeId).update({
        customDomain: domain,
        updatedAt: new Date(),
      });
      const dnsRecords = [
        { domainName: domain, type: 'A', rdata: '199.36.158.100', requiredAction: 'ADD' },
        {
          domainName: `www.${domain}`,
          type: 'CNAME',
          rdata: `${storeId}.web.app`,
          requiredAction: 'ADD',
        },
      ];
      return { success: true, dnsRecords };
    }

    const projectId = resolveRuntimeProjectId(store);
    if (!projectId) {
      throw new HttpsError('failed-precondition', 'Store has no associated Firebase project.');
    }
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
      },
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

    const discovered = result.requiredDnsUpdates?.discovered;
    const dnsRecordsList = Array.isArray(discovered) ? discovered : [];
    const dnsRecords = dnsRecordsList.map((record) => ({
      domainName: record?.domainName || '@',
      type: record?.type || 'A',
      rdata: record?.rdata || '',
      requiredAction: record?.requiredAction || 'ADD',
    }));

    await logAuditAction(
      request.auth?.uid || 'unknown',
      authEmail,
      'connectDomain',
      storeId,
      'success',
      { domain },
    );

    return { success: true, dnsRecords };
  },
);

export const getActiveStores = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    const deployToken = request.data?.deployToken as string | undefined;
    const isAdmin = !!request.auth?.token['platformAdmin'];

    if (!isAdmin && deployToken) {
      const expected = await getDeployToken();
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
          slug?: string;
          tenantId?: string;
          runtimeSiteId?: string;
          autoUpdate?: boolean;
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
          tenantId: store.slug || store.tenantId || store.id,
          siteId: store.runtimeSiteId || store.id,
          autoUpdate: store.autoUpdate ?? false,
          projectId,
          storeName: store.name,
          firebaseConfig: configSnap.exists ? JSON.stringify(configSnap.data()) : null,
        };
      }),
    );

    return { stores: stores.filter((s) => s.firebaseConfig !== null) };
  },
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
    const mercadoPago = configToSave['payments']?.['mercadoPago'] as
      | Record<string, any>
      | undefined;
    if (mercadoPago) {
      mercadoPago['publicKey'] = String(mercadoPago['publicKey'] || '').trim();
      mercadoPago['accessToken'] = String(mercadoPago['accessToken'] || '').trim();
      mercadoPago['webhookUrl'] = String(mercadoPago['webhookUrl'] || '').trim();
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      runtimeMode?: string;
      tenantId?: string;
      slug?: string;
    };
    const projectId = resolveRuntimeProjectId(store);
    const tenantId = store.tenantId || store.slug || storeId;
    const isSharedShard = (store.runtimeMode || 'dedicated-project') === 'shared-shard';
    const configPath = isSharedShard
      ? `tenants/${tenantId}/configuracion/store`
      : 'configuracion/store';
    const auth = await getOwnerOAuthClient();

    if (mercadoPago) {
      if (mercadoPago['accessToken']) {
        const validation = await validateMercadoPagoCredentials(
          mercadoPago['accessToken'],
          mercadoPago['webhookUrl'],
        );
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
        mercadoPago['validationMessage'] =
          mercadoPago['validationMessage'] || 'Token almacenado en Secret Manager.';
      } else {
        mercadoPago['validationStatus'] = 'pending';
        mercadoPago['validationMessage'] = 'Sin token configurado.';
      }

      delete mercadoPago['accessToken'];
    }

    const { toFirestoreFields } = require('./seeds');

    let existingFields: Record<string, any> = {};
    try {
      const existingDoc = (await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${configPath}`,
        { quotaProject: projectId },
      )) as { fields?: Record<string, any> };
      existingFields = existingDoc.fields || {};
    } catch (err) {
      console.warn(`storeConfig did not exist for ${projectId}, creating new.`, err);
    }

    const incomingFields = toFirestoreFields(configToSave).fields;
    const mergedFields = { ...existingFields, ...incomingFields };

    await retry(
      () =>
        apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${configPath}`,
          {
            method: 'PATCH',
            body: { fields: mergedFields },
            quotaProject: projectId,
          },
        ),
      5,
      6000,
    );

    const centralUpdates: Record<string, any> = { updatedAt: new Date() };
    if (configToSave.storeName) centralUpdates.name = configToSave.storeName;
    if (configToSave.logoUrl !== undefined) centralUpdates.logoUrl = configToSave.logoUrl;
    await db.collection('stores').doc(storeId).update(centralUpdates);

    return { success: true };
  },
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

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      runtimeMode?: string;
      tenantId?: string;
      slug?: string;
    };
    const projectId = resolveRuntimeProjectId(store);
    const tenantId = store.tenantId || store.slug || storeId;
    const isSharedShard = (store.runtimeMode || 'dedicated-project') === 'shared-shard';
    const configPath = isSharedShard
      ? `tenants/${tenantId}/configuracion/store`
      : 'configuracion/store';
    const auth = await getOwnerOAuthClient();

    try {
      const existingDoc = (await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${configPath}`,
        { quotaProject: projectId },
      )) as { fields?: Record<string, any> };

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
  },
);

export const inviteStaff = onCall<InviteStaffPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can invite staff.');
    }

    await checkRateLimit(request.auth?.uid, 'inviteStaff', 15, 15);

    const { storeId, email, role } = request.data;
    if (!storeId || !email || !role) {
      throw new HttpsError('invalid-argument', 'storeId, email, and role are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();
    const allowedRoles = new Set(['admin']);
    if (!allowedRoles.has(normalizedRole)) {
      throw new HttpsError('invalid-argument', 'Invalid role for staff invitation.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      runtimeSiteId?: string;
      runtimeMode?: string;
      name?: string;
      tenantId?: string;
      slug?: string;
    };
    const projectId = resolveRuntimeProjectId(store);
    const storeName = store.name || storeId;
    const tenantId = store.tenantId || store.slug || storeId;
    const loginUrl = store.runtimeSiteId
      ? `https://${store.runtimeSiteId}.web.app/admin/login`
      : `https://${projectId}.web.app/admin/login`;

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

    let auth: any;
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      const compositeKey = `${tenantId}_${normalizedEmail}`;
      await db.collection('admin_roles').doc(compositeKey).set({
        role: normalizedRole,
        tenantId: tenantId,
        source: 'vertex-platform-invite',
        updatedAt: new Date(),
      });
      const mockUid = `mock-uid-${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;
      await db.collection('users').doc(mockUid).set({
        email: normalizedEmail,
        role: normalizedRole,
        displayName: 'Invited Staff (Mock)',
        joinedAt: new Date(),
      });
    } else {
      try {
        auth = await getOwnerOAuthClient();
      } catch (err) {
        console.error('[inviteStaff] Failed to load GCP owner credentials.', err);
        throw new HttpsError(
          'failed-precondition',
          'No se pudo enviar la invitación real porque faltan credenciales de aprovisionamiento.',
        );
      }

      try {
        const encodedEmail = encodeURIComponent(normalizedEmail);
        const compositeKey = `${tenantId}_${encodedEmail}`;
        await apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admin_roles/${compositeKey}`,
          {
            method: 'PATCH',
            body: {
              fields: {
                role: { stringValue: normalizedRole },
                tenantId: { stringValue: tenantId },
                source: { stringValue: 'vertex-platform-invite' },
                updatedAt: { timestampValue: new Date().toISOString() },
              },
            },
            quotaProject: projectId,
          },
        );
      } catch (err) {
        console.error(`[inviteStaff] Failed to write admin_roles in ${projectId}:`, err);
        throw new HttpsError(
          'internal',
          'No se pudo preautorizar el correo en la tienda destino para OAuth de Google.',
        );
      }
    }

    let inviteEmailSent = true;
    try {
      const emailSubject = `Acceso de administrador habilitado para ${storeName} - Vertex`;
      const emailHtml = `
        <div style="background:#f1f5f9;padding:28px 16px;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="padding:20px 24px;background:linear-gradient(120deg,#0f172a,#1d4ed8);color:#ffffff;">
              <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">Vertex Platform</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;">Tu acceso de administrador está listo</h1>
            </div>
            <div style="padding:24px;">
              <p style="margin:0 0 14px;color:#0f172a;font-size:15px;line-height:1.55;">
                Se te otorgó acceso de administrador para la tienda <strong>${storeName}</strong>.
              </p>
              <p style="margin:0 0 18px;color:#334155;font-size:14px;">Rol asignado: <strong>Administrador</strong></p>
              <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.5;">
                Ingresá con tu cuenta de Google usando esta misma dirección de email.
              </p>
              <p style="margin:0 0 22px;">
                <a href="${loginUrl}" style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">Ingresar al panel</a>
              </p>
              <p style="margin:0 0 10px;color:#64748b;font-size:12px;line-height:1.45;">
                Si el botón no funciona, copiá y pegá el siguiente enlace en tu navegador:
              </p>
              <p style="margin:0;color:#1d4ed8;font-size:12px;word-break:break-all;">${loginUrl}</p>
            </div>
          </div>
        </div>
      `;

      try {
        if (process.env.FUNCTIONS_EMULATOR === 'true') {
          await db
            .collection('tenants')
            .doc(tenantId)
            .collection('mail')
            .add({
              to: [normalizedEmail],
              message: {
                subject: emailSubject,
                html: emailHtml,
                text: `Tenés acceso de administrador para la tienda ${storeName}. Ingresá con Google OAuth: ${loginUrl}`,
              },
              createdAt: new Date(),
            });
          console.info(
            `[inviteStaff] Staff invitation email successfully written to emulator storefront tenant mail collection.`,
          );
        } else if (projectId === PLATFORM_PROJECT) {
          await sendDirectEmail(
            normalizedEmail,
            emailSubject,
            emailHtml,
            `Tenés acceso de administrador para la tienda ${storeName}. Ingresá con Google OAuth: ${loginUrl}`,
          );
          console.info(
            `[inviteStaff] Staff invitation email successfully sent directly to ${normalizedEmail} using SMTP.`,
          );
        } else {
          const mailDocFields = {
            to: {
              arrayValue: {
                values: [{ stringValue: normalizedEmail }],
              },
            },
            message: {
              mapValue: {
                fields: {
                  subject: { stringValue: emailSubject },
                  html: { stringValue: emailHtml },
                  text: {
                    stringValue: `Tenés acceso de administrador para la tienda ${storeName}. Ingresá con Google OAuth: ${loginUrl}`,
                  },
                },
              },
            },
            createdAt: {
              timestampValue: new Date().toISOString(),
            },
          };

          await apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/mail`,
            {
              method: 'POST',
              body: { fields: mailDocFields },
              quotaProject: projectId,
            },
          );
          console.info(
            `[inviteStaff] Staff invitation email successfully queued in store ${projectId}'s mail collection.`,
          );
        }
      } catch (mailErr) {
        console.warn(
          `[inviteStaff] Failed to queue invitation email in store ${projectId}'s mail collection, falling back to central mail queue:`,
          mailErr,
        );
        // Fallback to central platform mail collection
        await db.collection('mail').add({
          to: [normalizedEmail],
          message: {
            subject: emailSubject,
            html: emailHtml,
            text: `Tenés acceso de administrador para la tienda ${storeName}. Ingresá con Google OAuth: ${loginUrl}`,
          },
        });
      }

      await db
        .collection('stores')
        .doc(storeId)
        .collection('invitations')
        .doc(invitationId)
        .update({
          inviteEmailSentAt: new Date(),
          updatedAt: new Date(),
        });
    } catch (err) {
      inviteEmailSent = false;
      console.error('[inviteStaff] Failed to dispatch invitation email.', err);
      await db
        .collection('stores')
        .doc(storeId)
        .collection('invitations')
        .doc(invitationId)
        .update({
          inviteEmailErrorAt: new Date(),
          updatedAt: new Date(),
        });
    }

    await logAuditAction(
      request.auth?.uid || 'unknown',
      request.auth?.token.email as string | undefined,
      'inviteStaff',
      storeId,
      'success',
      { email: normalizedEmail, role: normalizedRole, inviteEmailSent },
    );

    return { success: true, token, inviteEmailSent };
  },
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

    let users: Array<{
      uid: string;
      email: string;
      role: string;
      displayName?: string;
      joinedAt?: string;
    }> = [];
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      try {
        const usersSnap = await db.collection('users').get();
        users = usersSnap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: data['email'] || '',
            role: data['role'] || '',
            displayName: data['displayName'] || '',
            joinedAt:
              data['joinedAt'] instanceof Date
                ? data['joinedAt'].toISOString()
                : data['joinedAt'] || '',
          };
        });
      } catch (err) {
        console.error('[getStoreStaff] Failed to load local users in emulator:', err);
      }
    } else {
      try {
        const auth = await getOwnerOAuthClient();
        const usersRes = (await apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`,
          { quotaProject: projectId },
        )) as { documents?: Array<{ name: string; fields: Record<string, any> }> };

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
        console.warn(
          `[getStoreStaff] Failed to load auth users for project ${projectId}. Likely missing GCP credentials or project does not exist physically.`,
          err,
        );
      }
    }

    let invitations: any[] = [];
    try {
      const invitationsSnap = await db
        .collection('stores')
        .doc(storeId)
        .collection('invitations')
        .get();
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
  },
);

export const verifyDomainDNSStatus = onCall<{ storeId: string; domain: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can verify domains.');
    }

    const { storeId, domain } = request.data;
    if (!storeId || !/^[a-zA-Z0-9_-]{1,100}$/.test(storeId)) {
      throw new HttpsError('invalid-argument', 'Invalid storeId.');
    }
    if (
      !domain ||
      !/^(?!.*\.\.)(?!.*\.$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(
        domain,
      )
    ) {
      throw new HttpsError('invalid-argument', 'Invalid domain format.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as {
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      runtimeSiteId?: string;
      ownerEmail?: string;
    };

    const authEmail = request.auth?.token.email as string | undefined;
    if (!isOwnerOrSuperAdmin(authEmail, store.ownerEmail)) {
      throw new HttpsError('permission-denied', 'You do not have permission to manage this store.');
    }

    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      const dnsRecords = [
        { domainName: domain, type: 'A', rdata: '199.36.158.100', requiredAction: 'ADD' },
        {
          domainName: `www.${domain}`,
          type: 'CNAME',
          rdata: `${storeId}.web.app`,
          requiredAction: 'ADD',
        },
      ];
      return { success: true, status: 'live', dnsRecords };
    }

    const projectId = resolveRuntimeProjectId(store);
    if (!projectId) {
      throw new HttpsError('failed-precondition', 'Store has no associated Firebase project.');
    }
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
      },
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

    await logAuditAction(
      request.auth?.uid || 'unknown',
      authEmail,
      'verifyDomainDNSStatus',
      storeId,
      'success',
      { domain, status: normalizedStatus },
    );

    return { success: true, status: normalizedStatus, rawStatus, dnsRecords };
  },
);

export const seedStore = onCall<{ storeId: string; includeMockData?: boolean }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public', timeoutSeconds: 300, memory: '512MiB' },
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
      slug: string;
      firebaseProjectId?: string;
      runtimeProjectId?: string;
      verticalId?: string;
    };
    const projectId = resolveRuntimeProjectId(store);
    const fallbackProjectId =
      store.firebaseProjectId && store.firebaseProjectId !== projectId
        ? store.firebaseProjectId
        : null;
    const verticalId = store.verticalId || 'indumentaria';
    const tenantId = store.slug;

    const auth = await getOwnerOAuthClient();
    const { seedStoreData } = require('./seeds');

    try {
      await seedStoreData(
        auth,
        projectId,
        tenantId,
        verticalId,
        store.name,
        includeMockData !== false,
        true,
        storeId,
      );
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
          await seedStoreData(
            auth,
            fallbackProjectId,
            tenantId,
            verticalId,
            store.name,
            includeMockData !== false,
            true,
            storeId,
          );
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
  },
);

export const generatePasswordResetLink = onCall<{ storeId: string; email: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can generate reset links.');
    }

    throw new HttpsError(
      'failed-precondition',
      'Password reset links are disabled. Store admin access is Google OAuth only.',
    );
  },
);
