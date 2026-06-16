import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { z } from "zod";
import { COLLECTIONS, DOCS } from "./core/config";
import { defineString } from "firebase-functions/params";

const db = admin.firestore();
const siteUrl = defineString("SITE_URL", { default: "http://localhost:4200" });

const EmailTemplateSchema = z.object({
  subject: z.string(),
  template: z.string(),
  showManageButton: z.boolean().optional(),
  showWhatsappButton: z.boolean().optional(),
});

const AdvancedTestEmailPayloadSchema = z.object({
  recipientEmail: z.string().email("El email del destinatario no es válido."),
  testData: z.object({
    orderId: z.string(),
    clientName: z.string(),
    clientEmail: z.string().email(),
    clientPhone: z.string(),
    totalAmount: z.string(),
  }),
  templates: z.object({
    adminNotification: EmailTemplateSchema.optional(),
    customerConfirmation: EmailTemplateSchema.optional(),
  }),
});


function buildTestEmailHtml(template: string, testData: { [key: string]: string }, options: { manageButtonUrl?: string | null, whatsappUrl?: string | null } = {}) {
  const itemsHtml = `<li>Producto de Prueba 1 (x2) - $50.00</li><li>Producto de Prueba 2 (x1) - $75.50</li>`;
  let emailBody = template
    .replace(/{orderId}/g, testData.orderId)
    .replace(/{clientName}/g, testData.clientName)
    .replace(/{clientEmail}/g, testData.clientEmail)
    .replace(/{clientPhone}/g, testData.clientPhone)
    .replace(/{itemsList}/g, `<ul>${itemsHtml}</ul>`)
    .replace(/{totalAmount}/g, testData.totalAmount);

  const buttonStyle = `style="display: inline-block; padding: 12px 24px; margin: 10px 10px 10px 0; font-size: 16px; color: #ffffff; background-color: #007bff; border-radius: 5px; text-decoration: none;"`;
  let buttonsHtml = '<div style="margin-top: 30px;">';

  if (options.manageButtonUrl) {
    buttonsHtml += `<a href="${options.manageButtonUrl}" ${buttonStyle}>Gestionar Pedido</a>`;
  }
  if (options.whatsappUrl) {
    buttonsHtml += `<a href="${options.whatsappUrl}" ${buttonStyle}>Contactar por WhatsApp</a>`;
  }
  buttonsHtml += '</div>';

  return emailBody + buttonsHtml;
}


export const sendAdvancedTestEmail = onCall({ cors: true, invoker: 'public' }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    logger.error(
      "Unauthorized attempt to call 'sendAdvancedTestEmail'",
      { uid: request.auth?.uid }
    );
    throw new HttpsError(
      "unauthenticated",
      "This function can only be called by an authenticated admin."
    );
  }

  logger.info("Iniciando envío de email de prueba avanzado...", { data: request.data });

  const validationResult = AdvancedTestEmailPayloadSchema.safeParse(request.data);

  if (!validationResult.success) {
    logger.error("Payload inválido para sendAdvancedTestEmail", { errors: validationResult.error.flatten() });
    throw new HttpsError("invalid-argument", "Los datos proporcionados no son válidos.");
  }

  const { recipientEmail, testData, templates } = validationResult.data;
  const mailCreationPromises = [];

  try {
    const configDoc = await db.collection(COLLECTIONS.SETTINGS).doc(DOCS.EMAIL_TEMPLATES).get();
    const emailConfig = configDoc.data();

    // Build standard FROM address matching the platform's verified SMTP domain
    const storeName = emailConfig?.storeName || "Vertex Store";
    const projectId = process.env.GCLOUD_PROJECT || "vertex-platform-dev";
    const defaultFromDomain = projectId.includes("vertex-platform-app") ? "vertex-platform-app.web.app" : "vertex-platform-dev.firebaseapp.com";
    const defaultFromEmail = `no-reply@${defaultFromDomain}`;
    const fromAddress = `${storeName} <${defaultFromEmail}>`;

    if (templates.adminNotification) {
      const adminConfig = templates.adminNotification;
      const manageButtonUrl = adminConfig.showManageButton ? `${siteUrl.value()}/admin/orders/detail/${testData.orderId}` : null;
      const whatsappMessage = encodeURIComponent(`Hola ${testData.clientName}, te contacto sobre el pedido de prueba #${testData.orderId}.`);
      const whatsappUrl = adminConfig.showWhatsappButton ? `https://wa.me/${testData.clientPhone}?text=${whatsappMessage}` : null;
      const adminHtml = buildTestEmailHtml(adminConfig.template, testData, { manageButtonUrl, whatsappUrl });

      mailCreationPromises.push(db.collection(COLLECTIONS.MAIL).add({
        to: [recipientEmail],
        from: fromAddress,
        message: {
          subject: `[PRUEBA ADMIN] ${adminConfig.subject.replace(/{orderId}/g, testData.orderId)}`,
          html: adminHtml,
        },
      }));
    }

    if (templates.customerConfirmation) {
      const customerConfig = templates.customerConfirmation;
      const whatsappUrl = customerConfig.showWhatsappButton && emailConfig?.storeWhatsappNumber ? `https://wa.me/${emailConfig.storeWhatsappNumber}` : null;
      const customerHtml = buildTestEmailHtml(customerConfig.template, testData, { whatsappUrl });

      mailCreationPromises.push(db.collection(COLLECTIONS.MAIL).add({
        to: [recipientEmail],
        from: fromAddress,
        message: {
          subject: `[PRUEBA CLIENTE] ${customerConfig.subject.replace(/{orderId}/g, testData.orderId)}`,
          html: customerHtml,
        },
      }));
    }

    await Promise.all(mailCreationPromises);
    logger.info(`Emails de prueba para ${recipientEmail} encolados correctamente.`);
    return { success: true, message: `Emails de prueba encolados para ${recipientEmail}.` };

  } catch (error) {
    logger.error("Error al procesar y encolar emails de prueba:", error);
    throw new HttpsError("internal", "No se pudieron generar los emails de prueba.");
  }
});