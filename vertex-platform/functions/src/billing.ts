import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { AddBillingAccountPayload, UpdateBillingAccountPayload } from './types';
import { ALLOWED_ORIGINS, PLATFORM_PROJECT, getOwnerOAuthClient, apiFetch } from './helpers';
import { checkRateLimit } from './stores';

function normalizeBillingAccountId(rawId: string): string {
  const id = rawId.trim();
  return id.startsWith('billingAccounts/') ? id.slice('billingAccounts/'.length) : id;
}

/**
 * Cuenta los proyectos vinculados a una billing account a partir de la respuesta
 * de `billingAccounts/{id}/projects` (el endpoint devuelve `projectBillingInfo`,
 * NO `projects` — error histórico que daba 0 de uso real en el panel).
 */
export function countLinkedProjects(payload: {
  projectBillingInfo?: Array<{ billingEnabled?: boolean }>;
}): number {
  return (payload.projectBillingInfo ?? []).filter((p) => p.billingEnabled !== false).length;
}

export const listBillingAccounts = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can list billing accounts.');
    }

    const db = getFirestore();
    const [newSnap, oldSnap, storesSnap] = await Promise.all([
      db.collection('billing_accounts').get(),
      db.collection('billingAccounts').orderBy('addedAt', 'asc').get(),
      db.collection('stores').where('status', 'in', ['provisioning', 'active', 'suspended']).get(),
    ]);

    const accountsSnap = !newSnap.empty ? newSnap : oldSnap;

    const usageMap: Record<string, number> = {};
    storesSnap.docs.forEach((d) => {
      const bid = d.data()['billingAccountId'] as string | undefined;
      if (bid) usageMap[bid] = (usageMap[bid] ?? 0) + 1;
    });

    // Uso REAL de GCP: proyectos vinculados a cada billing account (la fuente de
    // verdad; el límite real de GCP es 5 proyectos por cuenta — default documentado,
    // aumentable por soporte).
    let gcpUsageMap: Record<string, number> = {};
    try {
      const auth = await getOwnerOAuthClient();
      const accounts = accountsSnap.docs.map((d) => d.id);
      await Promise.all(
        accounts.map(async (accountId) => {
          let count = 0;
          let pageToken = '';
          do {
            const res = (await apiFetch(
              auth,
              `https://cloudbilling.googleapis.com/v1/billingAccounts/${encodeURIComponent(accountId)}/projects${
                pageToken ? `?pageToken=${pageToken}` : ''
              }`,
              { quotaProject: PLATFORM_PROJECT },
            )) as {
              projectBillingInfo?: Array<{ billingEnabled?: boolean }>;
              nextPageToken?: string;
            };
            count += countLinkedProjects(res);
            pageToken = res.nextPageToken ?? '';
          } while (pageToken && count < 1000);
          gcpUsageMap[accountId] = count;
        }),
      );
    } catch (err) {
      console.error('[listBillingAccounts] No se pudo leer el uso real de GCP:', err);
      gcpUsageMap = {};
    }

    const accounts = accountsSnap.docs.map((d) => {
      const data = d.data();
      const gcpProjectLimit =
        (data['gcpProjectLimit'] as number | undefined) ??
        (data['maxProjects'] as number | undefined) ??
        5;
      const gcpUsedProjects =
        gcpUsageMap[d.id] ?? (data['currentProjects'] as number | undefined) ?? usageMap[d.id] ?? 0;
      const active = data['status']
        ? data['status'] === 'ACTIVE'
        : (data['active'] as boolean | undefined) !== false;
      const addedAtDate =
        (data['addedAt'] as FirebaseFirestore.Timestamp)?.toDate() ??
        (data['createdAt'] as FirebaseFirestore.Timestamp)?.toDate() ??
        null;
      return {
        id: d.id,
        name: (data['name'] as string | undefined) ?? d.id,
        maxProjects: gcpProjectLimit,
        active,
        addedAt: addedAtDate ? addedAtDate.toISOString() : null,
        usedProjects: usageMap[d.id] ?? 0,
        gcpProjectLimit,
        gcpUsedProjects,
        gcpRemaining: Math.max(0, gcpProjectLimit - gcpUsedProjects),
        gcpUsageRatio: gcpProjectLimit > 0 ? Math.min(1, gcpUsedProjects / gcpProjectLimit) : 0,
      };
    });

    return { accounts };
  },
);

