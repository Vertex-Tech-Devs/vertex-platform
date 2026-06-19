import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.warn('[Seed] FIRESTORE_EMULATOR_HOST not set. Defaulting to localhost:8080 to prevent production writes.');
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
}

// Initialize Firebase Admin (connects to emulator automatically via env vars set by firebase CLI)
initializeApp({ projectId: 'demo-vertex' });

const db = getFirestore();

async function seed() {
  console.log('[Seed] Starting local database seed...');

  // 1. Ensure developers have superAdmin role so they can login immediately
  const PROTECTED_SUPER_ADMINS = ['juan.l.espeche@gmail.com', 'leivalihue@gmail.com', 'vertex.tech.dev@gmail.com'];
  for (const email of PROTECTED_SUPER_ADMINS) {
    await db.collection('platformAdmins').doc(email).set(
      {
        email,
        role: 'superAdmin',
        protected: true,
        addedBy: 'system',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`[Seed] Seeded superAdmin claim for: ${email}`);
  }

  // 2. Ensure tienda-dos exists so Storefront doesn't crash
  const tiendaDosRef = db.collection('stores').doc('tienda-dos');
  const doc = await tiendaDosRef.get();
  
  if (!doc.exists) {
    await tiendaDosRef.set({
      tenantId: 'tienda-dos',
      name: 'Tienda de Prueba',
      description: 'Tienda autogenerada para desarrollo local',
      status: 'active',
      plan: 'pro',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      domain: 'localhost:4201',
      settings: {
        currency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
        locale: 'es-AR',
        colors: {
          primary: '#2563eb',
          secondary: '#475569',
          accent: '#38bdf8',
          background: '#ffffff',
          surface: '#f8fafc',
          text: '#0f172a',
          textSecondary: '#64748b'
        }
      },
      contact: {
        email: 'vertex.tech.dev@gmail.com',
        phone: '123456789'
      }
    });
    console.log('[Seed] Created default store: tienda-dos');
  } else {
    console.log('[Seed] Store tienda-dos already exists. Skipping creation.');
  }

  console.log('[Seed] Database seeding completed successfully.');
}

seed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
