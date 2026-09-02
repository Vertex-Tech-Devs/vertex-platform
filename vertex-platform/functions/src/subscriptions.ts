import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ALLOWED_ORIGINS, PLATFORM_PROJECT, sendDirectEmail } from './helpers';
import { checkRateLimit, logAuditAction } from './stores';

// ============================================================================
// 1. DEFINICIÓN DE PLANES SAAS Y MODELO DE DATOS
// ============================================================================

export interface SubscriptionPlan {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  description: string;
  monthlyPrice: number; // en ARS
  annualPrice: number; // en ARS (incluye descuento de ~2 meses gratis)
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter / Emprendedor',
    description: 'Ideal para negocios iniciales con catálogo estándar.',
    monthlyPrice: 15000,
    annualPrice: 150000,
    features: ['Hasta 100 productos', '1 sucursal de retiro', 'Subdominio .web.app', 'Soporte estándar'],
  },
  pro: {
    id: 'pro',
    name: 'Pro / Crecimiento',
    description: 'Para marcas y comercios en expansión con alto volumen.',
    monthlyPrice: 29000,
    annualPrice: 290000,
    features: [
      'Catálogo y productos ilimitados',
      'Hasta 5 sucursales',
      'Dominio personalizado',
      'Notificaciones email automáticas',
      'Soporte prioritario',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise / Escala',
    description: 'Infraestructura dedicada GCP con máximo rendimiento.',
    monthlyPrice: 59000,
    annualPrice: 590000,
    features: [
      'Shard dedicado en Google Cloud',
      'Sucursales ilimitadas',
      'SLA de 99.9%',
      'Account Manager dedicado',
    ],
  },
};

export interface StoreSubscriptionDoc {
  id: string;
  storeId: string;
  storeName: string;
  ownerEmail: string;
  planId: 'starter' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'annual';
  amount: number;
  currency: 'ARS';
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | 'past_due' | 'complimentary';
  mpPreapprovalId?: string;
  mpPreferenceId?: string;
  mpPayerId?: string;
  initPoint?: string;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  nextBillingDate?: Timestamp;
  gracePeriodEnd?: Timestamp;
  history: Array<{
    date: Timestamp;
    event: string;
    amount?: number;
    paymentId?: string;
    status: string;
    notes?: string;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// 2. RESOLUCIÓN DE CREDENCIALES DE MERCADO PAGO CENTRAL DE LA PLATAFORMA
// ============================================================================

const secretsClient = new SecretManagerServiceClient();
let cachedPlatformMpToken = '';

async function resolvePlatformMpAccessToken(): Promise<string> {
  if (cachedPlatformMpToken) return cachedPlatformMpToken;

  const candidateSecrets = [
    'mp-platform-access-token',
    'MP_PLATFORM_ACCESS_TOKEN',
    'mp-access-token-default',
  ];

  for (const secretName of candidateSecrets) {
    try {
      const [version] = await secretsClient.accessSecretVersion({
        name: `projects/${PLATFORM_PROJECT}/secrets/${secretName}/versions/latest`,
      });
      const token = version.payload?.data?.toString().trim();
      if (token && (token.startsWith('TEST-') || token.startsWith('APP_USR-'))) {
        cachedPlatformMpToken = token;
        return token;
      }
    } catch {
      // Intenta siguiente secreto
    }
  }

  // Fallback a variable de entorno o token de prueba de la plataforma
  const envToken =
    process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESSTOKEN ||
    'TEST-5735100067673516-090122-383792037bb2eb85f3baef5369c3a9d9-1793264666';

  cachedPlatformMpToken = envToken.trim();
  return cachedPlatformMpToken;
}

// ============================================================================
// 3. GENERACIÓN DE LINKS DE PAGO / SUSCRIPCIÓN (CALLABLE)
// ============================================================================

export interface CreateSubscriptionPayload {
  storeId: string;
  planId: 'starter' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'annual';
  payerEmail?: string;
  payerName?: string;
}

export const createStoreSubscriptionLink = onCall<CreateSubscriptionPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión para contratar un plan.');
    }

