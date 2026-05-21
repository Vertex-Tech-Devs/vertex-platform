import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing provisionStore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn(),
}));
vi.mock('./helpers', () => ({
  ALLOWED_ORIGINS: [],
  pickBillingAccount: vi.fn().mockResolvedValue('billing-1'),
  getOwnerOAuthClient: vi.fn(),
  getGitHubPat: vi.fn(),
  apiFetch: vi.fn(),
  retry: vi.fn(),
  pollOperation: vi.fn(),
}));

import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const VALID_PAYLOAD = {
  name: 'Test Store',
  slug: 'my-store',
  ownerEmail: 'owner@test.com',
  plan: 'basic',
};

function makeRequest(data: Record<string, unknown>, isAdmin = true) {
  return {
    auth: isAdmin ? { token: { platformAdmin: true } } : { token: {} },
    data,
  };
}

function makeDb(slugExists = false) {
  const queryMock = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ empty: !slugExists }),
  };
  const docMock = {
    set: vi.fn().mockResolvedValue(undefined),
  };
  return {
    collection: vi.fn(() => ({
      ...queryMock,
      doc: vi.fn(() => docMock),
    })),
  };
}

describe('provisionStore handler', () => {
  let handler: (req: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./provisioning');
    // provisionStore is exported as the handler function (after vi.mock of onCall)
    handler = mod.provisionStore as unknown as (req: unknown) => Promise<unknown>;
  });

  it('rejects non-admin callers', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as ReturnType<typeof getFirestore>);
    await expect(handler(makeRequest(VALID_PAYLOAD, false))).rejects.toThrow(HttpsError);
  });

  it('rejects missing required fields', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as ReturnType<typeof getFirestore>);
    await expect(
      handler(makeRequest({ ...VALID_PAYLOAD, name: '' }))
    ).rejects.toThrow(HttpsError);
  });

  it('rejects invalid slug — too short', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as ReturnType<typeof getFirestore>);
    await expect(
      handler(makeRequest({ ...VALID_PAYLOAD, slug: 'ab' }))
    ).rejects.toThrow(HttpsError);
  });

  it('rejects invalid slug — uppercase', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as ReturnType<typeof getFirestore>);
    await expect(
      handler(makeRequest({ ...VALID_PAYLOAD, slug: 'MyStore' }))
    ).rejects.toThrow(HttpsError);
  });

  it('rejects invalid slug — starts with hyphen', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as ReturnType<typeof getFirestore>);
    await expect(
      handler(makeRequest({ ...VALID_PAYLOAD, slug: '-mystore' }))
    ).rejects.toThrow(HttpsError);
  });

  it('rejects duplicate slug', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb(true) as ReturnType<typeof getFirestore>);
    await expect(handler(makeRequest(VALID_PAYLOAD))).rejects.toThrow(HttpsError);
  });

  it('accepts valid slug — lowercase alphanumeric', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as ReturnType<typeof getFirestore>);
    const result = await handler(makeRequest({ ...VALID_PAYLOAD, slug: 'mystore123' }));
    expect(result).toHaveProperty('storeId');
    expect(result).toHaveProperty('projectId');
  });

  it('accepts valid slug — with hyphens', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as ReturnType<typeof getFirestore>);
    const result = await handler(makeRequest({ ...VALID_PAYLOAD, slug: 'my-store-name' }));
    expect(result).toHaveProperty('storeId');
  });

  it('sets projectId as vtx-{slug}', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as ReturnType<typeof getFirestore>);
    const result = (await handler(makeRequest(VALID_PAYLOAD))) as { projectId: string };
    expect(result.projectId).toBe('vtx-my-store');
  });
});
