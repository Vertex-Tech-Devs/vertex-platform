import { PLATFORM_PROJECT } from './helpers';
import type { StoreShard } from './types';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';

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

  const activeSharedShardCount = normalizedShards.filter(
    (shard) => shard.status === 'active',
  ).length;
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

export const reconcileActiveStores = onSchedule(
  {
    schedule: '0 0 * * *', // Runs daily at midnight UTC
    timeZone: 'UTC',
  },
  async (_event) => {
    const db = getFirestore();
    console.log('[Reconciliation] Starting daily store-shard reconciliation...');

    try {
      // 1. Fetch all active shared-shard stores
      const storesSnap = await db
        .collection('stores')
        .where('runtimeMode', '==', 'shared-shard')
        .where('status', '==', 'active')
        .get();

      // 2. Count active stores physically per shardId
      const physicalCounts: Record<string, number> = {};
      for (const doc of storesSnap.docs) {
        const shardId = doc.data()['shardId'];
        if (shardId) {
          physicalCounts[shardId] = (physicalCounts[shardId] || 0) + 1;
        }
      }

      // 3. Fetch all shards
      const shardsSnap = await db.collection('shards').get();
      let correctionsCount = 0;

      for (const shardDoc of shardsSnap.docs) {
        const shardId = shardDoc.id;
        const currentActiveStores = shardDoc.data()['activeStores'] || 0;
        const physicalActiveStores = physicalCounts[shardId] || 0;

        if (currentActiveStores !== physicalActiveStores) {
          console.warn(
            `[Reconciliation] Mismatch detected in shard ${shardId}: registered=${currentActiveStores}, physical=${physicalActiveStores}. Auto-correcting...`,
          );

          // Update activeStores in Firestore
          await db.collection('shards').doc(shardId).update({
            activeStores: physicalActiveStores,
            updatedAt: new Date(),
          });

          // Log warning audit log
          await db.collection('audit_logs').add({
            timestamp: new Date(),
            severity: 'WARNING',
            module: 'RECONCILIATION',
            message: `Shard ${shardId} activeStores auto-corrected from ${currentActiveStores} to ${physicalActiveStores}.`,
            details: {
              shardId,
              previousValue: currentActiveStores,
              newValue: physicalActiveStores,
            },
          });

          correctionsCount++;
        }
      }

      console.log(
        `[Reconciliation] Finished successfully. Total shards verified: ${shardsSnap.size}. Total corrections: ${correctionsCount}.`,
      );

      // Log success audit log
      await db.collection('audit_logs').add({
        timestamp: new Date(),
        severity: 'INFO',
        module: 'RECONCILIATION',
        message: `Store-shard reconciliation finished successfully. Verified ${shardsSnap.size} shards. Corrections applied: ${correctionsCount}.`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Reconciliation] Error running daily store-shard reconciliation:', err);

      await db.collection('audit_logs').add({
        timestamp: new Date(),
        severity: 'ERROR',
        module: 'RECONCILIATION',
        message: `Store-shard reconciliation failed: ${errorMsg}`,
      });
    }
  },
);
