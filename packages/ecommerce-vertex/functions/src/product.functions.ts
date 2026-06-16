import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { ProductVariantSchema } from "./core/product.model";
import { COLLECTIONS, tenantCollection } from "./core/config";

const db = admin.firestore();

export const onVariantStockChange = onDocumentWritten(
  "tenants/{tenantId}/products/{productId}/variants/{variantId}",
  async (event) => {
    const productId = event.params.productId;
    const tenantId = event.params.tenantId;
    if (!productId) {
      logger.error("No se encontró productId en los parámetros.");
      return;
    }

    const productRef = db.collection(tenantCollection(tenantId, COLLECTIONS.PRODUCTS)).doc(productId);

    try {
      const variantsSnapshot = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.PRODUCTS))
        .doc(productId)
        .collection("variants")
        .get();

      let totalStock = 0;
      const inStockAttributes: { [key: string]: string[] } = {};

      variantsSnapshot.docs.forEach((doc) => {
        const variantResult = ProductVariantSchema.safeParse(doc.data());
        
        if (!variantResult.success) {
          logger.warn(`Datos de variante ${doc.id} inválidos.`, { errors: variantResult.error.flatten() });
          return;
        }
        
        const variant = variantResult.data;

        totalStock += variant.stock;

        if (variant.stock > 0) {
          Object.entries(variant.attributes).forEach(([key, value]) => {
            if (!inStockAttributes[key]) {
              inStockAttributes[key] = [];
            }
            if (!inStockAttributes[key].includes(value)) {
              inStockAttributes[key].push(value);
            }
          });
        }
      });

      await productRef.update({
        totalStock: totalStock,
        inStockAttributes: inStockAttributes,
      });

      logger.info(`Stock desnormalizado actualizado para Producto ID: ${productId}. Total: ${totalStock}`);
    
    } catch (error) {
      logger.error(`Error al actualizar stock desnormalizado para ${productId}:`, error);
    }
  }
);