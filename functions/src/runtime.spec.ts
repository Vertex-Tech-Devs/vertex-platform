import { describe, expect, it, vi, beforeEach } from 'vitest';

// 1. Mock Firebase services before importing
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
vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));

import { getFirestore } from 'firebase-admin/firestore';
import {
  getAvailableShardSlots,
  resolvePlatformEnvironment,
  summarizeShardCapacity,
  reconcileActiveStores,
} from './runtime';
import { getRuntimeCapacitySummary } from './stores';
import type { StoreShard } from './types';

function makeShard(overrides: Partial<StoreShard> = {}): StoreShard {
  return {
    id: overrides.id ?? 'shard-1',
    environment: overrides.environment ?? 'production',
    runtimeMode: 'shared-shard',
    projectId: overrides.projectId ?? 'vertex-shared-prod',
    siteId: overrides.siteId ?? 'vertex-shared-prod',
    region: overrides.region ?? 'us-central1',
    status: overrides.status ?? 'active',
    maxStores: overrides.maxStores ?? 100,
    activeStores: overrides.activeStores ?? 25,
    reservedStores: overrides.reservedStores ?? 5,
    currentTemplateVersion: overrides.currentTemplateVersion,
    currentDataVersion: overrides.currentDataVersion,
    createdAt: overrides.createdAt ?? new Date('2026-05-23T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-05-23T00:00:00.000Z'),
  };
}

describe('resolvePlatformEnvironment', () => {
  it('returns development for the dev platform project', () => {
    expect(resolvePlatformEnvironment('vertex-platform-dev')).toBe('development');
  });

  it('defaults to production for non-dev projects', () => {
    expect(resolvePlatformEnvironment('vertex-platform-app')).toBe('production');
  });
});

describe('getAvailableShardSlots', () => {
  it('subtracts active and reserved stores from the max capacity', () => {
    expect(
      getAvailableShardSlots(makeShard({ maxStores: 100, activeStores: 67, reservedStores: 8 })),
    ).toBe(25);
  });

  it('never returns a negative number', () => {
    expect(
      getAvailableShardSlots(makeShard({ maxStores: 10, activeStores: 9, reservedStores: 5 })),
    ).toBe(0);
  });
});

describe('summarizeShardCapacity', () => {
  it('recommends shared-shard when active capacity exists', () => {
    const summary = summarizeShardCapacity([
      makeShard({ id: 'shared-a', activeStores: 40, reservedStores: 10, maxStores: 100 }),
      makeShard({
        id: 'shared-b',
        activeStores: 92,
        reservedStores: 8,
        maxStores: 100,
        status: 'draining',
      }),
    ]);

    expect(summary.activeSharedShardCount).toBe(1);
    expect(summary.availableSharedSlots).toBe(50);
    expect(summary.recommendedRuntimeMode).toBe('shared-shard');
    expect(summary.shards[0]?.id).toBe('shared-a');
  });

  it('recommends dedicated-project when no active shard has available capacity', () => {
    const summary = summarizeShardCapacity([
      makeShard({ id: 'shared-a', activeStores: 90, reservedStores: 10, maxStores: 100 }),
      makeShard({
        id: 'shared-b',
        activeStores: 80,
        reservedStores: 20,
        maxStores: 100,
        status: 'maintenance',
      }),
    ]);

    expect(summary.availableSharedSlots).toBe(0);
    expect(summary.recommendedRuntimeMode).toBe('dedicated-project');
  });
});

