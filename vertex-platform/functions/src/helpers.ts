import type { Firestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { OAuth2Client, GoogleAuth } from 'google-auth-library';
import * as nodemailer from 'nodemailer';

export async function getPlatformServiceAccountOAuthClient(): Promise<OAuth2Client> {
  const googleAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = (await googleAuth.getClient()) as OAuth2Client;
  return client;
}

interface OwnerCredentialsSecret {
  id?: string;
  label?: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  maxProjects?: number;
}

export interface ProvisioningOwnerCredentials {
  id: string;
  label?: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  maxProjects?: number;
}

export const PLATFORM_PROJECT = (() => {
  const p =
    process.env['GCLOUD_PROJECT'] ?? process.env['GOOGLE_CLOUD_PROJECT'] ?? 'vertex-platform-app';
  return p === 'demo-vertex' ? 'vertex-platform-dev' : p;
})();

export const ALLOWED_ORIGINS: (string | RegExp)[] = [
  'https://vertex-platform-app.web.app',
  'https://vertex-platform-app.firebaseapp.com',
  'https://vertex-platform-dev.web.app',
  'https://vertex-platform-dev.firebaseapp.com',
  'https://vertex-platform.web.app',
  'https://vertex-platform.firebaseapp.com',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  /^https:\/\/vertex-platform-dev--pr-[a-zA-Z0-9-]+\.web\.app$/,
  /^https:\/\/vertex-platform-dev--pr-[a-zA-Z0-9-]+\.firebaseapp\.com$/,
  /^https:\/\/vertex-platform-app--pr-[a-zA-Z0-9-]+\.web\.app$/,
  /^https:\/\/vertex-platform-app--pr-[a-zA-Z0-9-]+\.firebaseapp\.com$/,
];

let cachedGitHubPat: string | null = null;
let cachedOwnerCreds: { client_id: string; client_secret: string; refresh_token: string } | null =
  null;
let cachedOwnerPool: ProvisioningOwnerCredentials[] | null = null;
export const secretsClient = new SecretManagerServiceClient();

function isMissingSecretError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('404') || msg.toLowerCase().includes('not found');
}

function normalizeOwnerCredential(
  raw: OwnerCredentialsSecret,
  index: number,
): ProvisioningOwnerCredentials {
  return {
    id: raw.id?.trim() || `owner-${index + 1}`,
    label: raw.label?.trim(),
    client_id: raw.client_id,
    client_secret: raw.client_secret,
    refresh_token: raw.refresh_token,
    maxProjects: typeof raw.maxProjects === 'number' ? raw.maxProjects : undefined,
  };
}

async function loadOwnerCredentialPool(): Promise<ProvisioningOwnerCredentials[]> {
  if (cachedOwnerPool) return cachedOwnerPool;

  try {
    const [version] = await secretsClient.accessSecretVersion({
      name: `projects/${PLATFORM_PROJECT}/secrets/platform-owner-credentials-pool/versions/latest`,
    });
    const parsed = JSON.parse(version.payload!.data!.toString()) as
      | OwnerCredentialsSecret[]
      | { owners?: OwnerCredentialsSecret[] };
    const rawOwners = Array.isArray(parsed) ? parsed : parsed.owners;
    if (!Array.isArray(rawOwners) || rawOwners.length === 0) {
      throw new Error(
        'Secret platform-owner-credentials-pool must contain a non-empty array of owner credentials.',
      );
    }
    cachedOwnerPool = rawOwners.map((owner, index) => normalizeOwnerCredential(owner, index));
    return cachedOwnerPool;
  } catch (err) {
    if (!isMissingSecretError(err)) throw err;
  }

  if (!cachedOwnerCreds) {
    const [version] = await secretsClient.accessSecretVersion({
      name: `projects/${PLATFORM_PROJECT}/secrets/platform-owner-credentials/versions/latest`,
    });
    cachedOwnerCreds = JSON.parse(version.payload!.data!.toString()) as {
      client_id: string;
      client_secret: string;
      refresh_token: string;
    };
  }

  cachedOwnerPool = [
    normalizeOwnerCredential(
      {
        id: 'primary',
        label: 'Primary owner',
        ...cachedOwnerCreds,
      },
      0,
    ),
  ];
  return cachedOwnerPool;
}