    const { storeId, planId, billingCycle, payerEmail, payerName } = request.data;
    if (!storeId || !planId || !billingCycle) {
      throw new HttpsError('invalid-argument', 'storeId, planId y billingCycle son requeridos.');
    }

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      throw new HttpsError('not-found', `El plan ${planId} no existe.`);
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      throw new HttpsError('not-found', `La tienda ${storeId} no fue encontrada.`);
    }

    const storeData = storeSnap.data()!;
    const isPlatformAdmin = Boolean(request.auth.token['platformAdmin']);
    const isOwner = storeData['ownerEmail'] === request.auth.token.email;

    if (!isPlatformAdmin && !isOwner) {
      throw new HttpsError('permission-denied', 'No tienes permisos para facturar esta tienda.');
    }

    await checkRateLimit(request.auth.uid, 'createSubscriptionLink', 10, 15);

    const accessToken = await resolvePlatformMpAccessToken();
    const amount = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
    const finalPayerEmail = (payerEmail || request.auth.token.email || storeData['ownerEmail'] || '').trim();
    const subscriptionId = `sub_${storeId}_${Date.now()}`;
    const platformBaseUrl = 'https://vertex-platform.web.app';

    let initPointUrl = '';
    let mpPreapprovalId: string | undefined;
    let mpPreferenceId: string | undefined;

    try {
      if (billingCycle === 'monthly') {
        // Débito automático recurrente vía Mercado Pago PreApproval REST API
        const preapprovalRes = await fetch('https://api.mercadopago.com/preapproval', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: `Suscripción Mensual Vertex - ${plan.name} (${storeData['name'] || storeId})`,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: amount,
              currency_id: 'ARS',
            },
            payer_email: finalPayerEmail,
            back_url: `${platformBaseUrl}/stores/${storeId}?subscription=success`,
            external_reference: subscriptionId,
            status: 'pending',
          }),
        });

        const preapprovalData = (await preapprovalRes.json()) as any;
        if (!preapprovalRes.ok) {
          throw new Error(preapprovalData?.message || `HTTP ${preapprovalRes.status}`);
        }

        initPointUrl =
          (accessToken.startsWith('TEST-')
            ? preapprovalData.sandbox_init_point
            : preapprovalData.init_point) ||
          preapprovalData.init_point ||
          preapprovalData.sandbox_init_point ||
          '';
        mpPreapprovalId = preapprovalData.id;
      } else {
        // Facturación anual (pago único adelantado por 12 meses) vía Mercado Pago Preference REST API
        const preferenceRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              {
                id: `plan_${plan.id}_annual`,
                title: `Plan Anual Vertex - ${plan.name} (${storeData['name'] || storeId})`,
                description: `Acceso por 12 meses con descuento a la plataforma Vertex Commerce para ${storeData['name'] || storeId}`,
                quantity: 1,
                unit_price: amount,
                currency_id: 'ARS',
              },
            ],
            payer: {
              email: finalPayerEmail,
              name: payerName || storeData['name'] || 'Cliente Vertex',
            },
            external_reference: subscriptionId,
            back_urls: {
              success: `${platformBaseUrl}/stores/${storeId}?subscription=success`,
              failure: `${platformBaseUrl}/stores/${storeId}?subscription=failure`,
              pending: `${platformBaseUrl}/stores/${storeId}?subscription=pending`,
            },
            auto_return: 'approved',
          }),
        });

        const preferenceData = (await preferenceRes.json()) as any;
        if (!preferenceRes.ok) {
          throw new Error(preferenceData?.message || `HTTP ${preferenceRes.status}`);
        }

        initPointUrl =
          (accessToken.startsWith('TEST-')
            ? preferenceData.sandbox_init_point
            : preferenceData.init_point) ||
          preferenceData.init_point ||
          preferenceData.sandbox_init_point ||
          '';
        mpPreferenceId = preferenceData.id;
      }

      if (!initPointUrl) {
        throw new Error('Mercado Pago no retornó una URL de pago válida.');
      }

      const now = Timestamp.now();
      const subDoc: StoreSubscriptionDoc = {
        id: subscriptionId,
        storeId,
        storeName: storeData['name'] || storeId,
        ownerEmail: finalPayerEmail,
        planId,
        billingCycle,
        amount,
        currency: 'ARS',
        status: 'pending',
        mpPreapprovalId,
        mpPreferenceId,
        initPoint: initPointUrl,
        history: [
          {
            date: now,
            event: 'created',
            amount,
            status: 'pending',
            notes: `Link de suscripción ${billingCycle} generado por ${request.auth.token.email}`,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      await db.collection('subscriptions').doc(subscriptionId).set(subDoc);
      await storeRef.update({
        'subscription.id': subscriptionId,
        'subscription.planId': planId,
        'subscription.billingCycle': billingCycle,
        'subscription.status': 'pending',
        'subscription.initPoint': initPointUrl,
        'subscription.updatedAt': new Date(),
      });

      logger.info(`[createStoreSubscriptionLink] Suscripción ${subscriptionId} creada para ${storeId}. URL: ${initPointUrl}`);

      return {
        subscriptionId,
        initPoint: initPointUrl,
        plan,
        amount,
      };
    } catch (err: any) {
      logger.error(`[createStoreSubscriptionLink] Error al generar suscripción para ${storeId}:`, err);
      throw new HttpsError('internal', `Error al conectar con Mercado Pago: ${err?.message || 'Error desconocido'}`);
    }
  },
);

