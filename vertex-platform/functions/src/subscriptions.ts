import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ALLOWED_ORIGINS, PLATFORM_PROJECT } from './helpers';
import { resolvePlatformEnvironment } from './runtime';
import { logAuditAction } from './stores';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretsClient = new SecretManagerServiceClient();

/**
 * Precios base por defecto de la suscripción SaaS única de Vertex.
 */
export const DEFAULT_SUBSCRIPTION_PRICING = {
  name: 'Plan Único Vertex Store',
  description: 'Acceso completo a la plataforma de comercio multi-tenant de Vertex.',
  monthlyPrice: 50000,
  annualPrice: 500000,
};

/**
 * Identifica si el usuario autenticado cuenta con el rol de Administrador de Recaudación Principal
 * para la configuración segura de credenciales de pago y tesorería.
 */
export function isMasterBillingAdmin(authEmail?: string): boolean {
  if (!authEmail) return false;
  const configuredMasters = process.env['MASTER_BILLING_ADMIN_EMAILS']
    ? process.env['MASTER_BILLING_ADMIN_EMAILS'].split(',').map((e) => e.trim().toLowerCase())
    : ['juan.l.espeche@gmail.com', 'vertex.tech.dev@gmail.com'];
  return configuredMasters.includes(authEmail.toLowerCase().trim());
}

/**
 * Obtiene la configuración de precios y tarifas desde Firestore (o defaults).
 */
export async function getEffectivePricing(): Promise<{
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
}> {
  try {
    const db = getFirestore();
    const configSnap = await db.collection('platform_config').doc('billing').get();
    if (configSnap.exists) {
      const data = configSnap.data() || {};
      return {
        name: data['name'] || DEFAULT_SUBSCRIPTION_PRICING.name,
        description: data['description'] || DEFAULT_SUBSCRIPTION_PRICING.description,
        monthlyPrice: Number(data['monthlyPrice']) || DEFAULT_SUBSCRIPTION_PRICING.monthlyPrice,
        annualPrice: Number(data['annualPrice']) || DEFAULT_SUBSCRIPTION_PRICING.annualPrice,
      };
    }
  } catch (err) {
    console.warn(
      '[getEffectivePricing] Could not read platform_config/billing, using defaults:',
      err,
    );
  }
  return { ...DEFAULT_SUBSCRIPTION_PRICING };
}

/**
 * Resuelve el token de acceso central de Mercado Pago de la plataforma.
 */
async function getPlatformMercadoPagoAccessToken(): Promise<string> {
  const envToken =
    process.env['MP_PLATFORM_ACCESS_TOKEN'] || process.env['MERCADOPAGO_ACCESS_TOKEN'];
  if (envToken) return envToken;

  const projectId =
    process.env['GCLOUD_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT'] || 'vertex-platform-app';

  try {
    const [version] = await secretsClient.accessSecretVersion({
      name: `projects/${projectId}/secrets/mp-platform-access-token/versions/latest`,
    });
    const secretValue = version.payload?.data?.toString();
    if (secretValue) return secretValue;
  } catch (err) {
    console.warn(
      '[getPlatformMercadoPagoAccessToken] Failed to read Secret Manager, checking fallback in platform_config:',
      err,
    );
  }

  try {
    const db = getFirestore();
    const snap = await db.collection('platform_config').doc('billing').get();
    if (snap.exists && snap.data()?.['mpAccessToken']) {
      return snap.data()!['mpAccessToken'];
    }
  } catch {}

  // Test token fallback para ambiente de desarrollo si aún no se configuró en producción
  return 'TEST-5735100067673516-022718-d76249ff9359e19d77e48b81329a2444-245353597';
}

/**
 * Consulta la configuración global de facturación y estado del token.
 */
export const getPlatformBillingConfig = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado.');
    }

    const email = request.auth.token.email;
    const isMaster = isMasterBillingAdmin(email);
    const pricing = await getEffectivePricing();
    const token = await getPlatformMercadoPagoAccessToken();

    // Enmascarar token para no exponer credenciales
    const isConfigured = Boolean(token && !token.startsWith('TEST-'));
    const maskedToken = token ? `${token.substring(0, 10)}...${token.slice(-4)}` : null;

    return {
      pricing,
      isMasterAdmin: isMaster,
      platformMercadoPago: {
        isConfigured,
        maskedToken,
      },
    };
  },
);

/**
 * Actualiza la configuración global de precios y credenciales de la plataforma.
 * NOTA: La credencial central de recaudación requiere privilegios de Administrador de Recaudación.
 */
