import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PRODUCT_CATALOGUE } from '../../storefront/src/app/core/constants/seed-products.constants';
import { CLIENT_DATA, ORDER_DATA } from '../../storefront/src/app/core/constants/seed-orders.constants';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.warn('[Seed] FIRESTORE_EMULATOR_HOST not set. Defaulting to localhost:8080 to prevent production writes.');
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
}

initializeApp({ projectId: 'demo-vertex' });
const db = getFirestore();

/** Unsplash CDN helper */
function u(id: string, w: number, h: number): string {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;
}

function generateVariantCombinations(
  attributes: { id: string; values: string[] }[],
  variantAttrIds: string[]
): Record<string, string>[] {
  const selectedAttrs = attributes.filter((a) => variantAttrIds.includes(a.id));
  if (selectedAttrs.length === 0) {
    return [];
  }

  let result: Record<string, string>[] = [{}];

  selectedAttrs.forEach((attr) => {
    const newResult: Record<string, string>[] = [];
    result.forEach((existing) => {
      attr.values.forEach((value) => {
        newResult.push({ ...existing, [attr.id]: value });
      });
    });
    result = newResult;
  });

  return result;
}

async function seed() {
  console.log('[Seed] Starting local database seed...');

  // 1. superAdmins
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
  }
  console.log('[Seed] Seeded platformAdmins');

  // 2. Ensure tienda-dos exists
  const tiendaDosRef = db.collection('stores').doc('tienda-dos');
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
  }, { merge: true });
  console.log('[Seed] Seeded default store settings');

  const tenantRef = db.collection('tenants').doc('tienda-dos');

  // 3. Clear existing subcollections for fresh seed
  const collectionsToClear = ['products', 'categories', 'clients', 'orders', 'attributes', 'configuracion', 'siteContent', 'pages'];
  for (const col of collectionsToClear) {
    const snap = await tenantRef.collection(col).get();
    for (const doc of snap.docs) {
      // Clear variants subcollection for products
      if (col === 'products') {
        const variantsSnap = await doc.ref.collection('variants').get();
        for (const vDoc of variantsSnap.docs) {
          await vDoc.ref.delete();
        }
      }
      await doc.ref.delete();
    }
  }
  console.log('[Seed] Cleared old tenant subcollections');

  // 4. Seed Attributes
  const attributesList = [
    { id: 'talle-ropa', name: 'Talle (ropa)', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { id: 'talle-calzado', name: 'Talle (calzado)', values: ['36', '37', '38', '39', '40', '41', '42', '43', '44'] },
    { id: 'talle-pantalon', name: 'Talle (pantalón)', values: ['28', '30', '32', '34', '36', '38'] },
    {
      id: 'color',
      name: 'Color',
      values: [
        'Negro',
        'Blanco',
        'Gris',
        'Azul',
        'Rojo',
        'Verde',
        'Beige',
        'Marrón',
        'Rosa',
        'Caqui',
      ],
    },
    { id: 'material', name: 'Material', values: ['Algodón', 'Poliéster', 'Lino', 'Cuero', 'Denim', 'Lana'] },
  ];
  for (const attr of attributesList) {
    await tenantRef.collection('attributes').doc(attr.id).set({
      name: attr.name,
      values: attr.values,
    });
  }
  console.log('[Seed] Seeded attributes');

  // Map attribute names to IDs for reference during product generation
  const attrNameToId: Record<string, string> = {
    'talle': 'talle-ropa',
    'talle-ropa': 'talle-ropa',
    'talle-calzado': 'talle-calzado',
    'talle-pantalon': 'talle-pantalon',
    'color': 'color',
    'material': 'material'
  };

  // 5. Seed Categories
  const categories = [
    { id: 'remeras', name: 'Remeras', slug: 'remeras', parentId: null, filterableAttributes: ['talle-ropa', 'color'] },
    { id: 'pantalones', name: 'Pantalones', slug: 'pantalones', parentId: null, filterableAttributes: ['talle-pantalon'] },
    { id: 'zapatillas', name: 'Zapatillas', slug: 'zapatillas', parentId: null, filterableAttributes: ['talle-calzado'] },
    { id: 'accesorios', name: 'Accesorios', slug: 'accesorios', parentId: null, filterableAttributes: ['color'] },
    { id: 'camperas', name: 'Camperas', slug: 'camperas', parentId: null, filterableAttributes: ['talle-ropa', 'color'] }
  ];
  for (const cat of categories) {
    await tenantRef.collection('categories').doc(cat.id).set(cat);
  }
  console.log('[Seed] Seeded categories');

  // 6. Seed Products (25 total from PRODUCT_CATALOGUE)
  const productDocIds: string[] = [];
  const productNames: string[] = [];
  const productPrices: number[] = [];

  for (const cat of PRODUCT_CATALOGUE) {
    for (const item of cat.items) {
      const mainImg = u(item.imgs[0], 600, 600);
      const extraImgs = item.imgs.slice(1).map((id) => u(id, 600, 600));
      const fp = item.discount > 0 ? Math.round(item.price * (1 - item.discount / 100)) : item.price;
      const variantAttrIds = cat.variants.map((v) => attrNameToId[v]).filter(Boolean);

      const productDocRef = tenantRef.collection('products').doc();
      const productId = productDocRef.id;

      await productDocRef.set({
        name: item.name,
        description: item.desc,
        categoryId: cat.slug,
        price: item.price,
        discount: item.discount,
        finalPrice: fp,
        image: mainImg,
        images: [mainImg, ...extraImgs],
        totalStock: 0,
        inStockAttributes: {},
        variantAttributes: variantAttrIds,
        featured: item.featured,
        active: true,
        createdAt: new Date(),
      });

      productDocIds.push(productId);
      productNames.push(item.name);
      productPrices.push(fp);

      if (variantAttrIds.length > 0) {
        const combinations = generateVariantCombinations(attributesList, variantAttrIds);
        let totalStock = 0;
        const inStockAttributes: Record<string, string[]> = {};

        let variantIdx = 0;
        for (const combo of combinations) {
          const stock = Math.floor(Math.random() * 80) + 5;
          totalStock += stock;

          Object.entries(combo).forEach(([attrId, value]) => {
            if (!inStockAttributes[attrId]) {
              inStockAttributes[attrId] = [];
            }
            if (!inStockAttributes[attrId].includes(value)) {
              inStockAttributes[attrId].push(value);
            }
          });

          const variantId = `var-${variantIdx++}`;
          const sku = `${item.name.substring(0, 3).toUpperCase()}-${cat.slug.toUpperCase()}-${Object.values(combo).join('-').toUpperCase()}`;
          await productDocRef.collection('variants').doc(variantId).set({
            id: variantId,
            productId,
            sku,
            price: item.price,
            stock,
            attributes: combo,
            createdAt: new Date()
          });
        }

        await productDocRef.update({ totalStock, inStockAttributes });
      }
    }
  }
  console.log(`[Seed] Seeded ${productDocIds.length} products with variants`);

  // 7. Seed Clients (20 total from CLIENT_DATA)
  const clientDocIds: string[] = [];
  for (let i = 0; i < CLIENT_DATA.length; i++) {
    const client = CLIENT_DATA[i];
    const clientDocRef = tenantRef.collection('clients').doc(`cli-${i}`);
    await clientDocRef.set({
      id: `cli-${i}`,
      fullName: client.fullName,
      email: client.email,
      phone: client.phone
    });
    clientDocIds.push(`cli-${i}`);
  }
  console.log(`[Seed] Seeded ${clientDocIds.length} clients`);

  // 8. Seed Orders (20 total from ORDER_DATA)
  for (let i = 0; i < ORDER_DATA.length; i++) {
    const orderRaw = ORDER_DATA[i];
    const client = CLIENT_DATA[orderRaw.clientIdx];

    const orderLines = orderRaw.lines.map((line) => {
      // Map the product index (0 to 24) to the newly generated Firestore product IDs
      const mappedId = productDocIds[line.prodIdx % productDocIds.length];
      const name = productNames[line.prodIdx % productDocIds.length];
      const price = productPrices[line.prodIdx % productDocIds.length];

      const attrs: Record<string, string> = {};
      if (line.talle) attrs['talle-ropa'] = line.talle;
      if (line.color) attrs['color'] = line.color;

      return {
        productId: mappedId,
        name,
        price,
        qty: line.qty,
        attributes: attrs
      };
    });

    const subtotal = orderLines.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const total = subtotal + orderRaw.shippingCost;

    await tenantRef.collection('orders').doc(`ord-${i}`).set({
      id: `ord-${i}`,
      clientEmail: client.email,
      clientName: client.fullName,
      clientPhone: client.phone,
      createdAt: new Date(Date.now() - (orderRaw.daysAgo * 86400000)),
      status: orderRaw.status,
      paymentMethod: orderRaw.paymentMethod,
      shippingAddress: {
        street: orderRaw.street,
        city: orderRaw.city,
        state: orderRaw.state,
        zip: orderRaw.zip
      },
      items: orderLines,
      shippingCost: orderRaw.shippingCost,
      subtotal,
      total
    });
  }
  console.log(`[Seed] Seeded ${ORDER_DATA.length} orders`);

  // 9. Seed Store Configuration
  const storeConfig = {
    storeName: 'Tienda Uno',
    contactPhone: '+54 11 4567-8900',
    contactEmail: 'juan.l.espeche@gmail.com',
    socialInstagramUrl: 'https://instagram.com/tiendauno',
    socialFacebookUrl: '',
    socialWhatsAppUrl: '',
    copyrightText: '© 2026 Tienda Uno. Todos los derechos reservados.'
  };
  await tenantRef.collection('configuracion').doc('store').set(storeConfig);
  console.log('[Seed] Seeded store configuration');

  // 10. Seed siteContent/homePage (Hero Banners and settings)
  const HERO_IDS = [
    '1558769132-cb1aea458c5e',
    '1483985988355-763728e1935b',
    '1469334031218-e382a71b716b',
    '1445205170230-053b83016050',
    '1490481651871-ab68de25d43d',
  ];
  await tenantRef.collection('siteContent').doc('homePage').set({
    heroImages: HERO_IDS.map((id) => u(id, 1920, 700)),
    carouselSettings: { interval: 4500, showIndicators: true },
    title: 'Nueva Colección 2026',
    buttonText: 'Explorar todo',
    buttonLink: '/shop/catalog',
    featuredCategories: [
      {
        categoryId: 'remeras',
        name: 'Remeras',
        slug: 'remeras',
        imageUrl: u('1523381240423-59b6e0c53abe', 600, 400),
      },
      {
        categoryId: 'camperas',
        name: 'Camperas',
        slug: 'camperas',
        imageUrl: u('1551537482-f2075a1d41f2', 600, 400),
      },
      {
        categoryId: 'zapatillas',
        name: 'Zapatillas',
        slug: 'zapatillas',
        imageUrl: u('1491553895911-0055eca6402d', 600, 400),
      },
    ],
    lastUpdated: FieldValue.serverTimestamp(),
  });
  console.log('[Seed] Seeded homePage content');

  // 11. Seed pages/aboutUs
  await tenantRef.collection('pages').doc('aboutUs').set({
    bannerTitle: 'Quiénes Somos',
    bannerSubtitle: 'Moda argentina con identidad propia y alcance nacional.',
    bannerImageUrl: u('1558769132-cb1aea458c5e', 1920, 600),
    centralTitle: 'Nuestra Historia',
    centralImageUrl: u('1483985988355-763728e1935b', 800, 600),
    centralDescription:
      'Tienda Uno nació con un objetivo claro: ' +
      'democratizar la moda de calidad. Trabajamos exclusivamente con proveedores certificados, ' +
      'materiales de primera línea y diseños propios que reflejan la identidad urbana argentina.\n\n' +
      'Hoy somos un gran equipo, despachamos a todo el país y contamos con miles de ' +
      'clientes activos que nos eligen por la calidad, el servicio y los precios justos.',
    cardsSectionTitle: '¿Por qué elegirnos?',
    featureCards: [
      {
        title: 'Calidad sin compromiso',
        content:
          'Cada prenda pasa por tres etapas de control de calidad antes de llegar a tus manos. Solo trabajamos con materiales de primera línea y proveedores certificados.',
      },
      {
        title: 'Envíos en 24-72 hs',
        content:
          'Despachamos a cualquier punto de Argentina en 24 a 72 horas hábiles con seguimiento en tiempo real. Envío sin costo en compras superiores a $30.000.',
      },
      {
        title: 'Cambios sin burocracia',
        content:
          'Si el talle no es el correcto o algo no te convenció, gestionamos el cambio o devolución en menos de 48 horas sin preguntas ni costos adicionales.',
      },
      {
        title: 'Producción responsable',
        content:
          'Embalajes 100% reciclables, tintas a base de agua y apoyo activo a marcas locales y talleres de producción justa.',
      },
    ],
  });
  console.log('[Seed] Seeded aboutUs page content');

  // 12. Seed billing account & shard
  const billingAccountId = '012345-6789AB-CDEF01';
  await db.collection('billingAccounts').doc(billingAccountId).set({
    name: 'GCP Billing Account (Local Emulator)',
    maxProjects: 100,
    active: true,
    addedAt: new Date(),
  });

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
  console.log('[Seed] Seeded billing account and shard info');

  console.log('[Seed] Database seeding completed successfully.');
}

seed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
