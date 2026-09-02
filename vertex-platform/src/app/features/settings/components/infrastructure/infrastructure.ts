import type { OnInit } from '@angular/core';
import { Component, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BillingAccountsService } from '@core/services/billing-accounts';
import {
  StoresService,
  type RuntimeCapacitySummary,
  type ShardReadiness,
  type ShardReadinessReport,
  type RuntimeShardCapacity,
} from '@core/services/stores';
import type { BillingAccount } from '@core/models/billing-account';
import { errorMessage } from '@core/utils/error.util';
import { ShardStatusModal } from './shard-status-modal';

export interface MergedShard extends ShardReadiness {
  currentStores: number;
  reservedStores: number;
  maxCapacity: number;
  availableStores: number;
  occupancyRatio: number;
  runtimeStatus: string;
}

@Component({
  selector: 'app-infrastructure',
  standalone: true,
  imports: [RouterLink, ShardStatusModal, DecimalPipe],
  templateUrl: './infrastructure.html',
  styleUrl: './infrastructure.scss',
})
export class Infrastructure implements OnInit {
  readonly svc = inject(BillingAccountsService);
  readonly storesSvc = inject(StoresService);

  readonly runtimeSummary = signal<RuntimeCapacitySummary | null>(null);
  readonly readiness = signal<ShardReadinessReport | null>(null);
  readonly isCheckingShards = signal(false);
  readonly selectedShard = signal<ShardReadiness | null>(null);
  readonly copiedId = signal<string | null>(null);
  readonly activeTab = signal<'shards' | 'accounts' | 'guide'>('shards');
  readonly shardSearchQuery = signal('');

  // Add Account form signals
  readonly isAddingAccount = signal(false);
  readonly newAccountId = signal('');
  readonly newAccountName = signal('');
  readonly newAccountLimit = signal(5);
  readonly isAdding = signal(false);
  readonly addAccountError = signal('');

  readonly sortedShards = computed<MergedShard[]>(() => {
    const report = this.readiness();
    if (!report || !report.shards) {
      return [];
    }
    const summary = this.runtimeSummary();
    const runtimeMap = new Map<string, RuntimeShardCapacity>();
    if (summary && summary.shards) {
      for (const s of summary.shards) {
        runtimeMap.set(s.id, s);
      }
    }

    const merged: MergedShard[] = report.shards.map((r) => {
      const rt = runtimeMap.get(r.id);
      return {
        ...r,
        currentStores: rt?.currentStores ?? 0,
        reservedStores: rt?.reservedStores ?? 0,
        maxCapacity: rt?.maxCapacity ?? 35,
        availableStores: rt?.availableStores ?? 35,
        occupancyRatio: rt?.occupancyRatio ?? 0,
        runtimeStatus: rt?.status ?? r.status,
      };
    });

    return merged.sort((a, b) => {
      const isP1A = (a.status === 'ACTIVE' || a.status === 'WARMUP_READY') && a.currentStores > 0;
      const isP1B = (b.status === 'ACTIVE' || b.status === 'WARMUP_READY') && b.currentStores > 0;
      if (isP1A !== isP1B) {
        return isP1A ? -1 : 1;
      }

      const isP2A = a.ready;
      const isP2B = b.ready;
      if (isP2A !== isP2B) {
        return isP2A ? -1 : 1;
      }

      const isP3A = a.status === 'ACTIVE' || a.status === 'WARMUP_READY';
      const isP3B = b.status === 'ACTIVE' || b.status === 'WARMUP_READY';
      if (isP3A !== isP3B) {
        return isP3A ? -1 : 1;
      }

      return a.id.localeCompare(b.id);
    });
  });

  readonly filteredShards = computed<MergedShard[]>(() => {
    const query = this.shardSearchQuery().trim().toLowerCase();
    const list = this.sortedShards();
    if (!query) {
      return list;
    }
    return list.filter((s) => s.id.toLowerCase().includes(query));
  });

  readonly totalAvailableStores = computed(() => {
    const shards = this.sortedShards();
    if (!shards.length) {
      return 150;
    }
    return shards.reduce((sum, s) => sum + s.availableStores, 0);
  });

