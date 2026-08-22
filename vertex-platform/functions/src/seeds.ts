import type { OAuth2Client } from 'google-auth-library';
import * as logger from 'firebase-functions/logger';
import { apiFetch, retry } from './helpers';
import { getBusinessVerticalPresetAsync } from './verticals/verticals.registry';
import {
  toFirestoreFields,
  checkStoreSafety,
  clearCollection,
  deleteDocumentPath,
} from './verticals/seed-rest.helpers';
import { generateDemoClients, generateDemoOrders } from './verticals/demo-data.generator';

export { toFirestoreFields, toFirestoreValue } from './verticals/seed-rest.helpers';

export async function seedStoreData(
  auth: OAuth2Client,
  projectId: string,
  tenantId: string,
  verticalId: string,
  storeName?: string,
  includeMockData = true,
  bypassSafety = false,
  storeId?: string,
  provisioningMode = 'FULL_DEMO',
): Promise<void> {
  const activeStoreId = storeId ?? tenantId;
  const sName = storeName ? storeName.trim() : 'Vertex';
  const preset = await getBusinessVerticalPresetAsync(verticalId);
  const isModeEmpty = provisioningMode === 'EMPTY';
  const isModeCatalogOnly = provisioningMode === 'CATALOG_ONLY';
  const isModeFullDemo = !isModeEmpty && !isModeCatalogOnly && includeMockData;

  if (!bypassSafety) {
    await checkStoreSafety(auth, projectId, activeStoreId);
  }

  logger.info(
    `[SeedEngine] Starting seed on project "${projectId}" for store "${activeStoreId}" in mode "${provisioningMode}" with vertical "${preset.name}"...`,
  );

  // 1. Clear previous collections scoped to this storeId
  const collectionsToClear = ['products', 'categories', 'clients', 'orders', 'attributes'];
  for (const col of collectionsToClear) {
    await clearCollection(auth, projectId, col, activeStoreId);
  }
  await deleteDocumentPath(auth, projectId, `banners/home_${activeStoreId}`);

  // 2. Seed Singletons (Pages & Config)
  const categoryIdMap = new Map<string, string>();
  const attributeIdMap = new Map<string, string>();

  preset.categories.forEach((cat) => {
    categoryIdMap.set(cat.slug, `${activeStoreId}-cat-${cat.slug}`);
  });
  preset.attributes.forEach((attr) => {
    attributeIdMap.set(attr.code, `${activeStoreId}-attr-${attr.code}`);
  });

  const featuredCats = isModeEmpty
    ? []
    : preset.featuredCategories.map((fc) => ({
        ...fc,
        categoryId: categoryIdMap.get(fc.slug) ?? `${activeStoreId}-cat-${fc.slug}`,
      }));

  const homePayload = {
    storeId: activeStoreId,
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

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pages/home_${activeStoreId}`,
        { method: 'PATCH', body: toFirestoreFields(homePayload), quotaProject: projectId },
      ),
    5,
    3000,
  );

  const aboutUsPayload = {
    storeId: activeStoreId,
    bannerTitle: 'Quiénes Somos',
    bannerSubtitle: `Conocé la historia y el equipo detrás de ${sName}.`,
    bannerImageUrl: preset.heroImages[0] ?? '',
    centralTitle: 'Nuestra Historia',
    centralImageUrl: preset.heroImages[1] ?? preset.heroImages[0] ?? '',
    centralDescription: `${sName} nació con la misión de acercarte lo mejor en ${preset.name.toLowerCase()} con atención personalizada y garantía de satisfacción.`,
    cardsSectionTitle: '¿Por qué elegirnos?',
    featureCards: [
      { title: 'Calidad Garantizada', content: 'Seleccionamos rigurosamente cada producto de nuestro catálogo.' },
      { title: 'Envíos Rápidos', content: 'Despachamos tus pedidos con seguimiento online a todo el país.' },
      { title: 'Atención Personalizada', content: 'Estamos disponibles para asesorarte en cada paso de tu compra.' },
    ],
  };

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pages/aboutUs_${activeStoreId}`,
        { method: 'PATCH', body: toFirestoreFields(aboutUsPayload), quotaProject: projectId },
      ),
    5,
    3000,
  );

  const normalizedSlug = sName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const configPayload = {
    tenantId,
    storeId: activeStoreId,
    storeName: sName,
    tagline: preset.bannerSubtitle,
    strapline: '',
    logoUrl: '',
    faviconUrl: '',
    colors: { primary: '#ea580c', accent: '#ef4444', background: '#ffffff' },
    contact: {
      phone: '+54 11 4567-8900',
      email: `hola@${normalizedSlug || 'mi-tienda'}.com.ar`,
      whatsApp: 'https://wa.me/5491145678900',
      instagram: `https://instagram.com/${normalizedSlug || 'mi-tienda'}`,
      facebook: `https://facebook.com/${normalizedSlug || 'mi-tienda'}`,
    },
    seo: { metaTitle: sName, metaDescription: `Catálogo oficial de ${sName}.` },
    features: { reviewsEnabled: false, wishlistEnabled: false, blogEnabled: false },
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

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/configuracion/footer_${activeStoreId}`,
        { method: 'PATCH', body: toFirestoreFields(configPayload), quotaProject: projectId },
      ),
    5,
    3000,
  );

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/configuracion/store_${activeStoreId}`,
        { method: 'PATCH', body: toFirestoreFields(configPayload), quotaProject: projectId },
      ),
    5,
    3000,
  );

  if (isModeEmpty) {
    logger.info(`[SeedEngine] Mode EMPTY complete for store "${activeStoreId}". 0 items seeded.`);
    return;
  }

  // 3. Seed Categories
  for (const cat of preset.categories) {
    const fullCatId = categoryIdMap.get(cat.slug) ?? `${activeStoreId}-cat-${cat.slug}`;
    const mappedFilterable = (cat.filterableAttributes ?? []).map(
      (code) => attributeIdMap.get(code) ?? `${activeStoreId}-attr-${code}`,
    );
    const catData = {
      name: cat.name,
      slug: cat.slug,
      order: cat.order,
      parentId: null,
      filterableAttributes: mappedFilterable,
      storeId: activeStoreId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await retry(
      () =>
        apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/categories/${fullCatId}`,
          { method: 'PATCH', body: toFirestoreFields(catData), quotaProject: projectId },
        ),
      5,
      3000,
    );
  }

  // 4. Seed Attributes
  for (const attr of preset.attributes) {
    const fullAttrId = attributeIdMap.get(attr.code) ?? `${activeStoreId}-attr-${attr.code}`;
    const attrData = {
      name: attr.name,
      code: attr.code,
      type: attr.type,
      values: attr.values,
      required: attr.required,
      storeId: activeStoreId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await retry(
      () =>
        apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/attributes/${fullAttrId}`,
          { method: 'PATCH', body: toFirestoreFields(attrData), quotaProject: projectId },
        ),
      5,
      3000,
    );
  }

  // 5. Seed Products & Variants
  const seededProducts: Array<{ id: string; name: string; price: number }> = [];

  for (let i = 0; i < preset.sampleProducts.length; i++) {
    const prod = preset.sampleProducts[i];
    const prodId = `${activeStoreId}-prod-${i + 1}`;
    const catId = categoryIdMap.get(prod.categorySlug) ?? `${activeStoreId}-cat-${prod.categorySlug}`;

    const inStockAttributes: Record<string, string[]> = {};
    if (prod.variants && prod.variants.length > 0) {
      for (const variant of prod.variants) {
        for (const [code, val] of Object.entries(variant.attributes)) {
          const attrId = attributeIdMap.get(code) ?? `${activeStoreId}-attr-${code}`;
          if (!inStockAttributes[attrId]) inStockAttributes[attrId] = [];
          if (!inStockAttributes[attrId].includes(val)) inStockAttributes[attrId].push(val);
        }
      }
    }

    const prodData = {
      name: prod.name,
      description: prod.description,
      price: prod.price,
      costPrice: prod.costPrice ?? Math.round(prod.price * 0.6),
      categoryId: catId,
      image: prod.image,
      images: prod.images ?? [prod.image],
      totalStock: prod.stock,
      hasVariants: prod.hasVariants,
      sku: `${prod.skuPrefix}-BASE`,
      storeId: activeStoreId,
      inStockAttributes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await retry(
      () =>
        apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prodId}`,
          { method: 'PATCH', body: toFirestoreFields(prodData), quotaProject: projectId },
        ),
      5,
      3000,
    );

    if (prod.hasVariants && prod.variants) {
      for (const variant of prod.variants) {
        const mappedAttrs: Record<string, string> = {};
        for (const [code, val] of Object.entries(variant.attributes)) {
          const attrId = attributeIdMap.get(code) ?? `${activeStoreId}-attr-${code}`;
          mappedAttrs[attrId] = val;
        }
        const variantData = {
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
          attributes: mappedAttrs,
          storeId: activeStoreId,
          createdAt: new Date(),
        };
        await retry(
          () =>
            apiFetch(
              auth,
              `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prodId}/variants/${variant.sku}`,
              { method: 'PATCH', body: toFirestoreFields(variantData), quotaProject: projectId },
            ),
          5,
          3000,
        );
      }
    }

    seededProducts.push({ id: prodId, name: prod.name, price: prod.price });
  }

  // 6. Seed Demo Clients & Orders if FULL_DEMO
  if (isModeFullDemo) {
    const clients = generateDemoClients(activeStoreId);
    for (const client of clients) {
      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/clients/${client.id}`,
            { method: 'PATCH', body: toFirestoreFields(client as unknown as Record<string, unknown>), quotaProject: projectId },
          ),
        5,
        3000,
      );
    }

    const orders = generateDemoOrders(activeStoreId, seededProducts);
    for (const order of orders) {
      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${order.id}`,
            { method: 'PATCH', body: toFirestoreFields(order as unknown as Record<string, unknown>), quotaProject: projectId },
          ),
        5,
        3000,
      );
    }
  }

  logger.info(
    `[SeedEngine] Seeding completed successfully for store "${activeStoreId}" in project "${projectId}".`,
  );
}
