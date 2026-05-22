import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ALLOWED_ORIGINS, PLATFORM_PROJECT, getOwnerOAuthClient, getGitHubPat, apiFetch, retry } from './helpers';
import type { InviteStaffPayload, UpdateStoreConfigPayload } from './types';

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

    const store = storeSnap.data() as { firebaseProjectId: string; name: string };

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
  { timeoutSeconds: 120, cors: ALLOWED_ORIGINS, invoker: 'public' },
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

    try {
      await apiFetch(
        auth,
        `https://cloudresourcemanager.googleapis.com/v3/projects/${store.firebaseProjectId}`,
        { method: 'DELETE' }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('404') && !msg.includes('not found')) {
        console.error('deleteStore GCP project deletion error:', err);
        throw new HttpsError('internal', 'Failed to delete GCP project. Please try again.');
      }
    }

    const privateRef = db.collection('stores').doc(storeId).collection('private');
    const privateDocs = await privateRef.listDocuments();
    await Promise.all(privateDocs.map((d) => d.delete()));

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

    const store = storeSnap.data() as { firebaseProjectId: string };
    const auth = await getOwnerOAuthClient();

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
      console.error('connectDomain Firebase Hosting error:', res.status, text);
      throw new HttpsError('internal', 'Failed to connect domain. Please try again.');
    }

    const result = (await res.json()) as {
      requiredDnsUpdates?: { discovered?: Array<{ rdata: string; requiredAction: string }> };
    };

    await db.collection('stores').doc(storeId).update({
      customDomain: domain,
      updatedAt: new Date(),
    });

    const dnsRecords = result.requiredDnsUpdates?.discovered ?? [];
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
        const store = doc.data() as { id: string; name: string; firebaseProjectId: string };

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

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as { firebaseProjectId: string };
    const projectId = store.firebaseProjectId;
    const auth = await getOwnerOAuthClient();

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

    const incomingFields = toFirestoreFields(config).fields;
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
    if (config.storeName) centralUpdates.name = config.storeName;
    if (config.logoUrl !== undefined) centralUpdates.logoUrl = config.logoUrl;
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

    const store = storeSnap.data() as { firebaseProjectId: string };
    const projectId = store.firebaseProjectId;
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

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');

    const store = storeSnap.data() as { firebaseProjectId: string };
    const projectId = store.firebaseProjectId;
    const auth = await getOwnerOAuthClient();

    const token = crypto.randomUUID();
    const invitationId = crypto.randomUUID();
    await db.collection('stores').doc(storeId).collection('invitations').doc(invitationId).set({
      id: invitationId,
      email: email.trim().toLowerCase(),
      role,
      token,
      status: 'pending',
      createdAt: new Date(),
    });

    try {
      const createRes = await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
        {
          method: 'POST',
          body: { email: email.trim().toLowerCase(), emailVerified: false },
          quotaProject: projectId
        }
      ) as { localId: string };

      const uid = createRes.localId;

      await apiFetch(
        auth,
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
        {
          method: 'POST',
          body: {
            localId: uid,
            customAttributes: JSON.stringify({ role, storeId })
          },
          quotaProject: projectId
        }
      );

      const { toFirestoreFields } = require('./seeds');
      const userDoc = {
        email: email.trim().toLowerCase(),
        role,
        displayName: '',
        joinedAt: new Date(),
      };

      await apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(userDoc),
          quotaProject: projectId
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('EMAIL_EXISTS')) {
        const lookup = (await apiFetch(
          auth,
          `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
          { method: 'POST', body: { email: [email.trim().toLowerCase()] }, quotaProject: projectId }
        )) as { users: Array<{ localId: string }> };

        if (lookup.users?.length) {
          const uid = lookup.users[0].localId;
          await apiFetch(
            auth,
            `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
            {
              method: 'POST',
              body: {
                localId: uid,
                customAttributes: JSON.stringify({ role, storeId })
              },
              quotaProject: projectId
            }
          );

          const { toFirestoreFields } = require('./seeds');
          const userDoc = {
            email: email.trim().toLowerCase(),
            role,
            displayName: '',
            joinedAt: new Date(),
          };

          await apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
            {
              method: 'PATCH',
              body: toFirestoreFields(userDoc),
              quotaProject: projectId
            }
          );
        }
      } else {
        console.error('Failed to provision auth user in tenant project:', err);
      }
    }

    return { success: true, token };
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

    const store = storeSnap.data() as { firebaseProjectId: string };
    const projectId = store.firebaseProjectId;
    const auth = await getOwnerOAuthClient();

    let users: Array<{ uid: string; email: string; role: string; displayName?: string; joinedAt?: string }> = [];
    try {
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
      console.warn(`No users collection or failed to load users in ${projectId}`, err);
    }

    const invitationsSnap = await db.collection('stores').doc(storeId).collection('invitations').get();
    const invitations = invitationsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        email: data['email'],
        role: data['role'],
        status: data['status'],
        createdAt: data['createdAt']?.toDate().toISOString(),
      };
    });

    return { users, invitations };
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

    const store = storeSnap.data() as { firebaseProjectId: string };
    const projectId = store.firebaseProjectId;
    const auth = await getOwnerOAuthClient();

    const tokenRes = await auth.getAccessToken();
    const res = await fetch(
      `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/default/domains/${domain}`,
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
      requiredDnsUpdates?: { discovered?: Array<{ rdata: string; requiredAction: string }> };
    };

    const status = result.status || 'PENDING';
    const dnsRecords = result.requiredDnsUpdates?.discovered ?? [];

    return { success: true, status, dnsRecords };
  }
);
