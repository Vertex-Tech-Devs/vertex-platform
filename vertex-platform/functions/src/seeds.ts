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
  ownerEmail?: string,
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
        categoryId: categoryIdMap.get(fc.slug) ?? `${activeStoreId}-cat-${fc.slug}`,
        name: fc.name,
        slug: fc.slug,
        imageUrl: fc.imageUrl,
      }));

  const homePayload = {
    storeId: activeStoreId,
    title: preset.bannerTitle,
    subtitle: preset.bannerSubtitle,
    bannerTitle: preset.bannerTitle,
    bannerSubtitle: preset.bannerSubtitle,
    buttonText: 'Explorar Catálogo',
    buttonLink: '/shop/catalog',
    imageUrl: preset.heroImages[0] ?? '',
    heroImages: preset.heroImages.map((imageUrl, idx) => ({
      imageUrl,
      order: idx + 1,
      linkType: 'category',
      linkId: featuredCats[idx % (featuredCats.length || 1)]?.categoryId ?? null,
    })),
    carouselSettings: { interval: 5000, showIndicators: true },
    featuredCategories: featuredCats,
    updatedAt: new Date(),
    lastUpdated: new Date(),
  };

  // Seed both banners/home and pages/home for total client compatibility
  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/banners/home_${activeStoreId}`,
        { method: 'PATCH', body: toFirestoreFields(homePayload), quotaProject: projectId },
      ),
    5,
    3000,
  );

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

  const defaultFeatureCards = [
    { icon: 'patch-check', title: 'Calidad Garantizada', content: 'Seleccionamos rigurosamente cada producto de nuestro catálogo.' },
    { icon: 'truck', title: 'Envíos Rápidos', content: 'Despachamos tus pedidos con seguimiento online a todo el país.' },
    { icon: 'headset', title: 'Atención Personalizada', content: 'Estamos disponibles para asesorarte en cada paso de tu compra.' },
  ];

  const aboutFeatureCards = (preset.featureCards && preset.featureCards.length > 0
    ? preset.featureCards.map((card, idx) => ({
        icon: (card as { icon?: string }).icon ?? (idx === 0 ? 'patch-check' : idx === 1 ? 'truck' : 'headset'),
        title: card.title,
        content: card.content,
      }))
    : defaultFeatureCards);

  const aboutUsPayload = {
    storeId: activeStoreId,
    bannerTitle: 'Quiénes Somos',
    bannerSubtitle: `Conocé la historia, el equipo y la visión detrás de ${sName}.`,
    bannerImageUrl: preset.heroImages[0] ?? '',
    centralTitle: 'Nuestra Historia',
    centralImageUrl: preset.heroImages[1] ?? preset.heroImages[0] ?? '',
    centralDescription: `${sName} nació con la misión de acercarte lo mejor en ${preset.name.toLowerCase()} con atención personalizada, catálogo seleccionado y garantía de satisfacción.\n\nContamos con un equipo apasionado y logística integral para que tu experiencia de compra sea impecable de principio a fin.`,
    cardsSectionTitle: '¿Por qué elegirnos?',
    featureCards: aboutFeatureCards,
    updatedAt: new Date(),
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
  // Email real del dueño (owner) si está disponible; fallback demo para tests/back-compat.
  const effectiveOwnerEmail = ownerEmail?.trim() || `admin@${normalizedSlug || 'mi-tienda'}.com.ar`;
  const brandColors = preset.colors ?? { primary: '#6366f1', accent: '#06b6d4', background: '#ffffff' };
  const whatsAppText = encodeURIComponent(`¡Hola! Quisiera hacer una consulta en la tienda de ${sName}.`);

  const deliveryMethodsConfig = {
    enableStorePickup: true,
    enableHomeDelivery: true,
    homeDeliveryDescription: 'Envíos a todo el país coordinados por WhatsApp o despachados por correo prioritario.',
    pickupLocations: [
      {
        id: `${activeStoreId}-loc-central`,
        name: 'Sucursal Central / Showroom',
        address: 'Av. Corrientes 1450',
        city: 'CABA',
        schedule: 'Lunes a Viernes de 10:00 a 19:00 hs / Sábados de 10:00 a 14:00 hs',
        notes: 'Presentar DNI y número de pedido para retirar.',
        enabled: true,
        days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
        timeFrom1: '10:00',
        timeTo1: '19:00',
        hasSplitSchedule: false,
      },
      {
        id: `${activeStoreId}-loc-nordelta`,
        name: 'Punto de Entrega Zona Norte',
        address: 'Av. del Libertador 2200',
        city: 'Vicente López',
        schedule: 'Lunes a Sábados de 11:00 a 20:00 hs',
        notes: 'Retiro previa confirmación de pedido preparado.',
        enabled: true,
        days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
        timeFrom1: '11:00',
        timeTo1: '20:00',
        hasSplitSchedule: false,
      },
    ],
  };

  const footerPayload = {
    storeId: activeStoreId,
    contactPhone: '+54 11 4567-8900',
    contactEmail: `hola@${normalizedSlug || 'mi-tienda'}.com.ar`,
    socialInstagramUrl: `https://instagram.com/${normalizedSlug || 'mi-tienda'}`,
    socialFacebookUrl: `https://facebook.com/${normalizedSlug || 'mi-tienda'}`,
    socialWhatsAppUrl: `https://wa.me/5491145678900?text=${whatsAppText}`,
    copyrightText: `© ${new Date().getFullYear()} ${sName}. Todos los derechos reservados. Desarrollado con Vertex Commerce.`,
    updatedAt: new Date(),
  };

  const configPayload = {
    tenantId,
    storeId: activeStoreId,
    storeName: sName,
    tagline: preset.tagline ?? preset.bannerSubtitle,
    strapline: `Tienda Oficial de ${sName}`,
    logoUrl: '',
    faviconUrl: '',
    colors: brandColors,
    contact: {
      phone: '+54 11 4567-8900',
      email: `hola@${normalizedSlug || 'mi-tienda'}.com.ar`,
      whatsApp: `https://wa.me/5491145678900?text=${whatsAppText}`,
      instagram: `https://instagram.com/${normalizedSlug || 'mi-tienda'}`,
      facebook: `https://facebook.com/${normalizedSlug || 'mi-tienda'}`,
    },
    // Root level contact fields for dual compatibility
    contactPhone: '+54 11 4567-8900',
    contactEmail: `hola@${normalizedSlug || 'mi-tienda'}.com.ar`,
    socialInstagramUrl: `https://instagram.com/${normalizedSlug || 'mi-tienda'}`,
    socialFacebookUrl: `https://facebook.com/${normalizedSlug || 'mi-tienda'}`,
    socialWhatsAppUrl: `https://wa.me/5491145678900?text=${whatsAppText}`,
    copyrightText: `© ${new Date().getFullYear()} ${sName}. Todos los derechos reservados. Desarrollado con Vertex Commerce.`,
    seo: { metaTitle: sName, metaDescription: `Catálogo oficial de ${sName}. ${preset.description}` },
    features: { reviewsEnabled: true, wishlistEnabled: true, blogEnabled: false },
    deliveryMethods: deliveryMethodsConfig,
    // Email management configurations
    storeOwnerEmail: effectiveOwnerEmail,
    notificationEmail: effectiveOwnerEmail,
    emailSenderName: sName,
    emailSignature: `El equipo de ${sName} | Atención al Cliente`,
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
        { method: 'PATCH', body: toFirestoreFields(footerPayload), quotaProject: projectId },
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

  const emailTemplatesPayload = {
    storeId: activeStoreId,
    storeOwnerEmail: effectiveOwnerEmail,
    storeWhatsappNumber: '+54 9 11 4567-8900',
    adminNotification: {
      subject: `¡Nueva compra recibida en ${sName}! Pedido #{orderId}`,
      template: `<p style="margin:0 0 18px;font-size:16px;">¡Hola equipo de <strong>${sName}</strong>! 👋</p><p style="margin:0 0 20px;color:#475569;">Recibimos un nuevo pedido en tu tienda. Resumen:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;"><tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px 0 0 10px;padding:12px 16px;font-size:13px;color:#64748b;">Pedido</td><td style="background:#fff;border:1px solid #e2e8f0;border-left:none;border-radius:0 10px 10px 0;padding:12px 16px;font-weight:700;color:#0f172a;">#{orderId}</td></tr><tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px 0 0 10px;padding:12px 16px;font-size:13px;color:#64748b;">Cliente</td><td style="background:#fff;border:1px solid #e2e8f0;border-left:none;border-radius:0 10px 10px 0;padding:12px 16px;color:#0f172a;">{clientName}<br/><span style="color:#64748b;font-size:13px;">{clientEmail} · {clientPhone}</span></td></tr></table><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:16px;">{itemsList}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="padding:12px 0;font-size:15px;font-weight:700;color:#0f172a;border-top:2px solid #e2e8f0;">Total</td><td style="padding:12px 0;text-align:right;font-size:18px;font-weight:800;color:#4f46e5;border-top:2px solid #e2e8f0;">${'{totalAmount}'}</td></tr></table>{deliverySection}`,
      showManageButton: true,
      showWhatsappButton: false,
    },
    customerConfirmation: {
      subject: `¡Gracias por tu compra en ${sName}! Pedido #{orderId}`,
      template: `<p style="margin:0 0 18px;font-size:16px;">¡Hola, {clientName}! 🛍️</p><p style="margin:0 0 20px;color:#475569;">¡Gracias por tu compra! Hemos recibido tu pedido <strong>#{orderId}</strong> y ya lo estamos preparando.</p><h4 style="margin:0 0 10px;font-size:14px;color:#334155;text-transform:uppercase;letter-spacing:0.5px;">Resumen de tu Compra</h4><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:16px;">{itemsList}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="padding:12px 0;font-size:15px;font-weight:700;color:#0f172a;border-top:2px solid #e2e8f0;">Total Pagado</td><td style="padding:12px 0;text-align:right;font-size:18px;font-weight:800;color:#4f46e5;border-top:2px solid #e2e8f0;">${'{totalAmount}'}</td></tr></table>{deliverySection}<p style="margin:18px 0 0;color:#475569;font-size:14px;">Te avisaremos en cuanto esté listo para despacho o retiro.</p>`,
      showManageButton: false,
      showWhatsappButton: true,
    },
    updatedAt: new Date(),
  };

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/emailTemplates_${activeStoreId}`,
        { method: 'PATCH', body: toFirestoreFields(emailTemplatesPayload), quotaProject: projectId },
      ),
    5,
    3000,
  );

  if (isModeEmpty) {
    logger.info(`[SeedEngine] Mode EMPTY complete for store "${activeStoreId}". 0 items seeded.`);
    return;
  }

  // 3. Seed Categories
  for (let i = 0; i < preset.categories.length; i++) {
    const cat = preset.categories[i];
    const fullCatId = categoryIdMap.get(cat.slug) ?? `${activeStoreId}-cat-${cat.slug}`;
    const mappedFilterable = (cat.filterableAttributes ?? []).map(
      (code) => attributeIdMap.get(code) ?? `${activeStoreId}-attr-${code}`,
    );
    const featCat = preset.featuredCategories.find((fc) => fc.slug === cat.slug);
    const categoryImageUrl =
      (cat as { imageUrl?: string }).imageUrl ||
      featCat?.imageUrl ||
      preset.heroImages[i % preset.heroImages.length] ||
      '';

    const catData = {
      name: cat.name,
      slug: cat.slug,
      order: cat.order ?? i + 1,
      parentId: null,
      filterableAttributes: mappedFilterable,
      imageUrl: categoryImageUrl,
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
  const seededProducts: Array<{ id: string; name: string; price: number; image?: string }> = [];

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

    const variantAttributes =
      prod.variants && prod.variants.length > 0
        ? Object.keys(prod.variants[0].attributes).map(
            (code) => attributeIdMap.get(code) ?? `${activeStoreId}-attr-${code}`,
          )
        : [];

    const prodData = {
      name: prod.name,
      description: prod.description,
      price: prod.price,
      costPrice: prod.costPrice ?? Math.round(prod.price * 0.6),
      compareAtPrice: Math.round(prod.price * 1.2),
      categoryId: catId,
      image: prod.image,
      images: prod.images ?? [prod.image],
      totalStock: prod.stock,
      hasVariants: prod.hasVariants,
      sku: `${prod.skuPrefix}-BASE`,
      storeId: activeStoreId,
      inStockAttributes,
      variantAttributes,
      isFeatured: i < 6,
      inStock: prod.stock > 0,
      rating: 4.8,
      reviewsCount: 12 + (i % 15),
      tags: [preset.id, prod.categorySlug, 'nuevo', 'destacado'],
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
    } else {
      const baseVariantData = {
        sku: `${prod.skuPrefix}-BASE`,
        price: prod.price,
        stock: prod.stock,
        attributes: {},
        storeId: activeStoreId,
        createdAt: new Date(),
      };
      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prodId}/variants/default`,
            { method: 'PATCH', body: toFirestoreFields(baseVariantData), quotaProject: projectId },
          ),
        5,
        3000,
      );
    }

    seededProducts.push({ id: prodId, name: prod.name, price: prod.price, image: prod.image });
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