// ============================================================================
// 4. CONSULTA Y GESTIÓN DE SUSCRIPCIONES (CALLABLE)
// ============================================================================

export const getStoreSubscription = onCall<{ storeId: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticación requerida.');
    }

    const { storeId } = request.data;
    if (!storeId) {
      throw new HttpsError('invalid-argument', 'storeId es requerido.');
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) {
      throw new HttpsError('not-found', 'Tienda no encontrada.');
    }

    const storeData = storeSnap.data()!;
    const isPlatformAdmin = Boolean(request.auth.token['platformAdmin']);
    const isOwner = storeData['ownerEmail'] === request.auth.token.email;

    if (!isPlatformAdmin && !isOwner) {
      throw new HttpsError('permission-denied', 'No tienes acceso a la facturación de esta tienda.');
    }

    const subSnap = await db
      .collection('subscriptions')
      .where('storeId', '==', storeId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const subscription = !subSnap.empty ? subSnap.docs[0].data() : null;

    return {
      storeId,
      subscription,
      availablePlans: SUBSCRIPTION_PLANS,
      storeStatus: storeData['status'] || 'active',
    };
  },
);

export const updateStoreSubscriptionStatus = onCall<{
  storeId: string;
  status: 'active' | 'complimentary' | 'paused' | 'cancelled';
  planId?: 'starter' | 'pro' | 'enterprise';
  notes?: string;
}>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Solo los administradores de la plataforma pueden modificar suscripciones manualmente.');
    }

    const { storeId, status, planId, notes } = request.data;
    if (!storeId || !status) {
      throw new HttpsError('invalid-argument', 'storeId y status son requeridos.');
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      throw new HttpsError('not-found', 'Tienda no encontrada.');
    }

    const updates: Record<string, any> = {
      'subscription.status': status,
      'subscription.updatedAt': new Date(),
    };

    if (planId) {
      updates['subscription.planId'] = planId;
    }

    if (status === 'complimentary' || status === 'active') {
      const oneYearAhead = new Date();
      oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
      updates['subscription.currentPeriodEnd'] = Timestamp.fromDate(oneYearAhead);
      updates['subscription.nextBillingDate'] = Timestamp.fromDate(oneYearAhead);
      updates['status'] = 'active';
    }

    await logAuditAction(
      request.auth.uid,
      request.auth.token.email,
      'updateSubscriptionStatus',
      storeId,
      'success',
      {
        status,
        planId,
        notes,
      },
    );

    return { success: true, status, storeId };
  },
);

// ============================================================================
// 5. WEBHOOK CENTRAL DE PAGOS SAAS DE LA PLATAFORMA (HTTP ENDPOINT)
// ============================================================================

