import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TECNOLOGIA_ELECTRONICA_PRESET } from '../verticals/presets/tecnologia-electronica';
import { generateDemoClients, generateDemoOrders } from '../verticals/demo-data.generator';

async function seedTechnologyStore(): Promise<void> {
  const targetProject =
    process.env['GCP_PROJECT'] || process.env['FIREBASE_PROJECT_ID'] || 'ecommerce-vertex-dev';

  console.log(`[SeedScript] Connecting to project "${targetProject}"...`);

  if (getApps().length === 0) {
    initializeApp({ projectId: targetProject });
  }

  const db = getFirestore();

  // 1. Locate store 'Tecnología' or 'tecnologia' in stores collection if present
  let storeId = 'tecnologia';
  let storeName = 'Tecnología';

  try {
    const storesSnap = await db.collection('stores').get();
    for (const doc of storesSnap.docs) {
      const data = doc.data();
      const name = (data['name'] || '').toString().toLowerCase();
      const slug = (data['slug'] || '').toString().toLowerCase();
      if (
        name.includes('tecnolog') ||
        slug.includes('tecnolog') ||
        name.includes('tech') ||
        slug.includes('tech')
      ) {
        storeId = doc.id;
        storeName = data['name'] || 'Tecnología';
        console.log(`[SeedScript] Found matching store: ID="${storeId}", Name="${storeName}"`);
        await doc.ref.update({
          verticalId: 'TECNOLOGIA_ELECTRONICA',
          businessVertical: 'TECNOLOGIA_ELECTRONICA',
          updatedAt: new Date(),
        });
        break;
      }
    }
  } catch (err) {
    console.warn(`[SeedScript] Note: Could not query stores collection on ${targetProject}:`, err);
  }

  console.log(
    `[SeedScript] Seeding preset TECNOLOGIA_ELECTRONICA for store "${storeId}" ("${storeName}")...`,
  );

  const preset = TECNOLOGIA_ELECTRONICA_PRESET;

  // 2. Clear old data for this store
  const collections = ['products', 'categories', 'attributes', 'clients', 'orders'];
  for (const colName of collections) {
    const snap = await db.collection(colName).where('storeId', '==', storeId).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      console.log(
        `[SeedScript] Cleared ${snap.size} old documents in "${colName}" for store "${storeId}".`,
      );
    }
  }

  // 3. Seed Config Singletons
  const categoryIdMap = new Map<string, string>();
  const attributeIdMap = new Map<string, string>();

  preset.categories.forEach((cat) => {
    categoryIdMap.set(cat.slug, `${storeId}-cat-${cat.slug}`);
  });
  preset.attributes.forEach((attr) => {
    attributeIdMap.set(attr.code, `${storeId}-attr-${attr.code}`);
  });

  const featuredCats = preset.featuredCategories.slice(0, 3).map((fc) => ({
    ...fc,
    categoryId: categoryIdMap.get(fc.slug) ?? `${storeId}-cat-${fc.slug}`,
  }));

  const homePayload = {
    storeId,
    bannerTitle: preset.bannerTitle,
    bannerSubtitle: preset.bannerSubtitle,
    heroImages: preset.heroImages.map((imageUrl, idx) => ({
      imageUrl,
      order: idx + 1,
      linkType: 'none',
      linkId: null,
    })),
    carouselSettings: { interval: 6000, showIndicators: true },
    featuredCategories: featuredCats,
    updatedAt: new Date(),
  };
  await db.collection('banners').doc(`home_${storeId}`).set(homePayload, { merge: true });
  await db.collection('pages').doc(`home_${storeId}`).set(homePayload, { merge: true });

  const aboutUsPayload = {
    storeId,
    bannerTitle: 'Quiénes Somos',
    bannerSubtitle: `Conocé la historia y el equipo detrás de ${storeName}.`,
    bannerImageUrl: preset.heroImages[0] ?? '',
    centralTitle: 'Nuestra Historia',
    centralImageUrl: preset.heroImages[1] ?? preset.heroImages[0] ?? '',
    centralDescription: `${storeName} nació con la misión de acercarte lo mejor en tecnología, periféricos e innovación digital con garantía oficial.`,
    cardsSectionTitle: '¿Por qué elegirnos?',
    featureCards: [
      {
        title: 'Garantía Oficial',
        content: 'Todos nuestros productos cuentan con respaldo y soporte técnico.',
      },
      {
        title: 'Envíos en 24-48 hs',
        content: 'Despachamos de forma prioritaria a todo el país con seguimiento online.',
      },
      {
        title: 'Atención Especializada',
        content: 'Te asesoramos para armar tu setup ideal o elegir el equipo perfecto.',
      },
    ],
  };
  await db.collection('pages').doc(`aboutUs_${storeId}`).set(aboutUsPayload, { merge: true });

  const storeConfigPayload = {
    tenantId: storeId,
    storeId,
    storeName,
    tagline: preset.bannerSubtitle,
    strapline: '',
    logoUrl: '',
    faviconUrl: '',
    colors: { primary: '#2563eb', accent: '#06b6d4', background: '#ffffff' },
    contact: {
      phone: '+54 11 4567-8900',
      email: 'contacto@tecnologia.com.ar',
      whatsApp: 'https://wa.me/5491145678900',
      instagram: 'https://instagram.com/tecnologia.shop',
      facebook: 'https://facebook.com/tecnologia.shop',
    },
    seo: {
      metaTitle: `${storeName} | Tienda Oficial`,
      metaDescription: `Catálogo de tecnología, computación y gadgets.`,
    },
    features: { reviewsEnabled: true, wishlistEnabled: true, blogEnabled: false },
    payments: {
      mercadoPagoPublicKey: '',
      mercadoPago: {
        publicKey: '',
        accessTokenSecret: 'mp-access-token',
        accessTokenMasked: '',
        webhookUrl: '',
        validationStatus: 'pending',
        validationMessage: 'Sin token configurado.',
      },
    },
    currency: 'ARS',
    currencySymbol: '$',
    country: 'AR',
    setupCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db
    .collection('configuracion')
    .doc(`store_${storeId}`)
    .set(storeConfigPayload, { merge: true });
  await db
    .collection('configuracion')
    .doc(`footer_${storeId}`)
    .set(storeConfigPayload, { merge: true });

  // 4. Seed Categories
  const catBatch = db.batch();
  for (const cat of preset.categories) {
    const fullCatId = categoryIdMap.get(cat.slug) ?? `${storeId}-cat-${cat.slug}`;
    const mappedFilterable = (cat.filterableAttributes ?? []).map(
      (code) => attributeIdMap.get(code) ?? `${storeId}-attr-${code}`,
    );
    catBatch.set(db.collection('categories').doc(fullCatId), {
      name: cat.name,
      slug: cat.slug,
      order: cat.order,
      parentId: null,
      filterableAttributes: mappedFilterable,
      storeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await catBatch.commit();
  console.log(`[SeedScript] Seeded ${preset.categories.length} categories.`);

  // 5. Seed Attributes
  const attrBatch = db.batch();
  for (const attr of preset.attributes) {
    const fullAttrId = attributeIdMap.get(attr.code) ?? `${storeId}-attr-${attr.code}`;
    attrBatch.set(db.collection('attributes').doc(fullAttrId), {
      name: attr.name,
      code: attr.code,
      type: attr.type,
      values: attr.values,
      required: attr.required,
      storeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await attrBatch.commit();
  console.log(`[SeedScript] Seeded ${preset.attributes.length} attributes.`);

  // 6. Seed Products & Variants
  const seededProducts: Array<{ id: string; name: string; price: number }> = [];

  for (let i = 0; i < preset.sampleProducts.length; i++) {
    const prod = preset.sampleProducts[i];
    const prodId = `${storeId}-prod-${i + 1}`;
    const catId = categoryIdMap.get(prod.categorySlug) ?? `${storeId}-cat-${prod.categorySlug}`;

    const inStockAttributes: Record<string, string[]> = {};
    if (prod.variants && prod.variants.length > 0) {
      for (const variant of prod.variants) {
        for (const [code, val] of Object.entries(variant.attributes)) {
          const attrId = attributeIdMap.get(code) ?? `${storeId}-attr-${code}`;
          if (!inStockAttributes[attrId]) inStockAttributes[attrId] = [];
          if (!inStockAttributes[attrId].includes(val)) inStockAttributes[attrId].push(val);
        }
      }
    }

    const totalStock =
      prod.hasVariants && prod.variants && prod.variants.length > 0
        ? prod.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
        : prod.stock || 0;

    const prodData = {
      name: prod.name,
      description: prod.description,
      price: prod.price,
      costPrice: prod.costPrice ?? Math.round(prod.price * 0.6),
      categoryId: catId,
      image: prod.image,
      images: prod.images ?? [prod.image],
      totalStock,
      hasVariants: prod.hasVariants,
      sku: `${prod.skuPrefix}-BASE`,
      storeId,
      inStockAttributes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('products').doc(prodId).set(prodData);

    if (prod.hasVariants && prod.variants) {
      const varBatch = db.batch();
      for (const variant of prod.variants) {
        const mappedAttrs: Record<string, string> = {};
        for (const [code, val] of Object.entries(variant.attributes)) {
          const attrId = attributeIdMap.get(code) ?? `${storeId}-attr-${code}`;
          mappedAttrs[attrId] = val;
        }
        const varRef = db
          .collection('products')
          .doc(prodId)
          .collection('variants')
          .doc(variant.sku);
        varBatch.set(varRef, {
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
          attributes: mappedAttrs,
          productId: prodId,
          storeId,
          createdAt: new Date(),
        });
      }
      await varBatch.commit();
    }

    seededProducts.push({ id: prodId, name: prod.name, price: prod.price });
  }
  console.log(`[SeedScript] Seeded ${seededProducts.length} products with variants.`);

  // 7. Seed Demo Clients & Orders
  const clientBatch = db.batch();
  const clients = generateDemoClients(storeId);
  for (const client of clients) {
    clientBatch.set(db.collection('clients').doc(client.id), client);
  }
  await clientBatch.commit();

  const orderBatch = db.batch();
  const orders = generateDemoOrders(storeId, seededProducts);
  for (const order of orders) {
    orderBatch.set(db.collection('orders').doc(order.id), order);
  }
  await orderBatch.commit();

  console.log(`[SeedScript] Seeded ${clients.length} clients and ${orders.length} demo orders.`);
  console.log(`[SeedScript] ✅ Store "${storeName}" (${storeId}) successfully seeded!`);
}

if (require.main === module) {
  seedTechnologyStore()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SeedScript] Error:', err);
      process.exit(1);
    });
}
