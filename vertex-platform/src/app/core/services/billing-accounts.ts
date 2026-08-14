import { Injectable, signal, computed } from '@angular/core';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { BillingAccount } from '@core/models/billing-account';

interface RawAccount {
  id: string;
  name: string;
  maxProjects: number;
  active: boolean;
  addedAt: string | null;
  usedProjects: number;
  gcpProjectLimit: number;
  gcpUsedProjects: number;
  gcpRemaining: number;
  gcpUsageRatio: number;
}

@Injectable({ providedIn: 'root' })
export class BillingAccountsService {
  private fns = getFunctions();
  private db = getFirestore();

  readonly accounts = signal<BillingAccount[]>([]);
  readonly isLoading = signal(false);
  readonly isSyncing = signal(false);
  readonly error = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly activeAccountsCount = computed(() => this.accounts().filter((a) => a.active).length);
  readonly totalGcpLimit = computed(() => this.accounts().reduce((sum, a) => sum + (a.gcpProjectLimit || 5), 0));
  readonly totalGcpUsed = computed(() => this.accounts().reduce((sum, a) => sum + (a.gcpUsedProjects || 0), 0));
  readonly totalGcpRemaining = computed(() => Math.max(0, this.totalGcpLimit() - this.totalGcpUsed()));
  readonly usagePercent = computed(() =>
    this.totalGcpLimit() > 0 ? Math.round((this.totalGcpUsed() / this.totalGcpLimit()) * 100) : 0,
  );

  constructor() {
    this.initFirestoreListener();
  }

  private initFirestoreListener(): void {
    this.isLoading.set(true);
    const primaryRef = collection(this.db, 'billing_accounts');

    onSnapshot(
      primaryRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((doc) => this.mapDocToBillingAccount(doc.id, doc.data()));
          this.accounts.set(list);
          this.isLoading.set(false);
        } else {
          // Fallback to billingAccounts collection
          const fallbackRef = collection(this.db, 'billingAccounts');
          onSnapshot(
            fallbackRef,
            (fbSnap) => {
              const list = fbSnap.docs.map((doc) => this.mapDocToBillingAccount(doc.id, doc.data()));
              this.accounts.set(list);
              this.isLoading.set(false);
            },
            (err) => {
              console.warn('[BillingAccountsService] Fallback listener error:', err);
              this.isLoading.set(false);
            },
          );
        }
      },
      (err) => {
        console.warn('[BillingAccountsService] Primary listener error:', err);
        this.isLoading.set(false);
      },
    );
  }

  private mapDocToBillingAccount(id: string, data: Record<string, unknown>): BillingAccount {
    const active = data['status'] ? data['status'] === 'ACTIVE' : data['active'] !== false;
    const gcpProjectLimit = Number(data['maxProjects'] ?? data['gcpProjectLimit'] ?? 5);
    const gcpUsedProjects = Number(data['currentProjects'] ?? data['gcpUsedProjects'] ?? data['usedProjects'] ?? 0);
    const gcpRemaining = Math.max(0, gcpProjectLimit - gcpUsedProjects);
    const gcpUsageRatio = gcpProjectLimit > 0 ? Math.min(1, gcpUsedProjects / gcpProjectLimit) : 0;

    let addedAt: Date | null = null;
    if (data['createdAt'] && typeof data['createdAt'] === 'object' && 'toDate' in data['createdAt']) {
      addedAt = (data['createdAt'] as { toDate: () => Date }).toDate();
    } else if (data['addedAt']) {
      addedAt = new Date(data['addedAt'] as string);
    }

    return {
      id: typeof data['accountId'] === 'string' && data['accountId'] ? data['accountId'] : id,
      name: typeof data['name'] === 'string' && data['name'] ? data['name'] : id,
      maxProjects: gcpProjectLimit,
      active,
      addedAt,
      usedProjects: gcpUsedProjects,
      gcpProjectLimit,
      gcpUsedProjects,
      gcpRemaining,
      gcpUsageRatio,
    };
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 3500);
  }

  async loadAccounts(): Promise<void> {
    this.isSyncing.set(true);
    this.error.set(null);
    try {
      const fn = httpsCallable<void, { accounts: RawAccount[] }>(this.fns, 'listBillingAccounts');
      const result = await fn();
      if (result.data?.accounts && result.data.accounts.length > 0) {
        this.accounts.set(
          result.data.accounts.map((a) => ({
            ...a,
            addedAt: a.addedAt ? new Date(a.addedAt) : null,
          })),
        );
      }
      this.showToast('Cuentas de facturación sincronizadas correctamente con GCP.');
    } catch (err: unknown) {
      if (this.accounts().length === 0) {
        this.error.set(err instanceof Error ? err.message : 'Error al cargar billing accounts.');
      } else {
        this.showToast('Cuentas cargadas desde Firestore.');
      }
    } finally {
      this.isLoading.set(false);
      this.isSyncing.set(false);
    }
  }

  async addAccount(payload: {
    id: string;
    name: string;
    maxProjects?: number;
    gcpProjectLimit?: number;
  }): Promise<void> {
    const fn = httpsCallable<typeof payload, { success: boolean }>(this.fns, 'addBillingAccount');
    await fn(payload);
    await this.loadAccounts();
  }

  async updateAccount(payload: {
    id: string;
    name?: string;
    maxProjects?: number;
    active?: boolean;
    gcpProjectLimit?: number;
  }): Promise<void> {
    const fn = httpsCallable<typeof payload, { success: boolean }>(
      this.fns,
      'updateBillingAccount',
    );
    await fn(payload);
    await this.loadAccounts();
  }

  async removeAccount(id: string): Promise<void> {
    const fn = httpsCallable<{ id: string }, { success: boolean }>(
      this.fns,
      'removeBillingAccount',
    );
    await fn({ id });
    await this.loadAccounts();
  }
}
