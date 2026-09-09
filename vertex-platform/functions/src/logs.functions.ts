import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import {
  consolidateAndSortLogs,
  mapAuditToLog,
  mapOrderToLog,
  resolveDateRange,
  type LogEntry,
} from './logs.helpers';

export type LogSeverity = 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface StoreLogEntry {
  id?: string;
  timestamp: string;
  severity: LogSeverity | string;
  function?: string;
  message: string;
  raw?: string;
  project?: string;
  source?: 'orders' | 'system' | 'cloud' | string;
}

export interface GetStoreLogsResponse {
  success: boolean;
  project: string;
  entries: StoreLogEntry[];
  logs?: LogEntry[];
  truncated: boolean;
}

const STOREFRONT_PROD = 'ecommerce-vertex';
const STOREFRONT_DEV = 'ecommerce-vertex-dev';
const PLATFORM_PROJECT = 'vertex-platform-app';

/** Normaliza severidad cruda a la unión usada en el monitor. */
function normalizeSeverity(sev?: string): LogEntry['severity'] {
  const level = (sev || 'INFO').toUpperCase();
  if (level === 'ERROR' || level === 'CRITICAL' || level === 'ALERT' || level === 'EMERGENCY') {
    return 'ERROR';
  }
  if (level === 'WARNING' || level === 'WARN') {
    return 'WARN';
  }
  return 'INFO';
}

/**
 * getStoreLogs — Monitor híbrido por tienda.
 * Garantiza visibilidad de compras y auditoría (Firestore) incluso si Cloud Logging
 * falla por permisos/cuotas (try/catch defensivo). Fusiona, deduplica y ordena.
 */
