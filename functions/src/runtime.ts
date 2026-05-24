import { PLATFORM_PROJECT } from './helpers';
import type { StoreShard } from './types';

export type PlatformEnvironment = 'development' | 'production';

export interface RuntimeShardCapacity {
  id: string;
  projectId: string;
  siteId: string;
  region: string;
  status: StoreShard['status'];
  activeStores: number;
  reservedStores: number;
  maxStores: number;
  availableStores: number;
  occupancyRatio: number;
}

export interface RuntimeCapacitySummary {
  environment: PlatformEnvironment;
  sharedShardCount: number;
  activeSharedShardCount: number;
  availableSharedSlots: number;
  recommendedRuntimeMode: 'shared-shard' | 'dedicated-project';
  shards: RuntimeShardCapacity[];
}

export function resolvePlatformEnvironment(projectId = PLATFORM_PROJECT): PlatformEnvironment {
  return projectId === 'vertex-platform-dev' ? 'development' : 'production';
}

export function getAvailableShardSlots(
  shard: Pick<StoreShard, 'maxStores' | 'activeStores' | 'reservedStores'>,
): number {
  return Math.max(0, shard.maxStores - shard.activeStores - shard.reservedStores);
}

export function summarizeShardCapacity(
  shards: StoreShard[],
  environment = resolvePlatformEnvironment(),
): RuntimeCapacitySummary {
  const normalizedShards = [...shards]
    .map<RuntimeShardCapacity>((shard) => {
      const availableStores = getAvailableShardSlots(shard);
      return {
        id: shard.id,
        projectId: shard.projectId,
        siteId: shard.siteId,
        region: shard.region,
        status: shard.status,
        activeStores: shard.activeStores,
        reservedStores: shard.reservedStores,
        maxStores: shard.maxStores,
        availableStores,
        occupancyRatio: shard.maxStores > 0 ? shard.activeStores / shard.maxStores : 1,
      };
    })
    .sort((left, right) => {
      if (left.status === 'active' && right.status !== 'active') return -1;
      if (right.status === 'active' && left.status !== 'active') return 1;
      if (left.availableStores !== right.availableStores) {
        return right.availableStores - left.availableStores;
      }
      return left.id.localeCompare(right.id);
    });

  const activeSharedShardCount = normalizedShards.filter((shard) => shard.status === 'active').length;
  const availableSharedSlots = normalizedShards
    .filter((shard) => shard.status === 'active')
    .reduce((sum, shard) => sum + shard.availableStores, 0);

  return {
    environment,
    sharedShardCount: normalizedShards.length,
    activeSharedShardCount,
    availableSharedSlots,
    recommendedRuntimeMode: availableSharedSlots > 0 ? 'shared-shard' : 'dedicated-project',
    shards: normalizedShards,
  };
}
