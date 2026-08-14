import type { OnInit } from '@angular/core';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingAccountsService } from '@core/services/billing-accounts';
import {
  StoresService,
  type RuntimeCapacitySummary,
  type ShardReadiness,
  type ShardReadinessReport,
} from '@core/services/stores';
import type { BillingAccount } from '@core/models/billing-account';
import { errorMessage } from '@core/utils/error.util';
import { ShardStatusModal } from './shard-status-modal';

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

  async checkShards(): Promise<void> {
    this.isCheckingShards.set(true);
    try {
      this.readiness.set(await this.storesSvc.getShardReadiness());
    } catch {
      /* silent catch */
    } finally {
      this.isCheckingShards.set(false);
    }
  }

  async syncAccounts(): Promise<void> {
    await this.svc.loadAccounts();
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

  totalGcpUsed(): number {
    return this.svc.totalGcpUsed();
  }

  totalGcpLimit(): number {
    return this.svc.totalGcpLimit();
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
    this.removingId.set(a.id);
    try {
      await this.svc.removeAccount(a.id);
    } catch (err: unknown) {
      alert(errorMessage(err, 'Error al eliminar.'));
    } finally {
      this.removingId.set(null);
    }
  }
}
