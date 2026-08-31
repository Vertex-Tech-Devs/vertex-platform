import type { OAuth2Client } from 'google-auth-library';
import * as logger from 'firebase-functions/logger';
import { apiFetch } from '../helpers';

export function toFirestoreValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (
    val instanceof Date ||
    (typeof val === 'object' &&
      val &&
      'toISOString' in val &&
      typeof (val as { toISOString: () => string }).toISOString === 'function')
  ) {
    return { timestampValue: (val as Date).toISOString() };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj: Record<string, unknown>): {
  fields: Record<string, unknown>;
} {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

export async function checkStoreSafety(
  auth: OAuth2Client,
  projectId: string,
  storeId: string,
): Promise<void> {
  logger.info(
    `[SeedEngine] Safety validation: Checking products and orders in project "${projectId}" store "${storeId}"...`,
  );
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const runQuery = async (collectionId: string): Promise<boolean> => {
    try {
      const res = (await apiFetch(auth, `${base}:runQuery`, {
        method: 'POST',
        body: {
          structuredQuery: {
            from: [{ collectionId }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'storeId' },
                op: 'EQUAL',
                value: { stringValue: storeId },
              },
            },
            limit: 1,
          },
        },
      })) as Array<{ document?: unknown }>;
      return (res ?? []).some((r) => r && r.document);
    } catch (err: any) {
      const isNotFound =
        err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
      if (!isNotFound) throw err;
      return false;
    }
  };

  const hasProducts = await runQuery('products');
  const hasOrders = await runQuery('orders');

  if (hasProducts || hasOrders) {
    throw new Error(
      'La tienda ya contiene productos o pedidos activos. Se canceló la regeneración para proteger la base de datos de producción.',
    );
  }
}

export async function clearCollection(
  auth: OAuth2Client,
  projectId: string,
  collectionName: string,
  storeId: string,
): Promise<void> {
  try {
    const res = (await apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`,
      { method: 'GET' },
    )) as { documents?: Array<{ name: string }> };

    if (res && res.documents && res.documents.length > 0) {
      for (const doc of res.documents) {
        const docPath = doc.name.split('/documents/')[1];
        const docId = docPath.split('/').pop() ?? '';
        if (!docId.startsWith(`${storeId}-`) && !docId.startsWith(`${storeId}_`)) continue;

        if (collectionName === 'products') {
          await clearCollection(auth, projectId, `${docPath}/variants`, storeId);
        }

        await apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`,
          { method: 'DELETE' },
        );
      }
    }
  } catch (err: any) {
    const isNotFound =
      err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
    if (!isNotFound) {
      console.warn(`[SeedEngine] Error clearing collection ${collectionName}:`, err);
    }
  }
}

export async function deleteDocumentPath(
  auth: OAuth2Client,
  projectId: string,
  docPath: string,
): Promise<void> {
  try {
    await apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`,
      { method: 'DELETE' },
    );
  } catch (err: any) {
    const isNotFound =
      err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
    if (!isNotFound) {
      console.warn(`[SeedEngine] Error deleting document ${docPath}:`, err);
    }
  }
}
