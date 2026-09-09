import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { getOwnerOAuthClient, apiFetch } from './helpers';

export interface PurgeStoreDataParams {
  storeId: string;
  deleteClients?: boolean;
  deleteOrders?: boolean;
  deleteCatalog?: boolean;
  deleteContent?: boolean;
}

export interface PurgeStoreDataResult {
  success: boolean;
  shardProjectId: string;
  deleted: Record<string, number>;
  errors: string[];
}

/**
 * purgeStoreData — Limpieza super-admin de datos de una tienda (para entornos de prueba).
 * Guard: platformAdmin (Juan / Lihue / Vertex). Borra en el shard de la tienda:
 *  - clientes (clients/*)
 *  - pedidos (orders/*)
 *  - catálogo (products/* + variants) / categorías / atributos
 *  - contenido (banners, pages, attributes de display)
 * NUNCA borra configuración (configuracion/*, settings/*, store_payments/*) ni la tienda.
 */
export const purgeStoreData = onCall<PurgeStoreDataParams>(
  { timeoutSeconds: 540, memory: '512MiB', cors: true, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token?.['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform super admins can purge store data.');
    }
    const { storeId, deleteClients, deleteOrders, deleteCatalog, deleteContent } = request.data;
    if (!storeId || !/^[a-zA-Z0-9_-]{1,120}$/.test(storeId)) {
      throw new HttpsError('invalid-argument', 'Invalid storeId.');
    }
    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) {
      throw new HttpsError('not-found', 'Store not found.');
    }
    const store = storeSnap.data() as Record<string, string | undefined>;
    const tenantSlug = String(store['slug'] || storeId);
    const projectId = String(
      store['runtimeProjectId'] || store['firebaseProjectId'] || store['projectId'] || '',
    ).trim();
    if (!projectId) {
      throw new HttpsError('failed-precondition', 'La tienda no tiene proyecto (shard) asignado.');
    }

    const auth = await getOwnerOAuthClient();
    const root = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const deleted: Record<string, number> = {};
    const errors: string[] = [];

    type ListedDoc = {
      name: string;
      fields?: Record<string, { stringValue?: string }>;
    };
    // El shard puede alojar varias tiendas: NUNCA borrar sin filtrar por tenant.
    const belongsToTenant = (doc: ListedDoc): boolean => {
      const name = doc.name;
      if (name.includes(`/clients/${encodeURIComponent(tenantSlug)}_`)) return true;
      const storeIdField = doc.fields?.['storeId']?.stringValue;
      return storeIdField === tenantSlug;
    };
    const deleteDocsIn = async (col: string): Promise<void> => {
      let pageToken = '';
      let count = 0;
      for (let page = 0; page < 20; page++) {
        const url = `${root}/${col}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        let list: { documents?: ListedDoc[]; nextPageToken?: string };
        try {
          list = (await apiFetch(auth, url, { quotaProject: projectId })) as {
            documents?: ListedDoc[];
            nextPageToken?: string;
          };
        } catch (err) {
          errors.push(`${col}: ${err instanceof Error ? err.message.slice(0, 120) : 'list error'}`);
          break;
        }
        for (const d of list.documents || []) {
          if (!belongsToTenant(d)) continue;
          try {
            await apiFetch(auth, d.name, { method: 'DELETE', quotaProject: projectId });
            count += 1;
          } catch (err) {
            errors.push(
              `delete ${col}: ${err instanceof Error ? err.message.slice(0, 100) : 'err'}`,
            );
          }
        }
        if (!list.nextPageToken) break;
        pageToken = list.nextPageToken;
      }
      deleted[col] = (deleted[col] || 0) + count;
      logger.info(`[Purge] ${projectId}: ${col} → ${count} borrados.`);
    };

    const purgeProductsWithVariants = async (): Promise<void> => {
      const url = `${root}/products?pageSize=300`;
      let list: { documents?: ListedDoc[]; nextPageToken?: string };
      try {
        list = (await apiFetch(auth, url, { quotaProject: projectId })) as {
          documents?: ListedDoc[];
          nextPageToken?: string;
        };
      } catch (err) {
        errors.push(`products: ${err instanceof Error ? err.message.slice(0, 120) : 'list error'}`);
        return;
      }
      const docs = (list.documents || []).filter((d) => belongsToTenant(d as ListedDoc));
      let count = 0;
      for (const d of docs) {
        const productPath = d.name;
        // borrar subcolección variants
        const variantsUrl = `${productPath}/variants?pageSize=300`;
        try {
          const vList = (await apiFetch(auth, variantsUrl, { quotaProject: projectId })) as {
            documents?: Array<{ name: string }>;
          };
          for (const v of vList.documents || []) {
            await apiFetch(auth, v.name, { method: 'DELETE', quotaProject: projectId });
            count += 1;
          }
        } catch {
          /* variantes no presentes: ok */
        }
        try {
          await apiFetch(auth, productPath, { method: 'DELETE', quotaProject: projectId });
          count += 1;
        } catch (err) {
          errors.push(
            `delete product: ${err instanceof Error ? err.message.slice(0, 100) : 'err'}`,
          );
        }
      }
      deleted['products'] = (deleted['products'] || 0) + count;
      logger.info(`[Purge] ${projectId}: products → ${count} borrados.`);
    };

    try {
      if (deleteClients) await deleteDocsIn('clients');
      if (deleteOrders) await deleteDocsIn('orders');
      if (deleteCatalog) {
        await deleteDocsIn('categories');
        await deleteDocsIn('attributes');
        await purgeProductsWithVariants();
      }
      if (deleteContent) {
        await deleteDocsIn('banners');
        await deleteDocsIn('pages');
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message.slice(0, 200) : 'purge error');
    }

    logger.info(
      `[Purge] ${projectId} finalizado: ${JSON.stringify(deleted)} (errors ${errors.length})`,
    );
    return { success: errors.length === 0, shardProjectId: projectId, deleted, errors };
  },
);

export interface DeleteStoreDataItemParams {
  storeId: string;
  kind: 'client' | 'order';
  reference: string;
}

/**
 * deleteStoreDataItem — Borrado puntual (super admin): un cliente (por email) o un pedido
 * (por orderId) de UNA tienda. Valida pertenencia al tenant antes de borrar.
 */
export const deleteStoreDataItem = onCall<DeleteStoreDataItemParams>(
  { timeoutSeconds: 60, cors: true, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token?.['platformAdmin']) {
      throw new HttpsError(
        'permission-denied',
        'Only platform super admins can delete store items.',
      );
    }
    const { storeId, kind, reference } = request.data;
    if (!storeId || !reference || !kind || (kind !== 'client' && kind !== 'order')) {
      throw new HttpsError(
        'invalid-argument',
        'storeId, kind (client|order) y reference son requeridos.',
      );
    }

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found.');
    const store = storeSnap.data() as Record<string, string | undefined>;
    const projectId = String(
      store['runtimeProjectId'] || store['firebaseProjectId'] || store['projectId'] || '',
    ).trim();
    const slug = String(store['slug'] || storeId);
    if (!projectId) throw new HttpsError('failed-precondition', 'Tienda sin proyecto (shard).');

    const auth = await getOwnerOAuthClient();
    const root = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    const ref = String(reference).trim();
    const lowerEmail = ref.toLowerCase();
    let targetName: string | null = null;

    if (kind === 'client') {
      // Buscar por email (campo) para no depender del formato del doc id.
      const url = `${root}/clients?pageSize=300`;
      const list = (await apiFetch(auth, url, { quotaProject: projectId })) as {
        documents?: Array<{ name: string; fields?: Record<string, { stringValue?: string }> }>;
      };
      for (const d of list.documents || []) {
        const email = d.fields?.['email']?.stringValue || '';
        const sid = d.fields?.['storeId']?.stringValue || '';
        if (sid === slug && email.toLowerCase() === lowerEmail) {
          targetName = d.name;
          break;
        }
      }
    } else {
      // Pedido: validar pertenencia (storeId) antes de borrar.
      const orderUrl = `${root}/orders/${encodeURIComponent(ref)}`;
      try {
        const o = (await apiFetch(auth, orderUrl, { quotaProject: projectId })) as {
          fields?: Record<string, { stringValue?: string }>;
        };
        if (o.fields?.['storeId']?.stringValue === slug) {
          targetName = orderUrl;
        }
      } catch {
        targetName = null;
      }
    }

    if (!targetName) {
      return { success: false, message: `No se encontró ${kind} '${ref}' en la tienda ${slug}.` };
    }

    await apiFetch(auth, targetName, { method: 'DELETE', quotaProject: projectId });
    logger.info(`[PurgeItem] ${projectId}: ${kind} '${ref}' eliminado (${slug}).`);
    return {
      success: true,
      message: `${kind === 'client' ? 'Cliente' : 'Pedido'} '${ref}' eliminado.`,
    };
  },
);
