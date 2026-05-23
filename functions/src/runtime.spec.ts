import { describe, expect, it } from 'vitest';
import { getAvailableShardSlots, resolvePlatformEnvironment, summarizeShardCapacity } from './runtime';
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
    expect(getAvailableShardSlots(makeShard({ maxStores: 10, activeStores: 9, reservedStores: 5 }))).toBe(0);
  });
});

describe('summarizeShardCapacity', () => {
  it('recommends shared-shard when active capacity exists', () => {
    const summary = summarizeShardCapacity([
      makeShard({ id: 'shared-a', activeStores: 40, reservedStores: 10, maxStores: 100 }),
      makeShard({ id: 'shared-b', activeStores: 92, reservedStores: 8, maxStores: 100, status: 'draining' }),
    ]);

    expect(summary.activeSharedShardCount).toBe(1);
    expect(summary.availableSharedSlots).toBe(50);
    expect(summary.recommendedRuntimeMode).toBe('shared-shard');
    expect(summary.shards[0]?.id).toBe('shared-a');
  });

  it('recommends dedicated-project when no active shard has available capacity', () => {
    const summary = summarizeShardCapacity([
      makeShard({ id: 'shared-a', activeStores: 90, reservedStores: 10, maxStores: 100 }),
      makeShard({ id: 'shared-b', activeStores: 80, reservedStores: 20, maxStores: 100, status: 'maintenance' }),
    ]);

    expect(summary.availableSharedSlots).toBe(0);
    expect(summary.recommendedRuntimeMode).toBe('dedicated-project');
  });
});
