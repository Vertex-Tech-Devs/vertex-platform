import { PLATFORM_PROJECT } from './helpers';
import type { StoreShard } from './types';
import * as functions from 'firebase-functions/v1';
import { getFirestore } from 'firebase-admin/firestore';

export type PlatformEnvironment = 'development' | 'production' | 'local';

export interface RuntimeShardCapacity {
  id: string;
  projectId: string;
  siteId: string;
  region: string;
  status: StoreShard['status'];
  currentStores: number;
  reservedStores: number;
  maxCapacity: number;
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

/**
 * Physical limit of sites per Firebase project imposed by GCP/Firebase Hosting is 36.
 * We reserve 1 for default hosting, giving a max capacity of 35 user store sites per shared shard.
 */
export const DEFAULT_MAX_STORES_PER_SHARD = 35;

export function resolvePlatformEnvironment(projectId = PLATFORM_PROJECT): PlatformEnvironment {
  if (process.env.FUNCTIONS_EMULATOR === 'true' || projectId.includes('local')) {
    return 'local';
  }
  return projectId === 'vertex-platform-dev' ? 'development' : 'production';
}

export function getAvailableShardSlots(
  shard: Pick<StoreShard, 'maxCapacity' | 'currentStores' | 'reservedStores'>,
): number {
  // Defensivo: campos ausentes se tratan como 0 (evita NaN → 500 en el panel).
  const max = Number(shard.maxCapacity ?? 0);
  const current = Number(shard.currentStores ?? 0);
  const reserved = Number(shard.reservedStores ?? 0);
  return Math.max(0, max - current - reserved);
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
        currentStores: shard.currentStores,
        reservedStores: shard.reservedStores,
        maxCapacity: shard.maxCapacity,
        availableStores,
        occupancyRatio:
          shard.maxCapacity > 0
            ? Number(shard.currentStores ?? 0) / Number(shard.maxCapacity)
            : 1,
      };
    })
    .sort((left, right) => {
      if (left.status === 'ACTIVE' && right.status !== 'ACTIVE') return -1;
      if (right.status === 'ACTIVE' && left.status !== 'ACTIVE') return 1;
      if (left.availableStores !== right.availableStores) {
        return right.availableStores - left.availableStores;
      }
      return left.id.localeCompare(right.id);
    });

  const activeSharedShardCount = normalizedShards.filter(
    (shard) => shard.status === 'ACTIVE',
  ).length;
  const availableSharedSlots = normalizedShards
    .filter((shard) => shard.status === 'ACTIVE')
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

export const reconcileActiveStores = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('UTC')
  .onRun(async (_context) => {
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
      const shardsSnap = await db.collection('infrastructure_shards').get();
      let correctionsCount = 0;

      for (const shardDoc of shardsSnap.docs) {
        const shardId = shardDoc.id;
        const currentActiveStores = shardDoc.data()['currentStores'] || 0;
        const physicalActiveStores = physicalCounts[shardId] || 0;

        if (currentActiveStores !== physicalActiveStores) {
          console.warn(
            `[Reconciliation] Mismatch detected in shard ${shardId}: registered=${currentActiveStores}, physical=${physicalActiveStores}. Auto-correcting...`,
          );

          // Update currentStores in Firestore
          await db.collection('infrastructure_shards').doc(shardId).update({
            currentStores: physicalActiveStores,
            updatedAt: new Date(),
          });

          // Log warning audit log
          await db.collection('audit_logs').add({
            timestamp: new Date(),
            severity: 'WARNING',
            module: 'RECONCILIATION',
            message: `Shard ${shardId} currentStores auto-corrected from ${currentActiveStores} to ${physicalActiveStores}.`,
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
  });
