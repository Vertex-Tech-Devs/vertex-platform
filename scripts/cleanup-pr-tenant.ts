import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main(): Promise<void> {
  const prNumber = process.env['PR_NUMBER'];
  const saJson = process.env['FIREBASE_SERVICE_ACCOUNT_DEV'];

  if (!prNumber) {
    console.log('No PR_NUMBER specified. Skipping cleanup.');
    return;
  }

  if (!saJson) {
    console.log('No FIREBASE_SERVICE_ACCOUNT_DEV provided. Skipping cleanup.');
    return;
  }

  const tenantId = `vtx-pr-${prNumber}`;
  console.log(`Cleaning up Platform Firestore data for tenantId: ${tenantId}...`);

  const credentials = JSON.parse(saJson);
  if (!getApps().length) {
    initializeApp({
      credential: cert(credentials),
    });
  }

  const db = getFirestore();

  // Delete stores or test instances created for this PR tenant
  const snap = await db.collection('stores').where('storeId', '==', tenantId).get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    console.log(`Deleted ${snap.docs.length} stores matching tenant ${tenantId}`);
  }

  console.log(`Successfully cleaned up Platform Firestore data for tenantId ${tenantId}.`);
}

main().catch((err) => {
  console.error('Error during platform tenant cleanup:', err);
  process.exit(0);
});