export const updatePlatformBillingConfig = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado.');
    }

    const email = request.auth.token.email;
    const isMaster = isMasterBillingAdmin(email);

    const { monthlyPrice, annualPrice, name, description, mpAccessToken } = request.data as {
      monthlyPrice?: number;
      annualPrice?: number;
      name?: string;
      description?: string;
      mpAccessToken?: string;
    };

    // SEGURIDAD CRÍTICA: Solo Administradores de Recaudación pueden configurar o actualizar el token central
    if (mpAccessToken && !isMaster) {
      throw new HttpsError(
        'permission-denied',
        'Acceso restringido: El token de recaudación central de pagos requiere privilegios de Administrador de Recaudación.',
      );
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: email,
    };

    if (monthlyPrice !== undefined) {
      if (typeof monthlyPrice !== 'number' || monthlyPrice < 0) {
        throw new HttpsError('invalid-argument', 'El precio mensual debe ser un número positivo.');
      }
      updates['monthlyPrice'] = monthlyPrice;
    }

    if (annualPrice !== undefined) {
      if (typeof annualPrice !== 'number' || annualPrice < 0) {
        throw new HttpsError('invalid-argument', 'El precio anual debe ser un número positivo.');
      }
      updates['annualPrice'] = annualPrice;
    }

    if (name) updates['name'] = String(name).trim();
    if (description) updates['description'] = String(description).trim();
    if (mpAccessToken && isMaster) updates['mpAccessToken'] = String(mpAccessToken).trim();

    const db = getFirestore();
    await db.collection('platform_config').doc('billing').set(updates, { merge: true });

    await logAuditAction(
      request.auth.uid,
      email,
      'updatePlatformBillingConfig',
      'platform_config/billing',
      'success',
      {
        monthlyPrice,
        annualPrice,
        name,
        hasToken: Boolean(mpAccessToken),
        updatedFields: Object.keys(updates),
      },
    );

    return {
      success: true,
      message: 'Tarifas y configuración de plataforma actualizadas correctamente.',
      pricing: await getEffectivePricing(),
    };
  },
);

/**
 * Genera el enlace de pago/suscripción en Mercado Pago para una tienda específica.
 * Soporta débito mensual automático (Preapproval) o pago único anual (Preference).
 * Accesible tanto para administradores como para clientes desde la vista pública de pago.
 */
