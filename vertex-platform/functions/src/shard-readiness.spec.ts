import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn(() => vi.fn()),
  HttpsError: class HttpsError extends Error {},
}));

vi.mock('./helpers', () => ({
  ALLOWED_ORIGINS: [],
  PLATFORM_PROJECT: 'vertex-platform-dev',
}));

vi.mock('./runtime', () => ({
  resolvePlatformEnvironment: vi.fn(() => 'development'),
}));

vi.mock('./stores', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

import { checkShardReadiness } from './shard-readiness';

const db = {
  collection: vi.fn(),
} as any;

let shardCounter = 0;
function makeShard(overrides: Record<string, unknown> = {}) {
  shardCounter++;
  return {
    id: `shard-development-test${shardCounter}`,
    environment: 'development',
    runtimeMode: 'shared-shard',
    projectId: `vtx-sd-test${String(shardCounter).padStart(4, '0')}`,
    siteId: 'default',
    region: 'us-central1',
    status: 'WARMUP_READY',
    maxCapacity: 35,
    currentStores: 0,
    reservedStores: 0,
    billingAccountId: '016AC2-299E39-51C8BF',
    ...overrides,
  } as any;
}

describe('checkShardReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ update: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('marca ready cuando status OK + billing + redirect registrado (persistido fresco)', async () => {
    const shard = makeShard({
      redirectUriStatus: 'registered',
      redirectUriCheckedAt: new Date(),
    });
    const result = await checkShardReadiness(db, shard);
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('marca missing=status cuando el shard está en WARMUP_PROVISIONING', async () => {
    const shard = makeShard({
      status: 'WARMUP_PROVISIONING',
      redirectUriStatus: 'registered',
      redirectUriCheckedAt: new Date(),
    });
    const result = await checkShardReadiness(db, shard);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('status');
  });

  it('marca missing=billing cuando no tiene billingAccountId', async () => {
    const shard = makeShard({
      billingAccountId: '',
      redirectUriStatus: 'registered',
      redirectUriCheckedAt: new Date(),
    });
    const result = await checkShardReadiness(db, shard);
    expect(result.missing).toContain('billing');
  });

  it('marca missing=redirect_uri cuando el persistido dice missing', async () => {
    const shard = makeShard({
      redirectUriStatus: 'missing',
      redirectUriCheckedAt: new Date(),
    });
    const result = await checkShardReadiness(db, shard);
    expect(result.missing).toContain('redirect_uri');
    expect(result.ready).toBe(false);
  });

  it('re-verifica en vivo cuando no hay cache ni persistido fresco y persiste el resultado', async () => {
    const shard = makeShard({});
    const update = vi.fn().mockResolvedValue(undefined);
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ update }),
    });

    // Simula accounts.google.com respondiendo 200 con página de consentimiento (sin error).
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('<html>consent</html>'),
    } as any);

    try {
      const result = await checkShardReadiness(db, shard);
      expect(result.ready).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ redirectUriStatus: 'registered' }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('marca missing=redirect_uri cuando el check en vivo detecta redirect_uri_mismatch', async () => {
    const shard = makeShard({});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('<html>Error 400: redirect_uri_mismatch</html>'),
    } as any);

    try {
      const result = await checkShardReadiness(db, shard);
      expect(result.missing).toContain('redirect_uri');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('marca missing=redirect_uri cuando el check en vivo redirige a /signin/oauth/error', async () => {
    const shard = makeShard({});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      headers: new Headers({ location: 'https://accounts.google.com/signin/oauth/error' }),
      text: vi.fn().mockResolvedValue(''),
    } as any);

    try {
      const result = await checkShardReadiness(db, shard);
      expect(result.missing).toContain('redirect_uri');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('usa la cache en memoria sin re-verificar en vivo', async () => {
    const shard = makeShard({ redirectUriStatus: 'registered', redirectUriCheckedAt: new Date() });
    await checkShardReadiness(db, shard); // puebla la cache con estado registrado
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('no debe llamarse'));
    try {
      const result = await checkShardReadiness(db, shard);
      expect(result.ready).toBe(true);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
