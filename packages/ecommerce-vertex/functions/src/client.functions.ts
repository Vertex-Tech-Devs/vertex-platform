import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { OrderSchema } from "./core/order.model";
import { COLLECTIONS, tenantCollection } from "./core/config";

const db = admin.firestore();

export const onOrderCreateUpdateClients = onDocumentCreated(`tenants/{tenantId}/${COLLECTIONS.ORDERS}/{orderId}`, async (event) => {
  const snap = event.data;
  const tenantId = event.params.tenantId;
  if (!snap) {
    logger.warn(`Evento de creación de orden sin datos. ID: ${event.params.orderId}`);
    return;
  }

  const validationResult = OrderSchema.safeParse(snap.data());
  if (!validationResult.success) {
    logger.error(`Datos de la orden ${event.params.orderId} son inválidos y no se procesará el cliente.`, {
      errors: validationResult.error.flatten(),
    });
    return;
  }
  
  const order = validationResult.data;
  const clientEmail = order.clientEmail;

  if (!clientEmail) {
    logger.warn(`La orden ${event.params.orderId} no tiene un email de cliente, no se puede actualizar la colección de clientes.`);
    return;
  }

  const clientRef = db.collection(tenantCollection(tenantId, COLLECTIONS.CLIENTS)).doc(clientEmail);

  try {
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);

      if (!clientDoc.exists) {
        transaction.set(clientRef, {
          email: clientEmail,
          fullName: order.clientName,
          phone: order.clientPhone,
          firstOrderDate: snap.createTime?.toDate() || new Date(),
          lastOrderDate: snap.createTime?.toDate() || new Date(),
          numberOfOrders: 1,
          totalSpent: order.total,
        });
        logger.info(`Nuevo cliente creado: ${clientEmail}`);
      } else {
        transaction.update(clientRef, {
          fullName: order.clientName,
          phone: order.clientPhone,
          lastOrderDate: snap.createTime?.toDate() || new Date(),
          numberOfOrders: FieldValue.increment(1),
          totalSpent: FieldValue.increment(order.total),
        });
        logger.info(`Cliente actualizado: ${clientEmail}`);
      }
    });
  } catch (error) {
    logger.error(`Error en la transacción al actualizar el cliente ${clientEmail}`, { error });
  }
});