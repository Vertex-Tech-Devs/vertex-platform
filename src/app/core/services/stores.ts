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

import type { Store, CreateStorePayload } from '../models/store';

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
    data: Partial<Pick<Store, 'name' | 'plan' | 'ownerEmail' | 'logoUrl'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), { ...data, updatedAt: serverTimestamp() });
  }

  async setStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), { status, updatedAt: serverTimestamp() });
  }
}

