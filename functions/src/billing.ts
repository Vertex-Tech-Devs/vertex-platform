import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { AddBillingAccountPayload, UpdateBillingAccountPayload } from './types';
import { ALLOWED_ORIGINS, getOwnerOAuthClient, apiFetch } from './helpers';

export const listBillingAccounts = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can list billing accounts.');
    }

    const db = getFirestore();
    const [accountsSnap, storesSnap] = await Promise.all([
      db.collection('billingAccounts').orderBy('addedAt', 'asc').get(),
      db.collection('stores').where('status', 'in', ['provisioning', 'active', 'suspended']).get(),
    ]);

    const usageMap: Record<string, number> = {};
    storesSnap.docs.forEach((d) => {
      const bid = d.data()['billingAccountId'] as string | undefined;
      if (bid) usageMap[bid] = (usageMap[bid] ?? 0) + 1;
    });

    const accounts = accountsSnap.docs.map((d) => ({
      id: d.id,
      name: d.data()['name'] as string,
      maxProjects: d.data()['maxProjects'] as number,
      active: d.data()['active'] as boolean,
      addedAt: (d.data()['addedAt'] as FirebaseFirestore.Timestamp)?.toDate().toISOString() ?? null,
      usedProjects: usageMap[d.id] ?? 0,
    }));

    return { accounts };
  }
);

export const addBillingAccount = onCall<AddBillingAccountPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can add billing accounts.');
    }

    const { id, name, maxProjects = 15 } = request.data;
    if (!id || !name) throw new HttpsError('invalid-argument', 'id and name are required.');

    const db = getFirestore();
    const existing = await db.collection('billingAccounts').doc(id).get();
    if (existing.exists) {
      throw new HttpsError('already-exists', `Billing account ${id} is already registered.`);
    }

    const auth = await getOwnerOAuthClient();
    try {
      await apiFetch(auth, `https://cloudbilling.googleapis.com/v1/billingAccounts/${id}`);
    } catch (err) {
      console.error('addBillingAccount verification error:', err);
      throw new HttpsError('not-found', `Billing account ${id} not found or not accessible.`);
    }

    try {
      await apiFetch(
        auth,
        `https://cloudbilling.googleapis.com/v1/billingAccounts/${id}?updateMask=displayName`,
        { method: 'PATCH', body: { displayName: name } }
      );
    } catch { /* silently skip if user lacks billing.accounts.update */ }

    await db.collection('billingAccounts').doc(id).set({
      name,
      maxProjects,
      active: true,
      addedAt: new Date(),
    });

    return { success: true };
  }
);

export const updateBillingAccount = onCall<UpdateBillingAccountPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can update billing accounts.');
    }

    const { id, name, maxProjects, active } = request.data;
    if (!id) throw new HttpsError('invalid-argument', 'id is required.');

    const db = getFirestore();
    const docRef = db.collection('billingAccounts').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError('not-found', `Billing account ${id} not found.`);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates['name'] = name;
    if (maxProjects !== undefined) updates['maxProjects'] = maxProjects;
    if (active !== undefined) updates['active'] = active;

    await docRef.update(updates);

    if (name !== undefined) {
      try {
        const auth = await getOwnerOAuthClient();
        await apiFetch(
          auth,
          `https://cloudbilling.googleapis.com/v1/billingAccounts/${id}?updateMask=displayName`,
          { method: 'PATCH', body: { displayName: name } }
        );
      } catch { /* silently skip if user lacks billing.accounts.update */ }
    }

    return { success: true };
  }
);

export const removeBillingAccount = onCall<{ id: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can remove billing accounts.');
    }

    const { id } = request.data;
    if (!id) throw new HttpsError('invalid-argument', 'id is required.');

    const db = getFirestore();
    const docRef = db.collection('billingAccounts').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError('not-found', `Billing account ${id} not found.`);

    const activeStores = await db
      .collection('stores')
      .where('billingAccountId', '==', id)
      .where('status', 'in', ['provisioning', 'active', 'suspended'])
      .get();

    if (!activeStores.empty) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot remove: this billing account has ${activeStores.size} active store(s) assigned. Reassign or delete them first.`
      );
    }

    await docRef.delete();
    return { success: true };
  }
);
