export interface DnsRecord {
  host: string;
  type: string;
  value: string;
  requiredAction: string;
}

export interface RawDnsRecord {
  domainName?: string;
  type?: string;
  rdata?: string;
  value?: string;
  requiredAction?: string;
}

export function inferDnsType(action = ''): string {
  const a = action.toUpperCase();
  if (a.includes('TXT')) {
    return 'TXT';
  }
  if (a.includes('AAAA')) {
    return 'AAAA';
  }
  if (a.includes('CNAME')) {
    return 'CNAME';
  }
  return 'A';
}

export function normalizeDomainStatus(status: string | undefined): 'live' | 'pending' {
  const n = (status || '').trim().toUpperCase();
  return n === 'LIVE' || n === 'ACTIVE' ? 'live' : 'pending';
}

export function mapDnsRecords(records: RawDnsRecord[] | undefined): DnsRecord[] {
  return (records ?? []).map((r) => ({
    host: r.domainName || '@',
    type: r.type || inferDnsType(r.requiredAction),
    value: r.rdata || r.value || '',
    requiredAction: r.requiredAction || 'ADD',
  }));
}

export interface RuntimeShardCapacity {
  id: string;
  projectId: string;
  siteId: string;
  region: string;
  status: 'ACTIVE' | 'FULL' | 'DRAINING' | 'MAINTENANCE' | 'WARMUP_READY' | 'WARMUP_PROVISIONING';
  currentStores: number;
  reservedStores: number;
  maxCapacity: number;
  availableStores: number;
  occupancyRatio: number;
}

export interface RuntimeCapacitySummary {
  environment: 'development' | 'production';
  sharedShardCount: number;
  activeSharedShardCount: number;
  availableSharedSlots: number;
  recommendedRuntimeMode: 'shared-shard' | 'dedicated-project';
  shards: RuntimeShardCapacity[];
}

export type ShardReadinessReason = 'status' | 'billing' | 'redirect_uri';

export interface ShardReadiness {
  id: string;
  projectId: string;
  status: string;
  billingAccountId: string;
  redirectUri: string;
  ready: boolean;
  missing: ShardReadinessReason[];
  checkedAt: string;
}

export interface ShardReadinessReport {
  environment: 'development' | 'production';
  total: number;
  readyCount: number;
  checkedAt: string;
  shards: ShardReadiness[];
}
