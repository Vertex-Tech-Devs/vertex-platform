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
      slug: 'tienda-dos',
      name: 'Tienda Dos',
      description: 'Tienda autogenerada para desarrollo local',
      status: 'active',
      plan: 'pro',
      ownerEmail: 'juan.l.espeche@gmail.com',
      firebaseProjectId: 'demo-vertex',
      runtimeProjectId: 'demo-vertex',
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
    console.log('[Seed] Created default store: Tienda Dos (tienda-dos)');
  } else {
    // Make sure name and slug match even if it exists
    await tiendaDosRef.update({
      name: 'Tienda Dos',
      slug: 'tienda-dos',
      firebaseProjectId: 'demo-vertex',
      runtimeProjectId: 'demo-vertex',
    });
    console.log('[Seed] Store tienda-dos already exists. Updated name, slug, and projectIds.');
  }

  // Seed Mock Catalog for tienda-dos
  const categories = [
    { id: 'remeras', name: 'Remeras', slug: 'remeras', parentId: null, filterableAttributes: [] },
    { id: 'pantalones', name: 'Pantalones', slug: 'pantalones', parentId: null, filterableAttributes: [] }
  ];

  for (const cat of categories) {
    await db.collection('tenants').doc('tienda-dos').collection('categories').doc(cat.id).set(cat, { merge: true });
  }
  console.log('[Seed] Seeded mock categories for tienda-dos');

  const products = [
    {
      id: 'remera-vertex',
      name: 'Remera Vertex Classic',
      description: 'Remera de algodón premium con logo Vertex estampado.',
      categoryId: 'remeras',
      price: 12000,
      discount: 0,
      finalPrice: 12000,
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800',
      images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800'],
      totalStock: 50,
      variantAttributes: [],
      inStockAttributes: {},
      featured: true,
      active: true,
      createdAt: new Date()
    },
    {
      id: 'pantalon-jeans',
      name: 'Jean Classic Fit',
      description: 'Jean clásico de calce recto y cómodo.',
      categoryId: 'pantalones',
      price: 25000,
      discount: 10,
      finalPrice: 22500,
      image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800',
      images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
      totalStock: 30,
      variantAttributes: [],
      inStockAttributes: {},
      featured: true,
      active: true,
      createdAt: new Date()
    }
  ];

  for (const prod of products) {
    await db.collection('tenants').doc('tienda-dos').collection('products').doc(prod.id).set(prod, { merge: true });
    
    // Seed default variant
    await db.collection('tenants').doc('tienda-dos').collection('products').doc(prod.id).collection('variants').doc('variant-default').set({
      id: 'variant-default',
      productId: prod.id,
      price: prod.price,
      stock: prod.totalStock,
      attributes: {},
      createdAt: new Date()
    });
  }
  console.log('[Seed] Seeded mock products and default variants for tienda-dos');

  // Seed store config
  const storeConfig = {
    storeName: 'Tienda Dos',
    contactPhone: '123456789',
    contactEmail: 'vertex.tech.dev@gmail.com',
    socialInstagramUrl: 'https://instagram.com/vertex',
    socialFacebookUrl: '',
    socialWhatsAppUrl: '',
    copyrightText: '© 2026 Tienda Dos. Todos los derechos reservados.'
  };
  await db.collection('tenants').doc('tienda-dos').collection('configuracion').doc('store').set(storeConfig, { merge: true });
  console.log('[Seed] Seeded store configuration for tienda-dos');

  // 3. Ensure a default active billing account exists
  const billingAccountId = '012345-6789AB-CDEF01';
  await db.collection('billingAccounts').doc(billingAccountId).set({
    name: 'GCP Billing Account (Local Emulator)',
    maxProjects: 100,
    active: true,
    addedAt: new Date(),
  });
  console.log(`[Seed] Seeded default billing account: ${billingAccountId}`);

  // 4. Ensure a default active shared shard exists
  const shardId = 'shard-dev-1';
  await db.collection('shards').doc(shardId).set({
    id: shardId,
    environment: 'development',
    runtimeMode: 'shared-shard',
    projectId: 'vertex-platform-dev',
    siteId: 'vertex-platform-dev',
    region: 'us-central1',
    status: 'active',
    maxStores: 10,
    activeStores: 0,
    reservedStores: 0,
    currentTemplateVersion: '1.0.0',
    currentDataVersion: '1.0.0',
    updatedAt: new Date(),
    createdAt: new Date(),
  });
  console.log(`[Seed] Seeded default active shared shard: ${shardId}`);

  console.log('[Seed] Database seeding completed successfully.');
}

seed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
