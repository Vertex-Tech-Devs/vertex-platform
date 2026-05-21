import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ALLOWED_ORIGINS, PLATFORM_PROJECT, getOwnerOAuthClient, getGitHubPat, apiFetch } from './helpers';

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
