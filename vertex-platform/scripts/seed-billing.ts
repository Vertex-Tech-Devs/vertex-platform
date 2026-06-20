import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'demo-vertex';
initializeApp({ projectId });

const db = getFirestore();

void (async () => {
  const billingAccountId = '012345-6789AB-CDEF01';
  await db.collection('billingAccounts').doc(billingAccountId).set({
    name: 'GCP Billing Account (Local Emulator)',
    maxProjects: 100,
    active: true,
    addedAt: new Date(),
  });
  console.log(`✅ Seeded billing account: ${billingAccountId}`);
})();
