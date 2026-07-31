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
}));

import { getFirestore } from 'firebase-admin/firestore';
import { ensureWarmShardAvailable, checkWarmShardBuffer } from './shards';

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
});