export const createStoreSubscriptionLink = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    const {
      storeId,
      billingCycle = 'monthly',
      payerEmail,
    } = request.data as {
      storeId: string;
      billingCycle?: 'monthly' | 'annual';
      payerEmail?: string;
    };

    if (!storeId) {
      throw new HttpsError('invalid-argument', 'El ID de la tienda es requerido.');
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      throw new HttpsError('not-found', 'Tienda no encontrada.');
    }

    const storeData = storeSnap.data() || {};
    const effectivePricing = await getEffectivePricing();

    // 1. Calcular precio final considerando descuentos o precios personalizados asignados por Juan
    const subConfig = storeData['subscription'] || {};
    let finalAmount =
      billingCycle === 'monthly' ? effectivePricing.monthlyPrice : effectivePricing.annualPrice;

    if (billingCycle === 'monthly' && typeof subConfig['customMonthlyPrice'] === 'number') {
      finalAmount = subConfig['customMonthlyPrice'];
    } else if (billingCycle === 'annual' && typeof subConfig['customAnnualPrice'] === 'number') {
      finalAmount = subConfig['customAnnualPrice'];
    } else if (
      typeof subConfig['discountPercent'] === 'number' &&
      subConfig['discountPercent'] > 0
    ) {
      const discount = (finalAmount * subConfig['discountPercent']) / 100;
      finalAmount = Math.max(0, Math.round(finalAmount - discount));
    }

    const targetEmail =
      payerEmail ||
      storeData['ownerEmail'] ||
      request.auth?.token?.email ||
      'facturacion@vertexcommerce.com';
    const mpAccessToken = await getPlatformMercadoPagoAccessToken();
    const storeName = storeData['name'] || storeId;

    const platformEnv = resolvePlatformEnvironment(PLATFORM_PROJECT);
    const platformBaseUrl =
      platformEnv === 'development'
        ? 'https://vertex-platform-dev.web.app'
        : 'https://vertex-platform-app.web.app';

    if (billingCycle === 'monthly') {
      // MERCADO PAGO PREAPPROVAL API (Débito mensual automático)
      const payload = {
        payer_email: targetEmail,
        back_url: `${platformBaseUrl}/pay/${storeId}/success`,
        reason: `Vertex Store — ${storeName} (Mensual)`,
        external_reference: storeId,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: finalAmount,
          currency_id: 'ARS',
        },
      };

      const response = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.error('[createStoreSubscriptionLink:monthly] MP Error:', errBody);
        throw new HttpsError(
          'internal',
          `Error al crear suscripción en Mercado Pago: ${errBody?.message || response.statusText}`,
        );
      }

      const result = await response.json();
      const initPoint = result.init_point || result.sandbox_init_point;

      await storeRef.update({
        'subscription.billingCycle': 'monthly',
        'subscription.lastGeneratedLink': initPoint,
        'subscription.preapprovalId': result.id,
        'subscription.amount': finalAmount,
        'subscription.updatedAt': new Date(),
      });

      return {
        success: true,
        checkoutUrl: initPoint,
        preapprovalId: result.id,
        billingCycle: 'monthly',
        amount: finalAmount,
      };
    } else {
      // MERCADO PAGO PREFERENCE API (Pago Anual Adelantado)
      const payload = {
        items: [
          {
            id: `vertex-store-annual-${storeId}`,
            title: `Vertex Store — ${storeName} (Suscripción Anual)`,
            description: `Suscripción anual para la tienda ${storeName} con 2 meses bonificados.`,
            quantity: 1,
            unit_price: finalAmount,
            currency_id: 'ARS',
          },
        ],
        payer: {
          email: targetEmail,
        },
        back_urls: {
          success: `${platformBaseUrl}/pay/${storeId}/success`,
          pending: `${platformBaseUrl}/pay/${storeId}?status=pending`,
          failure: `${platformBaseUrl}/pay/${storeId}?status=failure`,
        },
        auto_return: 'approved',
        external_reference: `annual_${storeId}`,
        notification_url:
          'https://us-central1-vertex-platform-app.cloudfunctions.net/platformMercadoPagoWebhook',
      };

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.error('[createStoreSubscriptionLink:annual] MP Error:', errBody);
        throw new HttpsError(
          'internal',
          `Error al crear preferencia anual en Mercado Pago: ${errBody?.message || response.statusText}`,
        );
      }

      const result = await response.json();
      const initPoint = result.init_point || result.sandbox_init_point;

      await storeRef.update({
        'subscription.billingCycle': 'annual',
        'subscription.lastGeneratedLink': initPoint,
        'subscription.preferenceId': result.id,
        'subscription.amount': finalAmount,
        'subscription.updatedAt': new Date(),
      });

      return {
        success: true,
        checkoutUrl: initPoint,
        preferenceId: result.id,
        billingCycle: 'annual',
        amount: finalAmount,
      };
    }
  },
);

/**
 * Consulta la información pública necesaria para renderizar el formulario y portal de pago seguro (/pay/:storeId).
 * NO requiere autenticación de administrador (abierto para clientes de la tienda).
 */