export async function getOwnerOAuthClient(ownerId?: string): Promise<OAuth2Client> {
  try {
    const owners = await loadOwnerCredentialPool();
    const owner = ownerId ? owners.find((candidate) => candidate.id === ownerId) : owners[0];
    if (owner && owner.client_id && owner.refresh_token) {
      const oauth2 = new OAuth2Client(owner.client_id, owner.client_secret);
      oauth2.setCredentials({ refresh_token: owner.refresh_token });
      return oauth2;
    }
  } catch (poolErr) {
    console.warn(
      `[getOwnerOAuthClient] Owner credential pool unavailable (${poolErr}). Falling back to platform service account OAuth client...`,
    );
  }

  return getPlatformServiceAccountOAuthClient();
}

export async function listProvisioningOwnerCandidates(
  db: Firestore,
  preferredOwnerId?: string,
): Promise<ProvisioningOwnerCredentials[]> {
  const owners = await loadOwnerCredentialPool();
  const storesSnap = await db
    .collection('stores')
    .where('status', 'in', ['provisioning', 'active', 'suspended'])
    .get();

  const usageMap: Record<string, number> = {};
  storesSnap.docs.forEach((doc) => {
    const ownerId = doc.data()['provisioningOwnerId'] as string | undefined;
    if (ownerId) usageMap[ownerId] = (usageMap[ownerId] ?? 0) + 1;
  });

  const ranked = owners
    .map((owner, index) => {
      const usedProjects = usageMap[owner.id] ?? 0;
      const remainingProjects =
        typeof owner.maxProjects === 'number'
          ? owner.maxProjects - usedProjects
          : Number.POSITIVE_INFINITY;

      return { owner, index, usedProjects, remainingProjects };
    })
    .sort((left, right) => {
      if (preferredOwnerId) {
        if (left.owner.id === preferredOwnerId && right.owner.id !== preferredOwnerId) return -1;
        if (right.owner.id === preferredOwnerId && left.owner.id !== preferredOwnerId) return 1;
      }
      if (left.remainingProjects !== right.remainingProjects) {
        return right.remainingProjects - left.remainingProjects;
      }
      if (left.usedProjects !== right.usedProjects) {
        return left.usedProjects - right.usedProjects;
      }
      return left.index - right.index;
    });

  const available = ranked.filter((candidate) => candidate.remainingProjects > 0);
  if (available.length === 0) {
    throw new Error(
      'All provisioning owner accounts are at capacity. Add another owner credential to platform-owner-credentials-pool or increase the Google Cloud project quota.',
    );
  }

  return available.map((candidate) => candidate.owner);
}
let cachedDeployToken: string | null = null;

export async function getGitHubPat(): Promise<string> {
  if (cachedGitHubPat) return cachedGitHubPat;
  const [version] = await secretsClient.accessSecretVersion({
    name: `projects/${PLATFORM_PROJECT}/secrets/github-pat/versions/latest`,
  });
  cachedGitHubPat = version.payload!.data!.toString().trim();
  return cachedGitHubPat;
}

export async function getDeployToken(): Promise<string> {
  if (cachedDeployToken) return cachedDeployToken;
  const [version] = await secretsClient.accessSecretVersion({
    name: `projects/${PLATFORM_PROJECT}/secrets/deploy-token/versions/latest`,
  });
  cachedDeployToken = version.payload!.data!.toString().trim();
  return cachedDeployToken;
}

