import { onRequest } from 'firebase-functions/v2/https';
import { ALLOWED_ORIGINS } from './helpers';

// Rate limit simple en memoria (por instancia): máx. 100 reportes / 10 min por IP.
const MAX_REPORTS_PER_IP = 100;
const WINDOW_MS = 10 * 60 * 1000;
const ipReportCounts = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipReportCounts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipReportCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REPORTS_PER_IP;
}

export const logClientError = onRequest(
  { cors: [...ALLOWED_ORIGINS, 'http://localhost:4200'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Endpoint público de reporte de errores: limitado para evitar abuso/spam de logs.
    const ip = req.ip ?? 'unknown';
    if (isRateLimited(ip)) {
      res.status(429).send('Too Many Requests');
      return;
    }

    const { message, stack, url, userAgent, timestamp } = req.body as Record<string, string>;

    // Structured log format recognized by Cloud Error Reporting
    console.error(
      JSON.stringify({
        severity: 'ERROR',
        message: message ?? 'Unknown client error',
        stack: stack ?? '',
        sourceLocation: { url: url ?? '' },
        context: { userAgent: userAgent ?? '', reportLocation: { url: url ?? '' } },
        timestamp: timestamp ?? new Date().toISOString(),
        '@type':
          'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
      }),
    );

    res.status(204).send('');
  },
);