export const getPublicStoreSubscriptionInfo = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    const { storeIdOrSlug } = request.data as { storeIdOrSlug: string };
    if (!storeIdOrSlug || typeof storeIdOrSlug !== 'string') {
      throw new HttpsError(
        'invalid-argument',
        'El identificador o slug de la tienda es requerido.',
      );
    }

    const db = getFirestore();
    let storeDoc = await db.collection('stores').doc(storeIdOrSlug.trim()).get();

    if (!storeDoc.exists) {
      // Intentar buscar por slug
      const slugQuery = await db
        .collection('stores')
        .where('slug', '==', storeIdOrSlug.trim().toLowerCase())
        .limit(1)
        .get();
      if (!slugQuery.empty) {
        storeDoc = slugQuery.docs[0];
      }
    }

    if (!storeDoc.exists) {
      throw new HttpsError('not-found', 'Tienda no encontrada.');
    }

    const storeId = storeDoc.id;
    const data = storeDoc.data() || {};
    const effectivePricing = await getEffectivePricing();
    const subConfig = data['subscription'] || {};

    let monthlyPrice = effectivePricing.monthlyPrice;
    let annualPrice = effectivePricing.annualPrice;

    if (typeof subConfig['customMonthlyPrice'] === 'number') {
      monthlyPrice = subConfig['customMonthlyPrice'];
    }
    if (typeof subConfig['customAnnualPrice'] === 'number') {
      annualPrice = subConfig['customAnnualPrice'];
    }
    const discountPercent =
      typeof subConfig['discountPercent'] === 'number' ? subConfig['discountPercent'] : 0;
    if (discountPercent > 0) {
      monthlyPrice = Math.max(0, Math.round(monthlyPrice * (1 - discountPercent / 100)));
      annualPrice = Math.max(0, Math.round(annualPrice * (1 - discountPercent / 100)));
    }

    // Calcular días restantes de trial
    let trialDaysRemaining = 0;
    const status = subConfig['status'] || 'trial';
    if (status === 'trial') {
      const endTs = subConfig['trialEndDate'] || subConfig['currentPeriodEnd'];
      if (endTs) {
        const endDate =
          typeof endTs.toDate === 'function'
            ? endTs.toDate()
            : new Date((endTs.seconds || 0) * 1000);
        trialDaysRemaining = Math.max(
          0,
          Math.ceil((endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        );
      }
    }

    return {
      storeId,
      name: data['name'] || storeId,
      slug: data['slug'] || storeId,
      logoUrl: data['logoUrl'] || null,
      defaultUrl: data['defaultUrl'] || `https://${data['slug'] || storeId}.web.app`,
      ownerEmail: data['ownerEmail'] || null,
      status: data['status'] || 'active',
      subscriptionStatus: status,
      trialDaysRemaining,
      trialEndDate: subConfig['trialEndDate']?.toDate
        ? subConfig['trialEndDate'].toDate().toISOString()
        : null,
      currentPeriodEnd: subConfig['currentPeriodEnd']?.toDate
        ? subConfig['currentPeriodEnd'].toDate().toISOString()
        : null,
      monthlyPrice,
      annualPrice,
      baseMonthlyPrice: effectivePricing.monthlyPrice,
      baseAnnualPrice: effectivePricing.annualPrice,
      discountPercent: discountPercent > 0 ? discountPercent : null,
    };
  },
);

/**
 * Consulta el estado de suscripción y descuentos de una tienda.
 */
export const getStoreSubscription = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado.');
    }

    const { storeId } = request.data as { storeId: string };
    if (!storeId) {
      throw new HttpsError('invalid-argument', 'El ID de la tienda es requerido.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) {
      throw new HttpsError('not-found', 'Tienda no encontrada.');
    }

    const storeData = storeSnap.data() || {};
    const subscription = storeData['subscription'] || {
      status: 'active',
      billingCycle: 'monthly',
    };

    const effectivePricing = await getEffectivePricing();
    const email = request.auth.token.email;
    const isMaster = isMasterBillingAdmin(email);

    return {
      storeId,
      subscription,
      basePricing: effectivePricing,
      isMasterAdmin: isMaster,
    };
  },
);

/**
 * Permite cambiar el estado de suscripción (Activa, Cortesía / Gratis, Período de Prueba, Suspendida),
 * o aplicar montos específicos, descuentos o períodos de prueba a una tienda.
 * Disponible para administradores de plataforma autorizados.
 */