export const addBillingAccount = onCall<AddBillingAccountPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can add billing accounts.');
    }
    await checkRateLimit(request.auth.uid, 'addBillingAccount', 20, 15);

    const normalizedId = normalizeBillingAccountId(request.data.id || '');
    const { name, maxProjects = 15, gcpProjectLimit = 5 } = request.data;
    if (!normalizedId || !name)
      throw new HttpsError('invalid-argument', 'id and name are required.');
    if (!Number.isFinite(gcpProjectLimit) || gcpProjectLimit < 1) {
      throw new HttpsError('invalid-argument', 'gcpProjectLimit must be >= 1.');
    }

    const db = getFirestore();
    const existing = await db.collection('billingAccounts').doc(normalizedId).get();
    if (existing.exists) {
      throw new HttpsError(
        'already-exists',
        `Billing account ${normalizedId} is already registered.`,
      );
    }

    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
      const auth = await getOwnerOAuthClient();
      try {
        await apiFetch(
          auth,
          `https://cloudbilling.googleapis.com/v1/billingAccounts/${normalizedId}`,
        );
      } catch (err) {
        console.error('addBillingAccount verification error:', err);
        throw new HttpsError(
          'not-found',
          `Billing account ${normalizedId} not found or not accessible.`,
        );
      }

      try {
        await apiFetch(
          auth,
          `https://cloudbilling.googleapis.com/v1/billingAccounts/${normalizedId}?updateMask=displayName`,
          { method: 'PATCH', body: { displayName: name } },
        );
      } catch {
        /* silently skip if user lacks billing.accounts.update */
      }
    }

    await db.collection('billingAccounts').doc(normalizedId).set({
      name,
      maxProjects,
      gcpProjectLimit,
      active: true,
      addedAt: new Date(),
    });

    return { success: true };
  },
);

export const updateBillingAccount = onCall<UpdateBillingAccountPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError(
        'permission-denied',
        'Only platform admins can update billing accounts.',
      );
    }
    await checkRateLimit(request.auth.uid, 'updateBillingAccount', 20, 15);

    const normalizedId = normalizeBillingAccountId(request.data.id || '');
    const { name, maxProjects, active, gcpProjectLimit } = request.data;
    if (!normalizedId) throw new HttpsError('invalid-argument', 'id is required.');

    const db = getFirestore();
    const docRef = db.collection('billingAccounts').doc(normalizedId);
    const snap = await docRef.get();
    if (!snap.exists)
      throw new HttpsError('not-found', `Billing account ${normalizedId} not found.`);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates['name'] = name;
    if (maxProjects !== undefined) updates['maxProjects'] = maxProjects;
    if (active !== undefined) updates['active'] = active;
    if (gcpProjectLimit !== undefined) {
      if (!Number.isFinite(gcpProjectLimit) || gcpProjectLimit < 1) {
        throw new HttpsError('invalid-argument', 'gcpProjectLimit must be >= 1.');
      }
      updates['gcpProjectLimit'] = gcpProjectLimit;
    }

    await docRef.update(updates);

    if (name !== undefined && process.env.FUNCTIONS_EMULATOR !== 'true') {
      try {
        const auth = await getOwnerOAuthClient();
        await apiFetch(
          auth,
          `https://cloudbilling.googleapis.com/v1/billingAccounts/${normalizedId}?updateMask=displayName`,
          { method: 'PATCH', body: { displayName: name } },
        );
      } catch {
        /* silently skip if user lacks billing.accounts.update */
      }
    }

    return { success: true };
  },
);

export const removeBillingAccount = onCall<{ id: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError(
        'permission-denied',
        'Only platform admins can remove billing accounts.',
      );
    }
    await checkRateLimit(request.auth.uid, 'removeBillingAccount', 20, 15);

    const normalizedId = normalizeBillingAccountId(request.data.id || '');
    if (!normalizedId) throw new HttpsError('invalid-argument', 'id is required.');

    const db = getFirestore();
    const docRef = db.collection('billingAccounts').doc(normalizedId);
    const snap = await docRef.get();
    if (!snap.exists)
      throw new HttpsError('not-found', `Billing account ${normalizedId} not found.`);

    const activeStores = await db
      .collection('stores')
      .where('billingAccountId', '==', normalizedId)
      .where('status', 'in', ['provisioning', 'active', 'suspended'])
      .get();

    if (!activeStores.empty) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot remove: this billing account has ${activeStores.size} active store(s) assigned. Reassign or delete them first.`,
      );
    }

    await docRef.delete();
    return { success: true };
  },
);
