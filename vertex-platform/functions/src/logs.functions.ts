import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';

export type LogSeverity = 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface StoreLogEntry {
  timestamp: string;
  severity: LogSeverity | string;
  function?: string;
  message: string;
  raw?: string;
}

export interface GetStoreLogsResponse {
  success: boolean;
  project: string;
  entries: StoreLogEntry[];
  truncated: boolean;
}

const STOREFRONT_PROD = 'ecommerce-vertex';
const STOREFRONT_DEV = 'ecommerce-vertex-dev';

function toSeverityLevel(sev?: string): number {
  const map: Record<string, number> = {
    DEFAULT: 0,
    DEBUG: 100,
    INFO: 200,
    NOTICE: 300,
    WARNING: 400,
    ERROR: 500,
    CRITICAL: 600,
    ALERT: 700,
    EMERGENCY: 800,
  };
  return map[(sev || 'INFO').toUpperCase()] ?? 200;
}

/**
 * getStoreLogs — Logs por tienda.
 * Consulta Cloud Logging del proyecto storefront (ecommerce-vertex / ecommerce-vertex-dev)
 * filtrando por el tenant/slug de la tienda, severidad y término libre.
 * Requiere que la identidad runtime de estas functions tenga `roles/logging.viewer`
 * sobre el proyecto consultado (se otorga en el despliegue).
 */
export const getStoreLogs = onCall<{
  storeId: string;
  severity?: string;
  query?: string;
  sinceMinutes?: number;
  limit?: number;
}>(
  { timeoutSeconds: 60, cors: true, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token?.['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can read store logs.');
    }
    const { storeId, severity, query, sinceMinutes = 1440, limit = 50 } = request.data;
    if (!storeId || !/^[a-zA-Z0-9_-]{1,120}$/.test(storeId)) {
      throw new HttpsError('invalid-argument', 'Invalid storeId.');
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safeSince = Math.min(Math.max(Number(sinceMinutes) || 1440, 5), 10080);

    const db = getFirestore();
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) {
      throw new HttpsError('not-found', 'Store not found.');
    }
    const store = storeSnap.data() as {
      slug?: string;
      firebaseProjectId?: string;
      environment?: string;
    };
    const slug = store.slug || storeId;
    const isDev = String(store.firebaseProjectId || store.environment || '').includes('-dev');
    const project = isDev ? STOREFRONT_DEV : STOREFRONT_PROD;

    const sinceIso = new Date(Date.now() - safeSince * 60_000).toISOString();

    // Free-text del tenant + opciones adicionales.
    const parts = [
      `timestamp >= "${sinceIso}"`,
      `(textPayload:"${slug}" OR textPayload:"${storeId}" OR jsonPayload.message:"${slug}")`,
    ];
    if (severity && severity.toUpperCase() !== 'ALL') {
      parts.push(`severity >= ${toSeverityLevel(severity)}`);
    }
    if (query && String(query).trim()) {
      const q = String(query).trim().replace(/["\\]/g, '');
      parts.push(`textPayload:"${q}"`);
    }

    const filter = parts.join(' AND ');

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/logging.read'],
      });
      const client = await auth.getClient();
      const resp = await (client as { request<T>(o: unknown): Promise<{ data: T }> }).request<{
        entries?: Array<{
          timestamp?: string;
          severity?: string;
          resource?: { labels?: Record<string, string> };
          textPayload?: string;
          jsonPayload?: Record<string, unknown>;
        }>;
      }>({
        url: 'https://logging.googleapis.com/v2/entries:list',
        method: 'POST',
        data: {
          resourceNames: [`projects/${project}`],
          filter,
          orderBy: 'timestamp desc',
          pageSize: safeLimit,
        },
      });

      const entries: StoreLogEntry[] = (resp.data.entries || []).map((e) => ({
        timestamp: e.timestamp || '',
        severity: e.severity || 'DEFAULT',
        function: e.resource?.labels?.['function_name'] || e.resource?.labels?.['service_name'],
        message: String(e.textPayload ?? ''),
        raw: e.jsonPayload ? JSON.stringify(e.jsonPayload) : undefined,
      }));

      return {
        success: true,
        project,
        entries,
        truncated: entries.length >= safeLimit,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[getStoreLogs] Error consultando logs de ${project} para ${slug}:`, err);
      if (/permission/i.test(msg)) {
        throw new HttpsError(
          'permission-denied',
          `La plataforma no tiene permisos de lectura de logs sobre ${project}. ` +
            'Otorgá roles/logging.viewer a la Service Account runtime (runbook en README).',
        );
      }
      throw new HttpsError('internal', `No se pudieron obtener los logs: ${msg.slice(0, 300)}`);
    }
  },
);
