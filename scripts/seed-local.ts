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

  // 2. Ensure tienda-dos (now named Tienda Uno) exists so Storefront doesn't crash
  const tiendaDosRef = db.collection('stores').doc('tienda-dos');
  const doc = await tiendaDosRef.get();
  
  if (!doc.exists) {
    await tiendaDosRef.set({
      tenantId: 'tienda-dos',
      slug: 'tienda-dos',
      name: 'Tienda Uno',
      description: 'Tienda de demostración local con catálogo completo',
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
          primary: '#3b82f6',
          secondary: '#1e293b',
          accent: '#60a5fa',
          background: '#ffffff',
          surface: '#f8fafc',
          text: '#0f172a',
          textSecondary: '#64748b'
        }
      },
      contact: {
        email: 'juan.l.espeche@gmail.com',
        phone: '+54 11 4567-8900'
      }
    });
    console.log('[Seed] Created default store: Tienda Uno (tienda-dos)');
  } else {
    // Make sure name and slug match even if it exists
    await tiendaDosRef.update({
      name: 'Tienda Uno',
      slug: 'tienda-dos',
      firebaseProjectId: 'demo-vertex',
      runtimeProjectId: 'demo-vertex',
      ownerEmail: 'juan.l.espeche@gmail.com',
    });
    console.log('[Seed] Store tienda-dos already exists. Updated name to Tienda Uno, slug, and projectIds.');
  }

  // Seed Mock Catalog for tienda-dos
  const categories = [
    { id: 'remeras', name: 'Remeras', slug: 'remeras', parentId: null, filterableAttributes: ['talle-ropa', 'color'] },
    { id: 'pantalones', name: 'Pantalones', slug: 'pantalones', parentId: null, filterableAttributes: ['talle-pantalon'] },
    { id: 'zapatillas', name: 'Zapatillas', slug: 'zapatillas', parentId: null, filterableAttributes: ['talle-calzado'] },
    { id: 'camperas', name: 'Camperas', slug: 'camperas', parentId: null, filterableAttributes: ['talle-ropa', 'color'] }
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
      totalStock: 120,
      variantAttributes: ['talle-ropa', 'color'],
      inStockAttributes: { 'talle-ropa': ['S', 'M', 'L', 'XL'], 'color': ['Negro', 'Blanco'] },
      featured: true,
      active: true,
      createdAt: new Date()
    },
    {
      id: 'pantalon-jeans',
      name: 'Jean Classic Fit Straight',
      description: 'Jean clásico de calce recto y cómodo en denim de 12 oz.',
      categoryId: 'pantalones',
      price: 25000,
      discount: 10,
      finalPrice: 22500,
      image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800',
      images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
      totalStock: 80,
      variantAttributes: ['talle-pantalon'],
      inStockAttributes: { 'talle-pantalon': ['30', '32', '34', '36'] },
      featured: true,
      active: true,
      createdAt: new Date()
    },
    {
      id: 'zapas-run',
      name: 'Zapatillas Running Pro',
      description: 'Zapatillas de running de alto rendimiento con amortiguación premium.',
      categoryId: 'zapatillas',
      price: 48000,
      discount: 15,
      finalPrice: 40800,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'],
      totalStock: 60,
      variantAttributes: ['talle-calzado'],
      inStockAttributes: { 'talle-calzado': ['40', '41', '42', '43'] },
      featured: true,
      active: true,
      createdAt: new Date()
    },
    {
      id: 'campera-puffer',
      name: 'Campera Puffer ColdShield',
      description: 'Campera acolchada térmica con relleno sintético y repelente al agua.',
      categoryId: 'camperas',
      price: 65000,
      discount: 0,
      finalPrice: 65000,
      image: 'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=800',
      images: ['https://images.unsplash.com/photo-1547949003-9792a18a2601?w=800'],
      totalStock: 45,
      variantAttributes: ['talle-ropa', 'color'],
      inStockAttributes: { 'talle-ropa': ['M', 'L', 'XL'], 'color': ['Negro', 'Azul'] },
      featured: true,
      active: true,
      createdAt: new Date()
    }
  ];

  for (const prod of products) {
    await db.collection('tenants').doc('tienda-dos').collection('products').doc(prod.id).set(prod, { merge: true });
    
    // Seed variants based on variant attributes
    if (prod.id === 'remera-vertex') {
      const sizes = ['S', 'M', 'L', 'XL'];
      const colors = ['Negro', 'Blanco'];
      let vIdx = 0;
      for (const size of sizes) {
        for (const color of colors) {
          const varId = `var-${vIdx++}`;
          await db.collection('tenants').doc('tienda-dos').collection('products').doc(prod.id).collection('variants').doc(varId).set({
            id: varId,
            productId: prod.id,
            sku: `REM-VTX-${size}-${color.toUpperCase()}`,
            price: prod.price,
            stock: 15,
            attributes: { 'talle-ropa': size, 'color': color },
            createdAt: new Date()
          });
        }
      }
    } else if (prod.id === 'pantalon-jeans') {
      const sizes = ['30', '32', '34', '36'];
      let vIdx = 0;
      for (const size of sizes) {
        const varId = `var-${vIdx++}`;
        await db.collection('tenants').doc('tienda-dos').collection('products').doc(prod.id).collection('variants').doc(varId).set({
          id: varId,
          productId: prod.id,
          sku: `JEAN-CLS-${size}`,
          price: prod.price,
          stock: 20,
          attributes: { 'talle-pantalon': size },
          createdAt: new Date()
        });
      }
    } else if (prod.id === 'zapas-run') {
      const sizes = ['40', '41', '42', '43'];
      let vIdx = 0;
      for (const size of sizes) {
        const varId = `var-${vIdx++}`;
        await db.collection('tenants').doc('tienda-dos').collection('products').doc(prod.id).collection('variants').doc(varId).set({
          id: varId,
          productId: prod.id,
          sku: `ZAP-RUN-${size}`,
          price: prod.price,
          stock: 15,
          attributes: { 'talle-calzado': size },
          createdAt: new Date()
        });
      }
    } else if (prod.id === 'campera-puffer') {
      const sizes = ['M', 'L', 'XL'];
      const colors = ['Negro', 'Azul'];
      let vIdx = 0;
      for (const size of sizes) {
        for (const color of colors) {
          const varId = `var-${vIdx++}`;
          await db.collection('tenants').doc('tienda-dos').collection('products').doc(prod.id).collection('variants').doc(varId).set({
            id: varId,
            productId: prod.id,
            sku: `PUFF-CSD-${size}-${color.toUpperCase()}`,
            price: prod.price,
            stock: 10,
            attributes: { 'talle-ropa': size, 'color': color },
            createdAt: new Date()
          });
        }
      }
    }
  }
  console.log('[Seed] Seeded mock products and specific variants for tienda-dos');

  // Seed mock clients
  const mockClients = [
    { id: 'cli-0', fullName: 'Valentina García', email: 'valenti.garcia@gmail.com', phone: '+54 9 11 4523-8801' },
    { id: 'cli-1', fullName: 'Mateo Rodríguez', email: 'mateo.rodriguez@gmail.com', phone: '+54 9 11 5634-9912' },
    { id: 'cli-2', fullName: 'Camila López', email: 'camila.lopez@outlook.com', phone: '+54 9 11 4712-3345' }
  ];
  for (const client of mockClients) {
    await db.collection('tenants').doc('tienda-dos').collection('clients').doc(client.id).set(client, { merge: true });
  }
  console.log('[Seed] Seeded mock clients for tienda-dos');

  // Seed mock orders
  const mockOrders = [
    {
      id: 'ord-0',
      clientEmail: 'valenti.garcia@gmail.com',
      clientName: 'Valentina García',
      clientPhone: '+54 9 11 4523-8801',
      createdAt: new Date(Date.now() - 2 * 86400000),
      status: 'processing',
      paymentMethod: 'MercadoPago',
      shippingAddress: {
        street: 'Av. Corrientes 4531',
        city: 'Buenos Aires',
        state: 'Buenos Aires',
        zip: '1414'
      },
      items: [
        { productId: 'remera-vertex', name: 'Remera Vertex Classic', price: 12000, qty: 2, attributes: { 'talle-ropa': 'M', 'color': 'Negro' } }
      ],
      shippingCost: 1500,
      subtotal: 24000,
      total: 25500
    },
    {
      id: 'ord-1',
      clientEmail: 'mateo.rodriguez@gmail.com',
      clientName: 'Mateo Rodríguez',
      clientPhone: '+54 9 11 5634-9912',
      createdAt: new Date(Date.now() - 5 * 86400000),
      status: 'delivered',
      paymentMethod: 'Tarjeta de crédito',
      shippingAddress: {
        street: 'San Martín 882',
        city: 'Córdoba',
        state: 'Córdoba',
        zip: '5000'
      },
      items: [
        { productId: 'pantalon-jeans', name: 'Jean Classic Fit Straight', price: 25000, qty: 1, attributes: { 'talle-pantalon': '32' } }
      ],
      shippingCost: 1800,
      subtotal: 22500,
      total: 24300
    }
  ];
  for (const order of mockOrders) {
    await db.collection('tenants').doc('tienda-dos').collection('orders').doc(order.id).set(order, { merge: true });
  }
  console.log('[Seed] Seeded mock orders for tienda-dos');

  // Seed store config
  const storeConfig = {
    storeName: 'Tienda Uno',
    contactPhone: '+54 11 4567-8900',
    contactEmail: 'juan.l.espeche@gmail.com',
    socialInstagramUrl: 'https://instagram.com/tiendauno',
    socialFacebookUrl: '',
    socialWhatsAppUrl: '',
    copyrightText: '© 2026 Tienda Uno. Todos los derechos reservados.'
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