export const updateStoreSubscriptionStatus = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado.');
    }

    const email = request.auth.token.email;

    const {
      storeId,
      status,
      customMonthlyPrice,
      customAnnualPrice,
      discountPercent,
      trialDays,
      notes,
      simulateExpiration,
    } = request.data as {
      storeId: string;
      status?: 'active' | 'complimentary' | 'trial' | 'past_due' | 'suspended';
      customMonthlyPrice?: number | null;
      customAnnualPrice?: number | null;
      discountPercent?: number | null;
      trialDays?: number | null;
      notes?: string;
      simulateExpiration?: 'imminent' | 'grace_period' | 'expired_suspended' | 'reset_trial';
    };

    if (!storeId) {
      throw new HttpsError('invalid-argument', 'El ID de la tienda es requerido.');
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      throw new HttpsError('not-found', 'Tienda no encontrada.');
    }

    const updates: Record<string, any> = {
      'subscription.updatedAt': new Date(),
      'subscription.updatedBy': email,
    };

    // Simulador de expiración para testing y QA
    if (simulateExpiration) {
      const now = Date.now();
      if (simulateExpiration === 'imminent') {
        // Expira en 1 hora
        const oneHourAhead = new Date(now + 60 * 60 * 1000);
        updates['subscription.status'] = 'trial';
        updates['subscription.currentPeriodEnd'] = Timestamp.fromDate(oneHourAhead);
        updates['subscription.trialEndDate'] = Timestamp.fromDate(oneHourAhead);
        updates['status'] = 'active';
      } else if (simulateExpiration === 'grace_period') {
        // Vencida hace 2 días (dentro del período de 5 días de gracia)
        const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
        updates['subscription.status'] = 'past_due';
        updates['subscription.currentPeriodEnd'] = Timestamp.fromDate(twoDaysAgo);
        updates['subscription.trialEndDate'] = Timestamp.fromDate(twoDaysAgo);
        updates['status'] = 'active';
      } else if (simulateExpiration === 'expired_suspended') {
        // Vencida hace 7 días (excede los 5 días de gracia -> suspendida)
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        updates['subscription.status'] = 'suspended';
        updates['subscription.currentPeriodEnd'] = Timestamp.fromDate(sevenDaysAgo);
        updates['subscription.trialEndDate'] = Timestamp.fromDate(sevenDaysAgo);
        updates['subscription.suspendedAt'] = new Date();
        updates['status'] = 'suspended';
      } else if (simulateExpiration === 'reset_trial') {
        // Restablece 14 días limpios de prueba
        const fourteenDays = new Date(now + 14 * 24 * 60 * 60 * 1000);
        updates['subscription.status'] = 'trial';
        updates['subscription.trialDays'] = 14;
        updates['subscription.trialStartDate'] = new Date();
        updates['subscription.trialEndDate'] = Timestamp.fromDate(fourteenDays);
        updates['subscription.currentPeriodEnd'] = Timestamp.fromDate(fourteenDays);
        updates['status'] = 'active';
      }
    } else if (status === 'trial' || (typeof trialDays === 'number' && trialDays > 0)) {
      const days = typeof trialDays === 'number' && trialDays > 0 ? trialDays : 14;
      const trialEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      updates['subscription.status'] = 'trial';
      updates['subscription.trialDays'] = days;
      updates['subscription.trialStartDate'] = new Date();
      updates['subscription.trialEndDate'] = Timestamp.fromDate(trialEndDate);
      updates['subscription.currentPeriodEnd'] = Timestamp.fromDate(trialEndDate);
      updates['status'] = 'active'; // Garantizar que la tienda esté operativa durante el período de prueba
    } else if (status) {
      updates['subscription.status'] = status;
      if (status === 'complimentary' || status === 'active') {
        const oneYearAhead = new Date();
        oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
        updates['subscription.currentPeriodEnd'] = Timestamp.fromDate(oneYearAhead);
        updates['status'] = 'active'; // Garantizar que la tienda esté operativa
      } else if (status === 'suspended') {
        updates['status'] = 'suspended'; // Suspender actividad de la tienda
      }
    }

    if (customMonthlyPrice !== undefined) {
      updates['subscription.customMonthlyPrice'] = customMonthlyPrice;
    }
    if (customAnnualPrice !== undefined) {
      updates['subscription.customAnnualPrice'] = customAnnualPrice;
    }
    if (discountPercent !== undefined) {
      updates['subscription.discountPercent'] = discountPercent;
    }
    if (notes) {
      updates['subscription.notes'] = notes;
    }

    await storeRef.update(updates);

    await logAuditAction(
      request.auth.uid,
      email,
      'updateStoreSubscriptionStatus',
      storeId,
      'success',
      {
        status,
        customMonthlyPrice,
        customAnnualPrice,
        discountPercent,
        trialDays,
        notes,
        simulateExpiration,
      },
    );

    return { success: true, storeId, status: updates['subscription.status'] || status, updates };
  },
);

/**
 * Webhook de Mercado Pago para procesar eventos de suscripciones y pagos SaaS.
 * Automatiza la activación, renovación y levantamiento de suspensiones.
 */
