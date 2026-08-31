import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v1', () => {
  const onRun = vi.fn((handler: any) => handler);
  const timeZone = vi.fn(() => ({ onRun }));
  const schedule = vi.fn(() => ({ timeZone }));
  return {
    pubsub: {
      schedule,
    },
  };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));

vi.mock('./helpers', () => ({
  PLATFORM_PROJECT: 'vertex-platform-dev',
  getOwnerOAuthClient: vi.fn(),
  pickBillingAccount: vi.fn().mockResolvedValue('billing-123'),
  apiFetch: vi.fn(),
  pollOperation: vi.fn(),
  sendDirectEmail: vi.fn().mockResolvedValue(true),
}));

import { getFirestore } from 'firebase-admin/firestore';
import { ensureWarmShardAvailable, checkWarmShardBuffer, checkPoolLowAndAlert } from './shards';

describe('Warm Shard Pre-Provisioning (shards.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FUNCTIONS_EMULATOR;
  });

  it('skips background calls in emulator mode', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await ensureWarmShardAvailable();
    expect(result).toBeNull();
  });

  it('returns existing warm shard id if a standby shard is already present', async () => {
    const mockShardDoc = {
      id: 'shard-development-warm-123',
      data: () => ({ status: 'WARMUP_READY' }),
    };
    const mockGet = vi.fn().mockResolvedValue({
      empty: false,
      docs: [mockShardDoc],
    });
    const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
    const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });

    (getFirestore as any).mockReturnValue({
      collection: vi.fn().mockReturnValue({
        where: mockWhere1,
      }),
    });

    const result = await ensureWarmShardAvailable();
    expect(result).toBe('shard-development-warm-123');
  });

  it('registers checkWarmShardBuffer schedule handler', () => {
    expect(checkWarmShardBuffer).toBeDefined();
  });

  it('pool-low alert persists recommended command to reach target in one go', async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const alertDocGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ lastAlertedAt: new Date() }), // notifica dedupe: sin email
    });

    // 1 shard disponible (≤ POOL_LOW_THRESHOLD=2) → alerta activa.
    const shardSnap = {
      docs: [{ data: () => ({ status: 'WARMUP_READY', currentStores: 0, maxCapacity: 35 }) }],
    };
    const infraCollection = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(shardSnap as any),
      }),
    });
    const alertCollection = vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: alertDocGet,
        set: setMock,
      }),
    });
    (getFirestore as any).mockReturnValue({
      collection: vi.fn((name: string) =>
        name === 'infrastructure_shards' ? infraCollection(name) : alertCollection(name),
      ),
    });

    const available = await checkPoolLowAndAlert(getFirestore() as any, 'development');
    expect(available).toBe(1);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        availableShards: 1,
        recommendedCount: 10,
        command: expect.stringMatching(/--target 10.*--env dev/),
      }),
    );
  });
});
