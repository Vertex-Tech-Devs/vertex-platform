import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import * as nodemailer from 'nodemailer';

interface AlertInput {
  key: string;
  severity: 'warning' | 'critical';
  kind: string;
  storeId?: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * watchdogPlatformAlerts — Red de seguridad del flujo de pagos/órdenes (Fase 5, lote 1).
 * Cada 60 minutos:
 *  1) Lee errores recientes de las functions de ecommerce (webhook/preferencias/notify)
 *     desde Cloud Logging (la SA runtime tiene logging.viewer otorgado).
 *  2) Detecta tiendas de la plataforma en estado de riesgo (error / provisioning colgado)
 *     y suscripciones past_due/suspended.
 *  3) Persiste alertas deduplicadas en Firestore `alerts/{key}` (open) con conteo y
 *     primera/última vez; el Centro de Alertas (UI) las consumirá.
 */


/** Envía correo institucional a los admins si hay credenciales SMTP (no bloqueante). */
async function sendAlertEmails(findings: AlertInput[]): Promise<void> {
  const criticals = findings.filter((f) => f.severity === 'critical');
  if (criticals.length === 0) return;
  const smtpUser = (process.env.SMTP_USER || 'vertex.tech.dev@gmail.com').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();
  const toList = (process.env.ALERT_EMAILS || 'vertex.tech.dev@gmail.com')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (!smtpPass || toList.length === 0) {
    logger.warn('[Alerts] SMTP no configurado; alerta crítica sin correo (sigue en Centro de Alertas).');
    return;
  }
  try {
    const rows = criticals
      .map(
        (a) =>
          `<li><strong>[${a.severity.toUpperCase()}]</strong> ${a.title} — ${a.message}` +
          (a.link ? ` <a href="${a.link}">Ver en Monitor</a>` : '') +
          '</li>',
      )
      .join('');
    const html = `<div style="font-family:Arial,sans-serif;background:#0f172a;padding:24px">
      <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:14px;padding:24px;border:1px solid #e2e8f0">
        <div style="color:#4f46e5;font-weight:800;font-size:20px;margin-bottom:12px">Vertex Platform — Alerta en producción</div>
        <p style="color:#0f172a">Se detectaron <strong>${criticals.length}</strong> alerta(s) crítica(s) en la última ronda del watchdog (60 min).</p>
        <ul style="color:#334155">${rows}</ul>
        <p style="font-size:12px;color:#64748b">Procesado de forma segura por Vertex Platform.</p>
      </div>
    </div>`;
    const transporter = nodemailer.createTransport({
      host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: `"Vertex Platform" <${smtpUser}>`,
      to: toList.join(', '),
      subject: `Vertex Platform: ${criticals.length} alerta(s) crítica(s) — ver Monitor`,
      html,
    });
    logger.info(`[Alerts] Correo crítico enviado a ${toList.join(', ')}.`);
  } catch (err) {
    logger.error('[Alerts] No se pudo enviar correo crítico:', err);
  }
}

export const watchdogPlatformAlerts = onSchedule('every 60 minutes', async () => {
  logger.info('[Alerts] Inicio de la ronda de vigilancia.');
  const db = getFirestore();

  const now = Date.now();
  const findings: AlertInput[] = [];

  // 1) Errores recientes en functions de ecommerce (flujo de pagos/órdenes).
  try {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] });
    const client = await auth.getClient();
    const since = new Date(now - 60 * 60 * 1000).toISOString();
    const filter =
      `logName:"cloudfunctions.googleapis.com%2Fcloudfunctions" AND severity >= ERROR AND ` +
      `timestamp >= "${since}" AND ` +
      `(resource.labels.function_name:"mercadoPagoWebhookHandler" OR ` +
      `resource.labels.function_name:"createPaymentPreference" OR ` +
      `resource.labels.function_name:"notifyOrderConfirmation")`;
    const resp = await (client as { request<T>(o: unknown): Promise<{ data: T }> }).request<{
      entries?: Array<{
        resource?: { labels?: Record<string, string> };
        severity?: string;
        timestamp?: string;
        textPayload?: string;
      }>;
    }>({
      url: 'https://logging.googleapis.com/v2/entries:list',
      method: 'POST',
      data: {
        resourceNames: ['projects/ecommerce-vertex'],
        filter,
        orderBy: 'timestamp desc',
        pageSize: 100,
      },
    });

    const byFn = new Map<string, number>();
    for (const e of resp.data.entries || []) {
      const fn =
        e.resource?.labels?.['function_name'] || e.resource?.labels?.['service_name'] || 'unknown';
      byFn.set(fn, (byFn.get(fn) || 0) + 1);
    }
    for (const [fn, count] of byFn) {
      findings.push({
        key: `ecommerce-errors:${fn}`,
        severity: count >= 5 ? 'critical' : 'warning',
        kind: 'payment_flow_error',
        title: `Errores en ${fn}`,
        message: `${count} error(es) registrado(s) en la última hora en el flujo de pagos/órdenes.`,
        link: `https://console.cloud.google.com/logs/query;query=${encodeURIComponent(
          `resource.labels.function_name="${fn}" AND severity >= ERROR`,
        )}?project=ecommerce-vertex`,
      });
    }
  } catch (err) {
    logger.warn('[Alerts] No se pudo leer logs de ecommerce-vertex:', err);
  }

  // 2) Riesgos desde datos propios de la plataforma.
  try {
    const risky = await db
      .collection('stores')
      .where('status', 'in', ['error', 'provisioning'])
      .limit(100)
      .get();
    for (const doc of risky.docs) {
      const d = doc.data() as { name?: string; status?: string; error?: string };
      findings.push({
        key: `store-status:${doc.id}`,
        severity: d.status === 'error' ? 'critical' : 'warning',
        kind: 'store_risk',
        storeId: doc.id,
        title: `Tienda ${d.name || doc.id} en estado ${d.status}`,
        message: d.error || `La tienda quedó en ${d.status}; revisá provisioning/monitor.`,
      });
    }
  } catch (err) {
    logger.warn('[Alerts] No se pudo evaluar tiendas en riesgo:', err);
  }

  // 3) Persistir alertas deduplicadas.
  let created = 0;
  let updated = 0;
  for (const a of findings) {
    const ref = db.collection('alerts').doc(a.key);
    const existing = await ref.get();
    if (!existing.exists) {
      await ref.set({
        ...a,
        status: 'open',
        firstSeen: Timestamp.fromMillis(now),
        lastSeen: Timestamp.fromMillis(now),
        count: 1,
        resolvedAt: null,
      });
      created += 1;
    } else {
      await ref.update({
        status: 'open',
        lastSeen: Timestamp.fromMillis(now),
        resolvedAt: null,
        count: FieldValue.increment(1),
        severity: a.severity,
        message: a.message,
        link: a.link || FieldValue.delete(),
      });
      updated += 1;
    }
  }

  logger.info(`[Alerts] Ronda finalizada: ${findings.length} hallazgo(s), ${created} nueva(s), ${updated} actualizada(s).`);
  await sendAlertEmails(findings);
});