describe('reconcileActiveStores scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects mismatches and auto-corrects activeStores in Firestore', async () => {
    const mockStores = [
      { id: 'store-1', shardId: 'shard-1', runtimeMode: 'shared-shard', status: 'active' },
      { id: 'store-2', shardId: 'shard-1', runtimeMode: 'shared-shard', status: 'active' },
      { id: 'store-3', shardId: 'shard-2', runtimeMode: 'shared-shard', status: 'active' },
    ];

    const mockShards = [
      { id: 'shard-1', activeStores: 5 }, // Should be corrected to 2
      { id: 'shard-2', activeStores: 1 }, // Correct
    ];

    const updatedShards: Record<string, number> = {};
    const auditLogs: any[] = [];

    const dbMock = {
      collection: vi.fn((colName) => {
        if (colName === 'stores') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              docs: mockStores.map((st) => ({
                id: st.id,
                data: () => st,
              })),
            }),
          };
        }
        if (colName === 'shards') {
          return {
            get: vi.fn().mockResolvedValue({
              size: mockShards.length,
              docs: mockShards.map((sh) => ({
                id: sh.id,
                data: () => sh,
              })),
            }),
            doc: vi.fn((id) => ({
              update: vi.fn().mockImplementation((data) => {
                updatedShards[id] = data.activeStores;
                return Promise.resolve();
              }),
            })),
          };
        }
        if (colName === 'audit_logs') {
          return {
            add: vi.fn().mockImplementation((log) => {
              auditLogs.push(log);
              return Promise.resolve();
            }),
          };
        }
        return {
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      }),
    };

    vi.mocked(getFirestore).mockReturnValue(dbMock as any);

    // Call scheduled function handler directly
    const handler = reconcileActiveStores as unknown as (event: any) => Promise<void>;
    await handler({});

    // Verify corrections
    expect(updatedShards['shard-1']).toBe(2);
    expect(updatedShards['shard-2']).toBeUndefined(); // Shard-2 was correct, no update

    // Verify audit logs were written
    expect(auditLogs.length).toBe(2); // 1 for WARNING (correction) + 1 for INFO (completion)
    expect(auditLogs[0].severity).toBe('WARNING');
    expect(auditLogs[0].details.newValue).toBe(2);
    expect(auditLogs[1].severity).toBe('INFO');
  });
});

describe('getRuntimeCapacitySummary quota guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers quotaWarning if total projects usage exceeds 80% threshold', async () => {
    const mockShards = [
      {
        id: 'shard-1',
        projectId: 'project-shard-1',
        runtimeMode: 'shared-shard',
        status: 'active',
        maxStores: 100,
        activeStores: 10,
        reservedStores: 0,
      },
      {
        id: 'shard-2',
        projectId: 'project-shard-2',
        runtimeMode: 'shared-shard',
        status: 'active',
        maxStores: 100,
        activeStores: 10,
        reservedStores: 0,
      },
    ];

    const mockStores = [
      {
        id: 'store-1',
        projectId: 'project-dedicated-1',
        runtimeMode: 'dedicated-project',
        status: 'active',
      },
      {
        id: 'store-2',
        projectId: 'project-dedicated-2',
        runtimeMode: 'dedicated-project',
        status: 'active',
      },
    ];

    const mockBillingAccounts = [
      { id: 'billing-1', active: true, maxProjects: 4 }, // Total projects = 2 (shards) + 2 (stores) = 4. 4/4 = 100% (exceeds 80%)
    ];

    const dbMock = {
      collection: vi.fn((colName) => {
        if (colName === 'shards') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              docs: mockShards.map((sh) => ({
                id: sh.id,
                data: () => sh,
              })),
            }),
          };
        }
        if (colName === 'stores') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              docs: mockStores.map((st) => ({
                id: st.id,
                data: () => st,
              })),
            }),
          };
        }
        if (colName === 'billingAccounts') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: mockBillingAccounts.map((b) => ({
                id: b.id,
                data: () => b,
              })),
            }),
          };
        }
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      }),
    };

    vi.mocked(getFirestore).mockReturnValue(dbMock as any);

    const handler = getRuntimeCapacitySummary as unknown as (req: any) => Promise<any>;
    const result = await handler({ auth: { token: { platformAdmin: true } } });

    expect(result.totalActiveProjects).toBe(4); // 2 shard projects + 2 dedicated projects
    expect(result.maxProjectsLimit).toBe(4);
    expect(result.projectUsageRatio).toBe(1.0);
    expect(result.quotaWarning).toBe(true);
  });

  it('does not trigger quotaWarning if projects usage is below 80%', async () => {
    const dbMock = {
      collection: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    };

    vi.mocked(getFirestore).mockReturnValue(dbMock as any);

    const handler = getRuntimeCapacitySummary as unknown as (req: any) => Promise<any>;
    const result = await handler({ auth: { token: { platformAdmin: true } } });

    expect(result.totalActiveProjects).toBe(0);
    expect(result.maxProjectsLimit).toBe(15); // Fallback
    expect(result.projectUsageRatio).toBe(0);
    expect(result.quotaWarning).toBe(false);
  });
});
