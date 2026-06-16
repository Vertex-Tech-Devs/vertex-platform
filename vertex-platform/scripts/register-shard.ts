import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface ParsedArgs {
  shardId: string;
  projectId: string;
  siteId: string;
  region: string;
  environment: 'development' | 'production';
  status: 'active' | 'draining' | 'maintenance';
  maxStores: number;
  reservedStores: number;
  currentTemplateVersion?: string;
  currentDataVersion?: string;
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseArgs(): ParsedArgs {
  const shardId = readArg('shard-id');
  const projectId = readArg('project-id');
  const siteId = readArg('site-id');
  const environment =
    (readArg('environment') as ParsedArgs['environment'] | undefined) ?? 'production';
  const region = readArg('region') ?? 'us-central1';
  const status = (readArg('status') as ParsedArgs['status'] | undefined) ?? 'active';
  const maxStores = Number(readArg('max-stores') ?? '100');
  const reservedStores = Number(readArg('reserved-stores') ?? '0');
  const currentTemplateVersion = readArg('template-version');
  const currentDataVersion = readArg('data-version');

  if (!shardId || !projectId || !siteId) {
    console.error(
      'Usage: npm run register-shard -- --shard-id=<id> --project-id=<project> --site-id=<site> [--environment=production|development] [--region=us-central1] [--status=active|draining|maintenance] [--max-stores=100] [--reserved-stores=0] [--template-version=x.y.z] [--data-version=x.y.z]',
    );
    process.exit(1);
  }

  if (!Number.isFinite(maxStores) || maxStores <= 0) {
    console.error('--max-stores must be a positive number.');
    process.exit(1);
  }

  if (!Number.isFinite(reservedStores) || reservedStores < 0) {
    console.error('--reserved-stores must be a non-negative number.');
    process.exit(1);
  }

  return {
    shardId,
    projectId,
    siteId,
    region,
    environment,
    status,
    maxStores,
    reservedStores,
    currentTemplateVersion: currentTemplateVersion || undefined,
    currentDataVersion: currentDataVersion || undefined,
  };
}

const args = parseArgs();
initializeApp({
  projectId: args.environment === 'development' ? 'vertex-platform-dev' : 'vertex-platform-app',
});

void (async () => {
  const db = getFirestore();
  const ref = db.collection('shards').doc(args.shardId);
  const now = new Date();

  await ref.set(
    {
      id: args.shardId,
      environment: args.environment,
      runtimeMode: 'shared-shard',
      projectId: args.projectId,
      siteId: args.siteId,
      region: args.region,
      status: args.status,
      maxStores: args.maxStores,
      activeStores: 0,
      reservedStores: args.reservedStores,
      currentTemplateVersion: args.currentTemplateVersion ?? null,
      currentDataVersion: args.currentDataVersion ?? null,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );

  console.log(`Registered shared shard ${args.shardId} for ${args.environment}.`);
})();
