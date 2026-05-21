import type { Firestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { OAuth2Client } from 'google-auth-library';

export const PLATFORM_PROJECT =
  process.env['GCLOUD_PROJECT'] ?? process.env['GOOGLE_CLOUD_PROJECT'] ?? 'vertex-platform-app';

export const ALLOWED_ORIGINS = [
  'https://vertex-platform-app.web.app',
  'https://vertex-platform-dev.web.app',
];

export async function getOwnerOAuthClient(): Promise<OAuth2Client> {
  const secrets = new SecretManagerServiceClient();
  const [version] = await secrets.accessSecretVersion({
    name: `projects/${PLATFORM_PROJECT}/secrets/platform-owner-credentials/versions/latest`,
  });
  const creds = JSON.parse(version.payload!.data!.toString()) as {
    client_id: string;
    client_secret: string;
    refresh_token: string;
  };
  const oauth2 = new OAuth2Client(creds.client_id, creds.client_secret);
  oauth2.setCredentials({ refresh_token: creds.refresh_token });
  return oauth2;
}

export async function getGitHubPat(): Promise<string> {
  const secrets = new SecretManagerServiceClient();
  const [version] = await secrets.accessSecretVersion({
    name: `projects/${PLATFORM_PROJECT}/secrets/github-pat/versions/latest`,
  });
  return version.payload!.data!.toString().trim();
}

export async function apiFetch(
  auth: OAuth2Client,
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const tokenRes = await auth.getAccessToken();
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${tokenRes.token}`,
      'Content-Type': 'application/json',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export async function retry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
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
      'All billing accounts are at capacity. Add a new billing account from Settings → Facturación.'
    );
  }

  return bestId;
}

export async function pollOperation(
  auth: OAuth2Client,
  operationName: string,
  apiBase: string,
  maxAttempts = 36,
  delayMs = 5000
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