  readonly activeAvailableStores = computed(() => {
    const shards = this.sortedShards();
    if (!shards.length) {
      return 120;
    }
    return shards
      .filter((s) => s.status === 'ACTIVE')
      .reduce((sum, s) => sum + s.availableStores, 0);
  });

  readonly standbyAvailableStores = computed(() => {
    const shards = this.sortedShards();
    if (!shards.length) {
      return 30;
    }
    return shards
      .filter((s) => s.status === 'WARMUP_READY')
      .reduce((sum, s) => sum + s.availableStores, 0);
  });

  readonly activeShardsCount = computed(() => {
    const shards = this.sortedShards();
    if (!shards.length) {
      return 4;
    }
    return shards.filter((s) => s.status === 'ACTIVE').length;
  });

  readonly pendingShardsCount = computed(() => {
    const shards = this.sortedShards();
    return shards.filter((s) => s.status === 'WARMUP_PENDING').length;
  });

  readonly isInitialLoading = computed(() => {
    return this.svc.isLoading() && !this.readiness();
  });

  readonly isCriticalGcp = computed(() => {
    return this.totalAvailableStores() <= 25;
  });

  readonly isWarningShards = computed(() => {
    return !this.isCriticalGcp() && this.activeShardsCount() <= 2;
  });

  ngOnInit(): void {
    void this.refreshData();
  }

  async refreshData(): Promise<void> {
    await Promise.all([this.loadReadiness(), this.loadRuntimeSummary()]);
  }

  async loadRuntimeSummary(): Promise<void> {
    try {
      const summary = await this.storesSvc.getRuntimeCapacitySummary();
      this.runtimeSummary.set(summary);
    } catch {
      // Fallback
    }
  }

  async loadReadiness(): Promise<void> {
    this.isCheckingShards.set(true);
    try {
      const report = await this.storesSvc.getShardReadiness();
      this.readiness.set(report);
    } catch {
      // Ignorar errores transitorios
    } finally {
      this.isCheckingShards.set(false);
    }
  }

  openShardModal(shard: ShardReadiness): void {
    this.selectedShard.set(shard);
  }

  closeShardModal(): void {
    this.selectedShard.set(null);
  }

  openAddAccount(): void {
    this.isAddingAccount.set(true);
    this.addAccountError.set('');
  }

  cancelAddAccount(): void {
    this.isAddingAccount.set(false);
    this.newAccountId.set('');
    this.newAccountName.set('');
    this.newAccountLimit.set(5);
    this.addAccountError.set('');
  }

  async addAccount(): Promise<void> {
    const id = this.newAccountId().trim();
    const name = this.newAccountName().trim();
    const limit = this.newAccountLimit();

    if (!id || !name) {
      this.addAccountError.set('Por favor completa el ID y el nombre.');
      return;
    }

    this.isAdding.set(true);
    this.addAccountError.set('');

    try {
      await this.svc.addAccount({ id, name, gcpProjectLimit: limit });
      this.cancelAddAccount();
    } catch (err: unknown) {
      this.addAccountError.set(errorMessage(err));
    } finally {
      this.isAdding.set(false);
    }
  }

  async syncAccounts(): Promise<void> {
    await this.svc.loadAccounts();
    await this.refreshData();
  }

  async toggleAccountStatus(acc: BillingAccount): Promise<void> {
    const newActive = !acc.active;
    try {
      await this.svc.updateAccount({ id: acc.id, active: newActive });
    } catch (err: unknown) {
      this.svc.error.set(errorMessage(err));
    }
  }

  async updateAccountLimit(acc: BillingAccount, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const limit = parseInt(input.value, 10);
    if (isNaN(limit) || limit < 1) {
      return;
    }
    try {
      await this.svc.updateAccount({ id: acc.id, gcpProjectLimit: limit });
    } catch (err: unknown) {
      this.svc.error.set(errorMessage(err));
    }
  }

  copyToClipboard(text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    this.copiedId.set(text);
    setTimeout(() => {
      this.copiedId.set(null);
    }, 2000);
  }
}
