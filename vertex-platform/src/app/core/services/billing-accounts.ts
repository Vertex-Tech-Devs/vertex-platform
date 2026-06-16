import { Injectable, signal } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { BillingAccount } from '@core/models/billing-account';

interface RawAccount {
  id: string;
  name: string;
  maxProjects: number;
  active: boolean;
  addedAt: string | null;
  usedProjects: number;
}

@Injectable({ providedIn: 'root' })
export class BillingAccountsService {
  private fns = getFunctions();

  readonly accounts = signal<BillingAccount[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  async loadAccounts(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const fn = httpsCallable<void, { accounts: RawAccount[] }>(this.fns, 'listBillingAccounts');
      const result = await fn();
      this.accounts.set(
        result.data.accounts.map((a) => ({
          ...a,
          addedAt: a.addedAt ? new Date(a.addedAt) : null,
        })),
      );
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al cargar billing accounts.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async addAccount(payload: { id: string; name: string; maxProjects?: number }): Promise<void> {
    const fn = httpsCallable(this.fns, 'addBillingAccount');
    await fn(payload);
    await this.loadAccounts();
  }

  async updateAccount(payload: {
    id: string;
    name?: string;
    maxProjects?: number;
    active?: boolean;
  }): Promise<void> {
    const fn = httpsCallable(this.fns, 'updateBillingAccount');
    await fn(payload);
    await this.loadAccounts();
  }

  async removeAccount(id: string): Promise<void> {
    const fn = httpsCallable(this.fns, 'removeBillingAccount');
    await fn({ id });
    await this.loadAccounts();
  }
}
