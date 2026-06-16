import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { defineString } from "firebase-functions/params";
import type { PaymentRequestData } from "./payment.model";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const siteUrl = defineString("SITE_URL");
const webhookUrl = defineString("MERCADOPAGO_WEBHOOK_URL");
const secretsClient = new SecretManagerServiceClient();

function resolveProjectId(): string {
  return process.env["GCLOUD_PROJECT"] || process.env["GOOGLE_CLOUD_PROJECT"] || "";
}

async function resolveAccessTokenFromSecret(secretName: string): Promise<string> {
  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error("No se pudo resolver el proyecto para leer Secret Manager.");
  }

  const [version] = await secretsClient.accessSecretVersion({
    name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
  });
  return version.payload?.data?.toString().trim() || "";
}

async function getMercadoPagoRuntimeConfig(): Promise<{ accessToken: string; webhook: string }> {
  const db = getFirestore();
  const configSnap = await db.collection("settings").doc("storeConfig").get();
  const data = configSnap.exists ? configSnap.data() as Record<string, any> : null;
  const mpConfig = data?.["payments"]?.["mercadoPago"] as Record<string, any> | undefined;

  const secretName = String(mpConfig?.["accessTokenSecret"] || "").trim();
  const tokenFromSecret = secretName ? await resolveAccessTokenFromSecret(secretName) : "";
  const accessToken = (tokenFromSecret || mpConfig?.["accessToken"] || "").trim();
  const webhook = (mpConfig?.["webhookUrl"] || webhookUrl.value() || "").trim();

  if (!accessToken) {
    throw new Error("Mercado Pago no está configurado: falta access token.");
  }

  return { accessToken, webhook };
}

export async function createPreference(data: PaymentRequestData) {
  const { items, external_reference } = data;

  const runtime = await getMercadoPagoRuntimeConfig();

  const mpClient = new MercadoPagoConfig({ accessToken: runtime.accessToken });
  const preferenceClient = new Preference(mpClient);

  const preferenceBody = {
    items: items.map(item => ({
      id: item.variantId,
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      currency_id: "ARS",
    })),
    external_reference,
    back_urls: {
      success: `${siteUrl.value()}/shop/order-confirmation/${external_reference}`,
      failure: `${siteUrl.value()}/shop/cart`,
      pending: `${siteUrl.value()}/shop/cart`,
    },
    auto_return: "approved" as const,
    notification_url: runtime.webhook,
  };

  const preference = await preferenceClient.create({ body: preferenceBody });

  return {
    id: preference.id,
    init_point: preference.init_point,
    date_of_expiration: preference.date_of_expiration,
  };
}

export async function getPaymentDetails(paymentId: string) {
  logger.info(`Obteniendo detalles del pago: ${paymentId}`);
  const runtime = await getMercadoPagoRuntimeConfig();
  const mpClient = new MercadoPagoConfig({ accessToken: runtime.accessToken });
  const paymentClient = new Payment(mpClient);

  try {
    const payment = await paymentClient.get({ id: paymentId });
    if (!payment) {
      throw new Error("Pago no encontrado en Mercado Pago.");
    }
    return payment;
  } catch (error) {
    logger.error(`Error al obtener detalles del pago ${paymentId} desde Mercado Pago:`, error);
    throw error;
  }
}