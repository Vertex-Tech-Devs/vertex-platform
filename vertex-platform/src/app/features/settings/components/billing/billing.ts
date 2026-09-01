import type { OnInit } from '@angular/core';
import { Component, inject, signal, computed } from '@angular/core';
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
  selector: 'app-billing',
  standalone: true,
  imports: [RouterLink, ShardStatusModal],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
})
export class Billing implements OnInit {
  readonly svc = inject(BillingAccountsService);
  readonly storesSvc = inject(StoresService);

  readonly runtimeSummary = signal<RuntimeCapacitySummary | null>(null);
  readonly readiness = signal<ShardReadinessReport | null>(null);
  readonly isCheckingShards = signal(false);
  readonly selectedShard = signal<ShardReadiness | null>(null);
  readonly copiedId = signal<string | null>(null);
  readonly showCapacityGuide = signal(false);
  readonly activeTab = signal<'accounts' | 'shards' | 'guide'>('accounts');
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

      if (a.currentStores !== b.currentStores) {
        return b.currentStores - a.currentStores;
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  });

  readonly filteredShards = computed<MergedShard[]>(() => {
    const q = this.shardSearchQuery().trim().toLowerCase();
    const list = this.sortedShards();
    if (!q) {
      return list;
    }
    return list.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.projectId.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q),
    );
  });

  readonly isInitialLoading = computed(() => this.svc.isLoading() || !this.readiness());

  readonly activeShardsCount = computed(() => {
    const list = this.sortedShards();
    const count = list.filter((s) => s.status === 'ACTIVE' || s.ready).length;
    return count > 0 ? count : (this.readiness()?.readyCount ?? 13);
  });

  readonly activeAvailableStores = computed(() => {
    const list = this.sortedShards();
    if (list.length > 0) {
      return list
        .filter((s) => s.status === 'ACTIVE' || s.ready)
        .reduce((sum, s) => sum + s.availableStores, 0);
    }
    const r = this.readiness();
    if (r && r.readyCount > 0) {
      return r.readyCount * 35;
    }
    return 454;
  });

  readonly standbyAvailableStores = computed(() => {
    return this.sortedShards()
      .filter((s) => s.status === 'STANDBY' && !s.ready)
      .reduce((sum, s) => sum + s.availableStores, 0);
  });

  readonly totalAvailableStores = computed(() => this.activeAvailableStores());

  readonly isCriticalGcp = computed(() => {
    if (this.isInitialLoading()) {
      return false;
    }
    const available = this.activeAvailableStores();
    const readyCount = this.readiness()?.readyCount ?? this.activeShardsCount();
    return readyCount === 0 || available <= 25 || (this.svc.totalGcpRemaining() <= 1 && readyCount <= 1);
  });

  readonly isWarningShards = computed(() => {
    if (this.isInitialLoading() || this.isCriticalGcp()) {
      return false;
    }
    const available = this.activeAvailableStores();
    const readyCount = this.readiness()?.readyCount ?? this.activeShardsCount();
    return (readyCount <= 2 || available <= 70) && this.pendingShardsCount() > 0;
  });
  readonly isOptimalCapacity = computed(() => !this.isCriticalGcp() && !this.isWarningShards());

  readonly pendingShardsCount = computed(() => {
    const r = this.readiness();
    if (!r) {
      return 0;
    }
    return Math.max(0, r.total - r.readyCount);
  });

  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editGcpLimit = signal(5);
  readonly isSaving = signal(false);
  readonly saveError = signal('');

  readonly removingId = signal<string | null>(null);
  readonly togglingId = signal<string | null>(null);

  ngOnInit(): void {
    void this.svc.loadAccounts();
    void this.loadRuntime();
    void this.checkShards();
  }

  private async loadRuntime(): Promise<void> {
    try {
      this.runtimeSummary.set(await this.storesSvc.getRuntimeCapacitySummary());
    } catch {
      /* silent catch */
    }
  }

  async checkShards(forceRefresh = true): Promise<void> {
    this.isCheckingShards.set(true);
    try {
      this.readiness.set(await this.storesSvc.getShardReadiness(forceRefresh));
    } catch {
      /* silent catch */
    } finally {
      this.isCheckingShards.set(false);
    }
  }

  async syncAccounts(): Promise<void> {
    try {
      await this.svc.loadAccounts();
      await this.loadRuntime();
      await this.checkShards(true);
    } catch {
      /* silent catch */
    }
  }

  toggleCapacityGuide(): void {
    this.showCapacityGuide.set(!this.showCapacityGuide());
  }

  copyAccountId(id: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(id);
      this.copiedId.set(id);
      this.svc.showToast(`ID de cuenta copiado: ${id}`);
      setTimeout(() => {
        if (this.copiedId() === id) {
          this.copiedId.set(null);
        }
      }, 3000);
    }
  }

  readyRatio(): number {
    const r = this.readiness();
    if (!r || r.total === 0) {
      return 0;
    }
    return Math.round((r.readyCount / r.total) * 100);
  }

  /** % REAL de GCP: proyectos vinculados / límite de la billing account. */
  gcpUsagePercent(a: BillingAccount): number {
    if (!a.gcpProjectLimit) {
      return 0;
    }
    return Math.round((a.gcpUsedProjects / a.gcpProjectLimit) * 100);
  }

  gcpUsageClass(a: BillingAccount): string {
    const p = this.gcpUsagePercent(a);
    if (p >= 90) {
      return 'usage--critical';
    }
    if (p >= 70) {
      return 'usage--warning';
    }
    return 'usage--ok';
  }

  startEdit(a: BillingAccount): void {
    this.editingId.set(a.id);
    this.editName.set(a.name);
    this.editGcpLimit.set(a.gcpProjectLimit || 5);
    this.saveError.set('');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.saveError.set('');
  }

  async saveEdit(id: string): Promise<void> {
    this.isSaving.set(true);
    this.saveError.set('');
    try {
      await this.svc.updateAccount({
        id,
        name: this.editName().trim(),
        gcpProjectLimit: this.editGcpLimit(),
      });
      this.editingId.set(null);
    } catch (err: unknown) {
      this.saveError.set(errorMessage(err, 'Error al guardar.'));
    } finally {
      this.isSaving.set(false);
    }
  }

  async toggleActive(a: BillingAccount): Promise<void> {
    this.togglingId.set(a.id);
    try {
      await this.svc.updateAccount({ id: a.id, active: !a.active });
    } finally {
      this.togglingId.set(null);
    }
  }

  async remove(a: BillingAccount): Promise<void> {
    if (!confirm(`¿Eliminar la cuenta de facturación "${a.name}" (${a.id})?`)) {
      return;
    }
    this.removingId.set(a.id);
    try {
      await this.svc.removeAccount(a.id);
    } catch (err: unknown) {
      alert(errorMessage(err, 'Error al eliminar.'));
    } finally {
      this.removingId.set(null);
    }
  }

  totalGcpUsed(): number {
    return this.svc.totalGcpUsed();
  }

  totalGcpLimit(): number {
    return this.svc.totalGcpLimit();
  }

  scrollToShards(): void {
    this.activeTab.set('shards');
    if (typeof document !== 'undefined') {
      const el = document.getElementById('shards-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  openAddAccount(): void {
    this.isAddingAccount.set(true);
    this.newAccountId.set('');
    this.newAccountName.set('');
    this.newAccountLimit.set(5);
    this.addAccountError.set('');
  }

  cancelAddAccount(): void {
    this.isAddingAccount.set(false);
    this.addAccountError.set('');
  }

  async addAccount(): Promise<void> {
    const id = this.newAccountId().trim();
    const name = this.newAccountName().trim();
    const limit = this.newAccountLimit();

    if (!id || !name) {
      this.addAccountError.set('Por favor completa el ID y el Nombre de la cuenta.');
      return;
    }

    this.isAdding.set(true);
    this.addAccountError.set('');
    try {
      await this.svc.addAccount({
        id,
        name,
        gcpProjectLimit: limit,
      });
      this.isAddingAccount.set(false);
      this.svc.showToast(`Cuenta "${name}" vinculada con éxito.`);
    } catch (err: unknown) {
      this.addAccountError.set(errorMessage(err, 'Error al vincular la cuenta de facturación.'));
    } finally {
      this.isAdding.set(false);
    }
  }
}
