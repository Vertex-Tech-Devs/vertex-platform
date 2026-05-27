import { onRequest } from 'firebase-functions/v2/https';
import { ALLOWED_ORIGINS } from './helpers';

export const logClientError = onRequest(
  { cors: [...ALLOWED_ORIGINS, 'http://localhost:4200'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
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