export async function apiFetch(
  auth: OAuth2Client,
  url: string,
  options: { method?: string; body?: unknown; quotaProject?: string } = {},
): Promise<unknown> {
  const maxAttempts = 10;
  let delayMs = 3000;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tokenRes = await auth.getAccessToken();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${tokenRes.token}`,
        'Content-Type': 'application/json',
      };
      if (options.quotaProject) {
        headers['x-goog-user-project'] = options.quotaProject;
      }
      const res = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      if ((res.status === 429 || res.status === 503) && i < maxAttempts - 1) {
        const jitter = Math.floor(Math.random() * 1000);
        const currentDelay = delayMs + jitter;
        console.warn(
          `[apiFetch] Rate limited / Service unavailable (${res.status}) on ${url}. Retrying attempt ${i + 1}/${maxAttempts} in ${currentDelay}ms...`,
        );
        await new Promise((r) => setTimeout(r, currentDelay));
        delayMs = Math.min(delayMs * 2, 45000);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        if (
          (res.status === 429 || text.includes('RESOURCE_EXHAUSTED') || text.includes('429')) &&
          i < maxAttempts - 1
        ) {
          const jitter = Math.floor(Math.random() * 1000);
          const currentDelay = delayMs + jitter;
          console.warn(
            `[apiFetch] Quota/Rate limit exhausted on ${url}: ${text}. Retrying attempt ${i + 1}/${maxAttempts} in ${currentDelay}ms...`,
          );
          await new Promise((r) => setTimeout(r, currentDelay));
          delayMs = Math.min(delayMs * 2, 45000);
          continue;
        }
        if (
          res.status === 403 &&
          (text.includes('CONSUMER_INVALID') ||
            text.includes('Permission denied on resource project')) &&
          i < maxAttempts - 1
        ) {
          const jitter = Math.floor(Math.random() * 1000);
          const currentDelay = delayMs + jitter;
          console.warn(
            `[apiFetch] API propagation delay (CONSUMER_INVALID / 403) on ${url}. Retrying attempt ${i + 1}/${maxAttempts} in ${currentDelay}ms...`,
          );
          await new Promise((r) => setTimeout(r, currentDelay));
          delayMs = Math.min(delayMs * 2, 45000);
          continue;
        }
        if (
          (text.includes('USER_PROJECT_DENIED') ||
            (res.status === 403 && text.includes('serviceusage'))) &&
          options.quotaProject
        ) {
          console.warn(
            `[apiFetch] USER_PROJECT_DENIED with quotaProject ${options.quotaProject}. Retrying without quota project header...`,
          );
          delete options.quotaProject;
          continue;
        }
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }
      return res.json();
    } catch (err) {
      const errStr = String(err);
      if (
        i < maxAttempts - 1 &&
        (errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED') ||
          errStr.includes('503') ||
          errStr.includes('CONSUMER_INVALID') ||
          errStr.includes('Permission denied on resource project'))
      ) {
        const jitter = Math.floor(Math.random() * 1000);
        const currentDelay = delayMs + jitter;
        console.warn(
          `[apiFetch] Transient/Propagation error on ${url}: ${errStr}. Retrying attempt ${i + 1}/${maxAttempts} in ${currentDelay}ms...`,
        );
        await new Promise((r) => setTimeout(r, currentDelay));
        delayMs = Math.min(delayMs * 2, 45000);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Max retry attempts reached for apiFetch: ${url}`);
}

