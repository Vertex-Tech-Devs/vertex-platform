/**
 * Seeds the two pre-existing stores into the platform Firestore.
 * Uses gcloud Application Default Credentials — no service account key needed.
 *
 * Usage: npm run seed:stores
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ projectId: 'vertex-platform-app' });

const db = getFirestore();

const stores = [
  {
    id: 'ecommerce-vertex-dev',
    name: 'Vertex Dev',
    slug: 'vertex-dev',
    firebaseProjectId: 'ecommerce-vertex-dev',
    defaultUrl: 'https://ecommerce-vertex-dev.web.app',
    status: 'active',
    plan: 'professional',
    ownerEmail: 'juan.l.espeche@gmail.com',
    createdAt: Timestamp.fromDate(new Date('2024-01-01')),
    updatedAt: Timestamp.now(),
  },
  {
    id: 'ecommerce-vertex',
    name: 'Vertex Producción',
    slug: 'vertex',
    firebaseProjectId: 'ecommerce-vertex',
    defaultUrl: 'https://ecommerce-vertex.web.app',
    status: 'active',
    plan: 'professional',
    ownerEmail: 'juan.l.espeche@gmail.com',
    createdAt: Timestamp.fromDate(new Date('2024-01-01')),
    updatedAt: Timestamp.now(),
  },
];

void (async () => {
  for (const store of stores) {
    const { id, ...data } = store;
    await db.collection('stores').doc(id).set(data, { merge: true });
    console.log(`✅ Seeded: ${store.name} (${id})`);
  }
  console.log('\nDone. Reload the platform to see the stores.');
})();
