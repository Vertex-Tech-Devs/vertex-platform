import type { Firestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { OAuth2Client } from 'google-auth-library';
import * as nodemailer from 'nodemailer';

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

export const PLATFORM_PROJECT =
  process.env['GCLOUD_PROJECT'] ?? process.env['GOOGLE_CLOUD_PROJECT'] ?? 'vertex-platform-app';

export const ALLOWED_ORIGINS = [
  'https://vertex-platform-app.web.app',
  'https://vertex-platform-dev.web.app',
  'http://localhost:4200',
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
  const owners = await loadOwnerCredentialPool();
  const owner = ownerId ? owners.find((candidate) => candidate.id === ownerId) : owners[0];
  if (!owner) {
    throw new Error(`Provisioning owner credential "${ownerId}" was not found in Secret Manager.`);
  }
  const oauth2 = new OAuth2Client(owner.client_id, owner.client_secret);
  oauth2.setCredentials({ refresh_token: owner.refresh_token });
  return oauth2;
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
  const tokenRes = await auth.getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokenRes.token}`,
    'Content-Type': 'application/json',
  };
  headers['x-goog-user-project'] = options.quotaProject ?? PLATFORM_PROJECT;
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
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
  const accountsSnap = await db.collection('billingAccounts').where('active', '==', true).get();
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
    const remaining = (d.data()['maxProjects'] as number) - (usageMap[d.id] ?? 0);
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
  const [pwVersion] = await secretsClient.accessSecretVersion({
    name: `projects/${PLATFORM_PROJECT}/secrets/ext-firestore-send-email-SMTP_PASSWORD/versions/latest`,
  });
  const smtpPassword = pwVersion.payload!.data!.toString().trim();

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
    to,
    subject,
    text,
    html,
  });
}