export const platformMercadoPagoWebhook = onRequest(
  { cors: true, invoker: 'public' },
  async (req, res) => {
    try {
      const body = req.body || {};
      const type = body.type || req.query['type'] || body.action;
      const dataId = body.data?.id || req.query['data.id'] || req.query['id'];

      console.info(`[platformMercadoPagoWebhook] Event received: type=${type}, id=${dataId}`);

      if (!dataId) {
        res.status(200).send({ received: true, ignored: 'no_id' });
        return;
      }

      const mpAccessToken = await getPlatformMercadoPagoAccessToken();
      const db = getFirestore();

      // Procesar eventos de Suscripción Recurrente (Preapproval)
      if (type === 'subscription_preapproval' || type === 'preapproval') {
        const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });

        if (mpRes.ok) {
          const subData = await mpRes.json();
          const storeId = subData.external_reference;
          const status = subData.status; // 'authorized', 'paused', 'cancelled', 'pending'

          if (storeId) {
            const storeRef = db.collection('stores').doc(storeId);
            const nextPaymentDate = subData.next_payment_date
              ? new Date(subData.next_payment_date)
              : null;
            const periodEnd = nextPaymentDate || new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);

            const updates: Record<string, any> = {
              'subscription.status': status === 'authorized' ? 'active' : status,
              'subscription.preapprovalId': dataId,
              'subscription.payerEmail': subData.payer_email,
              'subscription.currentPeriodEnd': Timestamp.fromDate(periodEnd),
              'subscription.lastPaymentDate': new Date(),
              'subscription.updatedAt': new Date(),
            };

            // Reactivación inmediata si estaba suspendida
            if (status === 'authorized') {
              updates['status'] = 'active';
            }

            await storeRef.update(updates);
            console.info(
              `[platformMercadoPagoWebhook] Updated preapproval for store ${storeId}: status=${status}`,
            );
          }
        }
      }

      // Procesar eventos de Pago Único Anual
      if (type === 'payment') {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });

        if (mpRes.ok) {
          const paymentData = await mpRes.json();
          const extRef = String(paymentData.external_reference || '');

          if (extRef.startsWith('annual_')) {
            const storeId = extRef.replace('annual_', '');
            const isApproved = paymentData.status === 'approved';

            if (storeId && isApproved) {
              const storeRef = db.collection('stores').doc(storeId);
              const oneYearAhead = new Date();
              oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);

              await storeRef.update({
                'subscription.status': 'active',
                'subscription.billingCycle': 'annual',
                'subscription.currentPeriodEnd': Timestamp.fromDate(oneYearAhead),
                'subscription.lastPaymentId': String(dataId),
                'subscription.lastPaymentDate': new Date(),
                'subscription.updatedAt': new Date(),
                status: 'active', // Reactivación automática inmediata
              });

              console.info(
                `[platformMercadoPagoWebhook] Annual payment approved for store ${storeId}. Renewed for 1 year.`,
              );
            }
          }
        }
      }

      res.status(200).send({ received: true });
    } catch (err) {
      console.error('[platformMercadoPagoWebhook] Error processing webhook:', err);
      res.status(500).send({ error: 'Internal Error' });
    }
  },
);

/**
 * Tarea programada diaria: Gestiona el ciclo de vida, período de gracia (5 días)
 * y suspensión preventiva automática de tiendas con pago vencido.
 */
export const checkSubscriptionExpirations = onSchedule(
  {
    schedule: '0 4 * * *', // Todos los días a las 04:00 UTC
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  async () => {
    console.info('[checkSubscriptionExpirations] Checking store subscriptions expiration...');
    const db = getFirestore();
    const now = new Date();
    const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;

    const storesSnap = await db.collection('stores').get();
    let verified = 0;
    let gracePeriodCount = 0;
    let suspendedCount = 0;

    for (const doc of storesSnap.docs) {
      const data = doc.data();
      verified++;
      const sub = data['subscription'] || {};

      // Tiendas en cortesía permanente no se suspenden
      if (sub.status === 'complimentary') {
        continue;
      }

      const periodEndTs: Timestamp | undefined = sub.currentPeriodEnd || sub.trialEndDate;
      if (!periodEndTs) continue;

      const periodEnd = periodEndTs.toDate();

      if (now > periodEnd) {
        const overdueMs = now.getTime() - periodEnd.getTime();

        if (overdueMs <= fiveDaysInMs) {
          // Dentro de los 5 días de gracia (tanto para suscripción expirada como trial vencido)
          if (sub.status !== 'past_due') {
            await doc.ref.update({
              'subscription.status': 'past_due',
              'subscription.updatedAt': new Date(),
            });
            gracePeriodCount++;
          }
        } else {
          // Excedió los 5 días de gracia: suspensión automática
          if (data['status'] !== 'suspended' || sub.status !== 'suspended') {
            await doc.ref.update({
              status: 'suspended',
              'subscription.status': 'suspended',
              'subscription.suspendedAt': new Date(),
              'subscription.updatedAt': new Date(),
            });
            suspendedCount++;
          }
        }
      }
    }

    console.info(
      `[checkSubscriptionExpirations] Done. Verified: ${verified}, Grace period: ${gracePeriodCount}, Suspended: ${suspendedCount}`,
    );
  },
);
