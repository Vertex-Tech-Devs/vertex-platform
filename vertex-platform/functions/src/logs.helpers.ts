/**
 * Helpers puros para el monitor híbrido de logs.
 * Sin I/O: resolución de rangos, mapeo de órdenes/auditoría y consolidación.
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  source: 'orders' | 'system' | 'cloud';
  metadata?: Record<string, unknown>;
}

export interface DateRangeFilter {
  fromDate?: Date;
  toDate?: Date;
  isAll: boolean;
}

const DEFAULT_WINDOW_MIN = 2880; // 48 horas

function toDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate();
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? new Date(0) : new Date(parsed);
}

/** Resuelve la ventana temporal: "all", rango ISO o default 48 h. */
export function resolveDateRange(
  sinceMinutes?: number | string,
  startDate?: string,
  endDate?: string,
): DateRangeFilter {
  const hasStart = Boolean(startDate && !Number.isNaN(Date.parse(startDate as string)));
  const hasEnd = Boolean(endDate && !Number.isNaN(Date.parse(endDate as string)));
  const raw = sinceMinutes === undefined || sinceMinutes === null ? DEFAULT_WINDOW_MIN : sinceMinutes;
  const num = Number(raw);
  const isAll =
    raw === 0 ||
    raw === 'all' ||
    raw === '0' ||
    startDate === 'all' ||
    endDate === 'all';
  if (isAll) return { isAll: true };
  const fromDate = hasStart
    ? new Date(Date.parse(startDate as string))
    : new Date(Date.now() - (Number.isFinite(num) && num > 0 ? num : DEFAULT_WINDOW_MIN) * 60_000);
  const toDate = hasEnd ? new Date(Date.parse(endDate as string)) : undefined;
  return { fromDate, toDate, isAll: false };
}

/** Mapea una orden de Firestore a entrada de log (source: 'orders'). */
export function mapOrderToLog(docId: string, orderData: Record<string, unknown>): LogEntry {
  const rawTs = orderData['createdAt'] || orderData['updatedAt'] || new Date().toISOString();
  const timestamp = toDate(rawTs).toISOString();
  const status = String(orderData['status'] || 'recibido');
  const severity: LogEntry['severity'] =
    status === 'rejected' || status === 'cancelled' ? 'WARN' : 'INFO';
  const message = `Pedido #${
    orderData['orderNumber'] || String(docId).slice(0, 6)
  } - Total: $${orderData['total'] ?? 0} (${status})`;
  return { id: 'order_' + docId, timestamp, severity, message, source: 'orders' };
}

/** Mapea un evento de auditoría a entrada de log (source: 'system'). */
export function mapAuditToLog(docId: string, auditData: Record<string, unknown>): LogEntry {
  const severity =
    auditData['severity'] === 'ERROR' || auditData['severity'] === 'WARN'
      ? auditData['severity']
      : 'INFO';
  return {
    id: 'system_' + docId,
    timestamp: toDate(auditData['timestamp'] || auditData['createdAt']).toISOString(),
    severity,
    message: String(auditData['message'] || auditData['action'] || 'Evento de plataforma'),
    source: 'system',
  };
}

/** Deduplica por id (conserva la más detallada) y ordena desc por timestamp. Límite default 100. */
export function consolidateAndSortLogs(logs: LogEntry[], limit = 100): LogEntry[] {
  const byId = new Map<string, LogEntry>();
  for (const entry of logs) {
    if (!entry || !entry.id) continue;
    const existing = byId.get(entry.id);
    if (!existing || String(entry.message || '').length > String(existing.message || '').length) {
      byId.set(entry.id, entry);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    .slice(0, Math.max(1, limit));
}
