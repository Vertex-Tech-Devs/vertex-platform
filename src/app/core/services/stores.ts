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

import type { Store, CreateStorePayload, StoreConfig, StaffMember, PendingInvitation } from '../models/store';

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

@Injectable({ providedIn: 'root' })
export class StoresService {
  private db = getFirestore();
  private fns = getFunctions();
  private storesRef = collection(this.db, 'stores');

  readonly stores = toSignal(
    new Observable<Store[]>((subscriber) => {
      const unsub = onSnapshot(this.storesRef, (snap) =>
        subscriber.next(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Store)))
      );
      return unsub;
    }),
    { initialValue: [] }
  );

  async createStore(payload: CreateStorePayload): Promise<string> {
    const fn = httpsCallable<CreateStorePayload, { storeId: string }>(this.fns, 'provisionStore');
    const result = await fn(payload);
    return result.data.storeId;
  }

  async redeployStore(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'redeployStore');
    await fn({ storeId });
  }

  async deleteStore(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'deleteStore');
    await fn({ storeId });
  }

  async connectDomain(
    storeId: string,
    domain: string
  ): Promise<{ dnsRecords: Array<{ rdata: string; requiredAction: string }> }> {
    const fn = httpsCallable<
      { storeId: string; domain: string },
      { success: boolean; dnsRecords: Array<{ rdata: string; requiredAction: string }> }
    >(this.fns, 'connectDomain');
    const result = await fn({ storeId, domain });
    return { dnsRecords: result.data.dnsRecords };
  }

  async updateStore(
    id: string,
    data: Partial<Pick<Store, 'name' | 'ownerEmail' | 'logoUrl'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), { ...data, updatedAt: serverTimestamp() });
  }

  async setStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), { status, updatedAt: serverTimestamp() });
  }

  async retryProvisioning(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'retryProvisioning');
    await fn({ storeId });
  }

  async getDeploymentHistory(projectId: string): Promise<DeploymentHistoryItem[]> {
    const fn = httpsCallable<{ projectId: string }, { history: DeploymentHistoryItem[] }>(this.fns, 'getStoreDeploymentHistory');
    const result = await fn({ projectId });
    return result.data.history;
  }

  async updateStoreConfig(storeId: string, config: Partial<StoreConfig>): Promise<void> {
    const fn = httpsCallable<{ storeId: string; config: Partial<StoreConfig> }, { success: boolean }>(
      this.fns,
      'updateStoreConfig'
    );
    await fn({ storeId, config });
  }

  async getStoreStaff(storeId: string): Promise<{ staff: StaffMember[]; invitations: PendingInvitation[] }> {
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

  async inviteStaff(storeId: string, email: string, role: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string; email: string; role: string }, { success: boolean }>(
      this.fns,
      'inviteStaff'
    );
    await fn({ storeId, email, role });
  }

  async verifyDomain(
    storeId: string,
    domain: string
  ): Promise<{ status: 'live' | 'pending'; dnsRecords: Array<{ rdata: string; requiredAction: string }> }> {
    const fn = httpsCallable<
      { storeId: string; domain: string },
      { success: boolean; status: 'live' | 'pending'; dnsRecords: Array<{ rdata: string; requiredAction: string }> }
    >(this.fns, 'verifyDomainDNSStatus');
    const result = await fn({ storeId, domain });
    return {
      status: result.data.status,
      dnsRecords: blockDnsRecords(result.data.dnsRecords),
    };
  }

  async getStoreConfig(storeId: string): Promise<StoreConfig | null> {
    const fn = httpsCallable<{ storeId: string }, { config: StoreConfig | null }>(this.fns, 'getStoreConfig');
    const result = await fn({ storeId });
    return result.data.config;
  }
}

interface RawDnsRecord {
  rdata?: string;
  requiredAction?: string;
  type?: string;
}

function blockDnsRecords(records: RawDnsRecord[]): Array<{ rdata: string; requiredAction: string }> {
  return (records ?? []).map(r => ({
    rdata: r.rdata ?? '',
    requiredAction: r.requiredAction ?? r.type ?? 'TXT'
  }));
}