export const platformMercadoPagoWebhook = onRequest(
  { maxInstances: 5, cors: true, invoker: 'public' },
  async (request, response) => {
    const action = String(request.body?.action ?? request.query.topic ?? '');
    const dataId = String(request.body?.data?.id ?? request.query.id ?? '');
    const type = String(request.body?.type ?? '');

    logger.info(`[platformMercadoPagoWebhook] Evento recibido: action=${action}, type=${type}, id=${dataId}`);

    const db = getFirestore();
    const now = Timestamp.now();

    try {
      const accessToken = await resolvePlatformMpAccessToken();

      if (action.includes('preapproval') || type === 'subscription_preapproval') {
        const preapprovalRes = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const preapproval = (await preapprovalRes.json()) as any;
        const externalRef = preapproval?.external_reference;

        if (externalRef) {
          const subRef = db.collection('subscriptions').doc(externalRef);
          const subSnap = await subRef.get();

          if (subSnap.exists) {
            const subData = subSnap.data() as StoreSubscriptionDoc;
            const newStatus = preapproval.status === 'authorized' ? 'authorized' : 'pending';
            const nextPaymentDate = preapproval.next_payment_date
              ? Timestamp.fromDate(new Date(preapproval.next_payment_date))
              : Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

            await subRef.update({
              status: newStatus,
              mpPreapprovalId: preapproval.id,
              mpPayerId: preapproval.payer_id ? String(preapproval.payer_id) : undefined,
              currentPeriodStart: now,
              currentPeriodEnd: nextPaymentDate,
              nextBillingDate: nextPaymentDate,
              updatedAt: now,
              history: FieldValue.arrayUnion({
                date: now,
                event: `preapproval_${preapproval.status}`,
                status: newStatus,
                notes: `Mercado Pago Preapproval actualizado a ${preapproval.status}`,
              }),
            });

            await db.collection('stores').doc(subData.storeId).update({
              'subscription.status': newStatus === 'authorized' ? 'active' : newStatus,
              'subscription.nextBillingDate': nextPaymentDate.toDate(),
              'subscription.updatedAt': new Date(),
              status: newStatus === 'authorized' ? 'active' : 'pending',
            });

            logger.info(`[platformMercadoPagoWebhook] Suscripción ${externalRef} de ${subData.storeId} actualizada a ${newStatus}`);
          }
        }
      }
    } catch (err) {
      logger.error('[platformMercadoPagoWebhook] Error al procesar webhook de suscripción:', err);
    }

    response.status(200).send({ received: true });
  },
);

// ============================================================================
// 6. TAREA PROGRAMADA: MONITOREO DE PERÍODOS DE GRACIA Y EXPIRACIONES
// ============================================================================

export const checkSubscriptionExpirations = onSchedule(
  { schedule: 'every day 04:00', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    logger.info('[checkSubscriptionExpirations] Iniciando verificación diaria de suscripciones...');
    const db = getFirestore();
    const now = new Date();

    const expiredSnap = await db
      .collection('stores')
      .where('subscription.status', '==', 'past_due')
      .where('subscription.gracePeriodEnd', '<=', now)
      .get();

    for (const doc of expiredSnap.docs) {
      const storeId = doc.id;
      const storeData = doc.data();

      await doc.ref.update({
        'subscription.status': 'suspended',
        status: 'suspended',
        updatedAt: new Date(),
      });

      if (storeData['ownerEmail']) {
        const subject = `⚠️ Suspensión de Servicio: Tu tienda ${storeData['name'] || storeId} requiere regularización`;
        const text = `Hola,\n\nTu período de gracia para la suscripción de ${storeData['name'] || storeId} ha finalizado sin recibir el pago. Tu tienda se encuentra temporalmente en pausa.\n\nPor favor, ingresa a tu panel para regularizar tu suscripción: https://vertex-platform.web.app/stores/${storeId}`;
        const html = `<div style="font-family: sans-serif; padding: 20px;"><h2>⚠️ Suspensión de Servicio</h2><p>El período de gracia para <strong>${storeData['name'] || storeId}</strong> ha vencido sin recibir el cobro de tu plan.</p><p><a href="https://vertex-platform.web.app/stores/${storeId}" style="background: #6366f1; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Regularizar Suscripción</a></p></div>`;

        void sendDirectEmail(storeData['ownerEmail'], subject, html, text);
      }

      logger.warn(`[checkSubscriptionExpirations] Tienda ${storeId} suspendida por falta de pago.`);
    }
  },
);