export async function retry<T>(
  fn: () => Promise<T>,
  attempts: number,
  delayMs: number,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs * i));
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function pickBillingAccount(db: Firestore): Promise<string> {
  // New schema: billing_accounts with status == 'ACTIVE'. Legacy fallback: billingAccounts with active == true.
  let accountsSnap = await db.collection('billing_accounts').where('status', '==', 'ACTIVE').get();
  if (accountsSnap.empty) {
    accountsSnap = await db.collection('billingAccounts').where('active', '==', true).get();
  }
  if (accountsSnap.empty) {
    accountsSnap = await db.collection('billing_accounts').get();
  }
  if (accountsSnap.empty) {
    accountsSnap = await db.collection('billingAccounts').get();
  }
  if (accountsSnap.empty) throw new Error('No active billing accounts configured.');

  const storesSnap = await db
    .collection('stores')
    .where('status', 'in', ['provisioning', 'active', 'suspended'])
    .get();

  const usageMap: Record<string, number> = {};
  storesSnap.docs.forEach((d) => {
    const bid = d.data()['billingAccountId'] as string | undefined;
    if (bid) usageMap[bid] = (usageMap[bid] ?? 0) + 1;
  });

  let bestId: string | null = null;
  let bestRemaining = -Infinity;

  accountsSnap.docs.forEach((d) => {
    const data = d.data();
    // Prefer the stored currentProjects counter; fall back to computed usage from live stores.
    const maxProjects = (data['maxProjects'] as number | undefined) ?? Infinity;
    const currentProjects = data['currentProjects'] as number | undefined;
    const used = currentProjects !== undefined ? currentProjects : (usageMap[d.id] ?? 0);
    const remaining = maxProjects - used;
    if (remaining > bestRemaining) {
      bestRemaining = remaining;
      bestId = d.id;
    }
  });

  if (!bestId || bestRemaining <= 0) {
    throw new Error(
      'All billing accounts are at capacity. Add a new billing account from Settings → Facturación.',
    );
  }

  return bestId;
}

export async function pollOperation(
  auth: OAuth2Client,
  operationName: string,
  apiBase: string,
  maxAttempts = 36,
  delayMs = 5000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const op = (await apiFetch(auth, `${apiBase}/${operationName}`)) as {
      done?: boolean;
      error?: { message: string };
    };
    if (op.done) {
      if (op.error) throw new Error(op.error.message);
      return;
    }
  }
  throw new Error(`Operation ${operationName} timed out after ${maxAttempts * delayMs}ms`);
}

export async function sendDirectEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const secretsClient = new SecretManagerServiceClient();
  let smtpPassword = '';
  try {
    const [pwVersion] = await secretsClient.accessSecretVersion({
      name: `projects/${PLATFORM_PROJECT}/secrets/ext-firestore-send-email-SMTP_PASSWORD/versions/latest`,
    });
    smtpPassword = pwVersion.payload!.data!.toString().trim();
  } catch {
    try {
      const [pwVersion] = await secretsClient.accessSecretVersion({
        name: `projects/${PLATFORM_PROJECT}/secrets/SMTP_PASSWORD/versions/latest`,
      });
      smtpPassword = pwVersion.payload!.data!.toString().trim();
    } catch {
      smtpPassword = process.env.SMTP_PASS || '';
    }
  }

  if (!smtpPassword) {
    console.warn('[sendDirectEmail] No se encontró contraseña SMTP en Secret Manager.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'vertex.tech.dev@gmail.com',
      pass: smtpPassword,
    },
  });

  await transporter.sendMail({
    from: '"Vertex Platform" <vertex.tech.dev@gmail.com>',
    replyTo: 'vertex.tech.dev@gmail.com',
    to,
    subject,
    text,
    html,
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      Importance: 'High',
    },
  });
}

export interface NewStoreNotificationData {
  storeId: string;
  storeName: string;
  slug: string;
  ownerEmail: string;
  verticalId?: string;
  projectId?: string;
  shardMode?: string;
  siteUrl?: string;
  tier?: string;
  billingCycle?: string;
  subscriptionStatus?: string;
  trialDays?: number | null;
  createdAt?: Date;
}

