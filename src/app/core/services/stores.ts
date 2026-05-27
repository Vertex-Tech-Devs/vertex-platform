import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import type {
  Store,
  CreateStorePayload,
  StoreConfig,
  StaffMember,
  PendingInvitation,
  TemplateVersion,
} from '../models/store';

export interface DnsRecord {
  host: string;
  type: string;
  value: string;
  requiredAction: string;
}

export interface DeploymentHistoryItem {
  id: number;
  runNumber: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  displayTitle: string;
}

export interface RuntimeShardCapacity {
  id: string;
  projectId: string;
  siteId: string;
  region: string;
  status: 'active' | 'draining' | 'maintenance';
  activeStores: number;
  reservedStores: number;
  maxStores: number;
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

@Injectable({ providedIn: 'root' })
export class StoresService {
  private db = getFirestore();
  private fns = getFunctions();
  private storesRef = collection(this.db, 'stores');

  readonly stores = toSignal(
    new Observable<Store[]>((subscriber) => {
      const unsub = onSnapshot(this.storesRef, (snap) =>
        subscriber.next(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Store)),
      );
      return unsub;
    }),
    { initialValue: [] },
  );

  async createStore(payload: CreateStorePayload): Promise<string> {
    const fn = httpsCallable<CreateStorePayload, { storeId: string }>(this.fns, 'provisionStore');
    const result = await fn(payload);
    return result.data.storeId;
  }

  async getRuntimeCapacitySummary(): Promise<RuntimeCapacitySummary> {
    const fn = httpsCallable<Record<string, never>, { summary: RuntimeCapacitySummary }>(
      this.fns,
      'getRuntimeCapacitySummary',
    );
    const result = await fn({});
    return result.data.summary;
  }

  async redeployStore(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'redeployStore');
    await fn({ storeId });
  }

  async deleteStore(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'deleteStore');
    await fn({ storeId });
  }

  async connectDomain(storeId: string, domain: string): Promise<{ dnsRecords: DnsRecord[] }> {
    const fn = httpsCallable<
      { storeId: string; domain: string },
      { success: boolean; dnsRecords: RawDnsRecord[] }
    >(this.fns, 'connectDomain');
    const result = await fn({ storeId, domain });
    return { dnsRecords: mapDnsRecords(result.data.dnsRecords) };
  }

  async updateStore(
    id: string,
    data: Partial<Pick<Store, 'name' | 'ownerEmail' | 'logoUrl'>>,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), { ...data, updatedAt: serverTimestamp() });
  }

  async setStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), { status, updatedAt: serverTimestamp() });
  }

  async retryProvisioning(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(
      this.fns,
      'retryProvisioning',
    );
    await fn({ storeId });
  }

  async getDeploymentHistory(projectId: string): Promise<DeploymentHistoryItem[]> {
    const fn = httpsCallable<{ projectId: string }, { history: DeploymentHistoryItem[] }>(
      this.fns,
      'getStoreDeploymentHistory',
    );
    const result = await fn({ projectId });
    return result.data.history;
  }

  async updateStoreConfig(storeId: string, config: Partial<StoreConfig>): Promise<void> {
    const fn = httpsCallable<
      { storeId: string; config: Partial<StoreConfig> },
      { success: boolean }
    >(this.fns, 'updateStoreConfig');
    await fn({ storeId, config });
  }

  async getStoreStaff(
    storeId: string,
  ): Promise<{ staff: StaffMember[]; invitations: PendingInvitation[] }> {
    const fn = httpsCallable<
      { storeId: string },
      { success: boolean; staff: StaffMember[]; invitations: PendingInvitation[] }
    >(this.fns, 'getStoreStaff');
    const result = await fn({ storeId });
    return {
      staff: result.data.staff ?? [],
      invitations: result.data.invitations ?? [],
    };
  }

  async inviteStaff(
    storeId: string,
    email: string,
    role: string,
  ): Promise<{ inviteEmailSent: boolean }> {
    const fn = httpsCallable<
      { storeId: string; email: string; role: string },
      { success: boolean; inviteEmailSent?: boolean }
    >(this.fns, 'inviteStaff');
    const result = await fn({ storeId, email, role });
    return { inviteEmailSent: result.data.inviteEmailSent !== false };
  }

  async generatePasswordResetLink(
    storeId: string,
    email: string,
  ): Promise<{ success: boolean; actionLink: string }> {
    const fn = httpsCallable<
      { storeId: string; email: string },
      { success: boolean; actionLink: string }
    >(this.fns, 'generatePasswordResetLink');
    const result = await fn({ storeId, email });
    return result.data;
  }

  async verifyDomain(
    storeId: string,
    domain: string,
  ): Promise<{ status: 'live' | 'pending'; dnsRecords: DnsRecord[] }> {
    const fn = httpsCallable<
      { storeId: string; domain: string },
      { success: boolean; status: string; dnsRecords: RawDnsRecord[] }
    >(this.fns, 'verifyDomainDNSStatus');
    const result = await fn({ storeId, domain });
    const normalizedStatus = normalizeDomainStatus(result.data.status);
    return {
      status: normalizedStatus,
      dnsRecords: mapDnsRecords(result.data.dnsRecords),
    };
  }

  async getStoreConfig(storeId: string): Promise<StoreConfig | null> {
    const fn = httpsCallable<{ storeId: string }, { config: StoreConfig | null }>(
      this.fns,
      'getStoreConfig',
    );
    const result = await fn({ storeId });
    return result.data.config;
  }

  async seedStore(storeId: string, includeMockData = true): Promise<void> {
    const fn = httpsCallable<{ storeId: string; includeMockData: boolean }, { success: boolean }>(
      this.fns,
      'seedStore',
    );
    await fn({ storeId, includeMockData });
  }

  async listTemplateVersions(): Promise<TemplateVersion[]> {
    const fn = httpsCallable<Record<string, never>, { versions: TemplateVersion[] }>(
      this.fns,
      'listTemplateVersions',
    );
    const result = await fn({});
    return result.data.versions;
  }

  async updateStoreVersion(storeId: string, version: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string; version: string }, { success: boolean }>(
      this.fns,
      'updateStoreVersion',
    );
    await fn({ storeId, version });
  }
}

interface RawDnsRecord {
  domainName?: string;
  type?: string;
  rdata?: string;
  value?: string;
  requiredAction?: string;
}

function normalizeDomainStatus(status: string | undefined): 'live' | 'pending' {
  const normalized = (status || '').trim().toUpperCase();
  return normalized === 'LIVE' || normalized === 'ACTIVE' ? 'live' : 'pending';
}

function mapDnsRecords(records: RawDnsRecord[] | undefined): DnsRecord[] {
  return (records ?? []).map((record) => ({
    host: record.domainName || '@',
    type: record.type || inferDnsType(record.requiredAction),
    value: record.rdata || record.value || '',
    requiredAction: record.requiredAction || 'ADD',
  }));
}

function inferDnsType(requiredAction?: string): string {
  const action = (requiredAction || '').toUpperCase();
  if (action.includes('TXT')) {
    return 'TXT';
  }
  if (action.includes('AAAA')) {
    return 'AAAA';
  }
  if (action.includes('CNAME')) {
    return 'CNAME';
  }
  return 'A';
}