export const getStoreLogs = onCall<{
  storeId: string;
  severity?: string;
  query?: string;
  sinceMinutes?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}>({ timeoutSeconds: 60, cors: true, invoker: 'public' }, async (request) => {
  if (!request.auth?.token?.['platformAdmin']) {
    throw new HttpsError('permission-denied', 'Only platform admins can read store logs.');
  }
  const {
    storeId,
    severity,
    query,
    sinceMinutes = 2880,
    startDate,
    endDate,
    limit = 100,
  } = request.data;
  if (!storeId || !/^[a-zA-Z0-9_-]{1,120}$/.test(storeId)) {
    throw new HttpsError('invalid-argument', 'Invalid storeId.');
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const range = resolveDateRange(sinceMinutes, startDate, endDate);
  const lowerMs = range.isAll ? 0 : (range.fromDate?.getTime() ?? 0);
  const upperMs = range.toDate?.getTime() ?? Number.POSITIVE_INFINITY;

  const withinRange = (entry: LogEntry): boolean => {
    const t = Date.parse(entry.timestamp);
    if (Number.isNaN(t)) return true;
    if (lowerMs > 0 && t < lowerMs) return false;
    if (Number.isFinite(upperMs) && t > upperMs) return false;
    return true;
  };

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

  // A) Órdenes reales de Firestore (garantía de visibilidad de compras).
  const fetchOrderLogs = async (): Promise<LogEntry[]> => {
    const out: LogEntry[] = [];
    const candidates: Array<() => Promise<LogEntry[]>> = [
      async () => {
        const snap = await db
          .collection('stores')
          .doc(storeId)
          .collection('orders')
          .orderBy('createdAt', 'desc')
          .limit(500)
          .get();
        return snap.docs.map((d) => mapOrderToLog(d.id, d.data() as Record<string, unknown>));
      },
      async () => {
        const snap = await db
          .collection('orders')
          .where('storeId', '==', storeId)
          .orderBy('createdAt', 'desc')
          .limit(500)
          .get();
        return snap.docs.map((d) => mapOrderToLog(d.id, d.data() as Record<string, unknown>));
      },
    ];
    for (const candidate of candidates) {
      try {
        const entries = await candidate();
        if (entries.length > 0) {
          out.push(...entries);
          break;
        }
      } catch {
        // Probamos el siguiente candidato (colección raíz o inexistente).
      }
    }
    return out.filter(withinRange);
  };

  // B) Auditoría de Firestore (eventos de plataforma).
  const fetchAuditLogs = async (): Promise<LogEntry[]> => {
    const out: LogEntry[] = [];
    const queries = [
      db.collection('audit_logs').where('storeId', '==', storeId).limit(500),
      db.collection('audit_logs').where('targetId', '==', storeId).limit(500),
    ];
    for (const q of queries) {
      try {
        const snap = await q.get();
        for (const d of snap.docs) {
          out.push(mapAuditToLog(d.id, d.data() as Record<string, unknown>));
        }
      } catch {
        // Sin índice o colección inexistente: seguir.
      }
    }
    return out.filter(withinRange);
  };

  // C) Cloud Logging técnico (defensivo: no debe romper los eventos de Firestore).
  const fetchCloudLogs = async (): Promise<LogEntry[]> => {
    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/logging.read'],
      });
      const client = await auth.getClient();
      const lowerClause = range.isAll
        ? ''
        : ` AND timestamp >= "${new Date(lowerMs).toISOString()}"`;
      const upperClause = Number.isFinite(upperMs)
        ? ` AND timestamp <= "${new Date(upperMs).toISOString()}"`
        : '';
      const base = `resource.type=("cloud_run_revision" OR "cloud_function") AND ("${storeId}" OR "${slug}")`;
      const cleanQuery = query ? String(query).trim().replace(/["\\]/g, '') : '';
      const queryClause = cleanQuery
        ? ` AND (textPayload:"${cleanQuery}" OR jsonPayload.message:"${cleanQuery}")`
        : '';
      const sevClause =
        severity && severity.toUpperCase() !== 'ALL'
          ? ` AND severity >= ${severity.toUpperCase() === 'WARNING' ? '400' : severity.toUpperCase() === 'ERROR' ? '500' : '200'}`
          : '';
      const filter = `${base}${lowerClause}${upperClause}${sevClause}${queryClause}`;

      type RawEntry = {
        timestamp?: string;
        severity?: string;
        resource?: { labels?: Record<string, string> };
        textPayload?: string;
        jsonPayload?: Record<string, unknown>;
      };
      const queryProject = async (proj: string): Promise<LogEntry[]> => {
        const resp = await (client as { request<T>(o: unknown): Promise<{ data: T }> }).request<{
          entries?: RawEntry[];
        }>({
          url: 'https://logging.googleapis.com/v2/entries:list',
          method: 'POST',
          data: {
            resourceNames: [`projects/${proj}`],
            filter,
            orderBy: 'timestamp desc',
            pageSize: safeLimit,
          },
        });
        return (resp.data.entries || []).map((e) => {
          const jp = e.jsonPayload as Record<string, unknown> | undefined;
          const message =
            String(e.textPayload ?? '') ||
            String(jp?.['message'] ?? jp?.['msg'] ?? jp?.['error'] ?? jp?.['text'] ?? '');
          return {
            id: `${e.resource?.labels?.['function_name'] || 'fn'}|${e.timestamp || ''}|${message.slice(0, 40)}`,
            timestamp: e.timestamp || new Date().toISOString(),
            severity: normalizeSeverity(e.severity),
            message,
            source: 'cloud' as const,
            metadata: {
              project: proj,
              function: e.resource?.labels?.['function_name'],
              raw: jp ? JSON.stringify(jp) : undefined,
            },
          };
        });
      };

      const projectsToQuery =
        (project as string) !== PLATFORM_PROJECT ? [project, PLATFORM_PROJECT] : [project];
      const results = await Promise.allSettled(projectsToQuery.map((p) => queryProject(p)));
      const out: LogEntry[] = [];
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          out.push(...res.value);
        } else {
          logger.warn(
            `[getStoreLogs] No se pudieron leer logs de ${projectsToQuery[idx]}:`,
            res.reason,
          );
        }
      });
      return out;
    } catch (err) {
      logger.warn(
        `[getStoreLogs] Cloud Logging falló para ${storeId} (seguimos con Firestore):`,
        err,
      );
      return [];
    }
  };

  const [orders, audit, cloud] = await Promise.all([
    fetchOrderLogs().catch(() => [] as LogEntry[]),
    fetchAuditLogs().catch(() => [] as LogEntry[]),
    fetchCloudLogs().catch(() => [] as LogEntry[]),
  ]);

  const logs = consolidateAndSortLogs([...orders, ...audit, ...cloud], safeLimit);
  const entries: StoreLogEntry[] = logs.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    severity: l.severity,
    message: l.message,
    source: l.source,
    project:
      l.source === 'orders'
        ? 'firestore-orders'
        : l.source === 'system'
          ? 'firestore-audit'
          : String(l.metadata?.['project'] || project),
  }));

  return {
    success: true,
    project: 'hybrid',
    entries,
    logs,
    truncated: logs.length >= safeLimit,
  };
});