export async function notifyAdminNewStoreCreated(data: NewStoreNotificationData): Promise<void> {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'vertex.tech.dev@gmail.com';
  const subject = `🚀 Nueva Tienda Creada: ${data.storeName} (${data.slug})`;
  const storeUrl = data.siteUrl || `https://vtx-${data.slug}.web.app`;
  const platformAdminUrl = 'https://vertex-platform.web.app/stores';

  let planDisplay = `${data.tier || 'PRO'} (${data.billingCycle === 'annual' ? 'Facturación Anual' : 'Facturación Mensual'})`;
  if (data.subscriptionStatus === 'complimentary') {
    planDisplay = `🎁 PRO — Bonificado / Gratuito (100% Cortesía)`;
  } else if (data.subscriptionStatus === 'trial') {
    planDisplay = `⏳ Período de Prueba (${data.trialDays || 14} días)`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .header { background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); padding: 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 24px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: #22c55e; color: #000000; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table td { padding: 10px 12px; border-bottom: 1px solid #334155; font-size: 14px; }
    .table td.label { color: #94a3b8; font-weight: 500; width: 40%; }
    .table td.value { color: #f1f5f9; font-weight: 600; }
    .btn-container { text-align: center; margin-top: 24px; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 0 6px; font-size: 14px; }
    .btn-secondary { background: #334155; color: #f8fafc; border: 1px solid #475569; }
    .footer { padding: 16px 24px; background: #0f172a; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🚀 ¡Nueva Tienda Creada en Producción!</h1>
    </div>
    <div class="content">
      <p style="margin-top: 0; font-size: 15px; color: #cbd5e1; line-height: 1.5;">Se ha completado el aprovisionamiento y despliegue de una nueva tienda en la plataforma Vertex Commerce.</p>
      
      <table class="table">
        <tr>
          <td class="label">Nombre de la Tienda</td>
          <td class="value">${data.storeName}</td>
        </tr>
        <tr>
          <td class="label">Slug / Subdominio</td>
          <td class="value"><code style="color: #38bdf8;">${data.slug}</code></td>
        </tr>
        <tr>
          <td class="label">Email del Propietario</td>
          <td class="value">${data.ownerEmail}</td>
        </tr>
        <tr>
          <td class="label">Rubro Comercial</td>
          <td class="value">${data.verticalId || 'General'}</td>
        </tr>
        <tr>
          <td class="label">Proyecto Firebase / Shard</td>
          <td class="value"><code style="color: #a78bfa;">${data.projectId || 'shared-shard'}</code></td>
        </tr>
        <tr>
          <td class="label">Modo de Aprovisionamiento</td>
          <td class="value">${data.shardMode === 'dedicated' ? '💎 Shard Dedicado' : '⚡ Shard Compartido'}</td>
        </tr>
        <tr>
          <td class="label">Plan / Modalidad</td>
          <td class="value">${planDisplay}</td>
        </tr>
        <tr>
          <td class="label">Fecha de Creación</td>
          <td class="value">${(data.createdAt || new Date()).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td>
        </tr>
      </table>

      <div class="btn-container">
        <a href="${storeUrl}" class="btn" target="_blank">🌐 Visitar Tienda</a>
        <a href="${platformAdminUrl}" class="btn btn-secondary" target="_blank">⚙️ Abrir Panel Vertex</a>
      </div>
    </div>
    <div class="footer">
      Vertex Commerce Platform • Notificación Automática de Infraestructura
    </div>
  </div>
</body>
</html>
`;

  const text = `
Nueva Tienda Creada en Vertex:
- Tienda: ${data.storeName} (${data.slug})
- Propietario: ${data.ownerEmail}
- Rubro: ${data.verticalId || 'General'}
- Proyecto: ${data.projectId || 'shared-shard'}
- URL: ${storeUrl}
- Plan: ${data.tier || 'PRO'} (${data.billingCycle || 'monthly'})
- Fecha: ${(data.createdAt || new Date()).toISOString()}
`;

  try {
    await sendDirectEmail(adminEmail, subject, html, text);
    console.info(
      `[notifyAdminNewStoreCreated] Email de notificación enviado a ${adminEmail} para la tienda ${data.slug}`,
    );
  } catch (err) {
    console.error(
      `[notifyAdminNewStoreCreated] Error al enviar notificación a ${adminEmail}:`,
      err,
    );
  }
}
