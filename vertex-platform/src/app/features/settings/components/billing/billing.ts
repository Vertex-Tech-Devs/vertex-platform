import type { OnInit } from '@angular/core';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { BillingAccountsService } from '@core/services/billing-accounts';
import type { BillingAccount } from '@core/models/billing-account';
import { errorMessage } from '@core/utils/error.util';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
})
export class Billing implements OnInit {
  readonly svc = inject(BillingAccountsService);

  /** Type-safe input value extractor for templates */
  iv(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  readonly addId = signal('');
  readonly addName = signal('');
  readonly addMax = signal(15);
  readonly isAdding = signal(false);
  readonly addError = signal('');

  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editMax = signal(15);
  readonly isSaving = signal(false);
  readonly saveError = signal('');

  readonly removingId = signal<string | null>(null);
  readonly togglingId = signal<string | null>(null);

  ngOnInit(): void {
    void this.svc.loadAccounts();
  }

  usagePercent(a: BillingAccount): number {
    return Math.round((a.usedProjects / a.maxProjects) * 100);
  }

  usageClass(a: BillingAccount): string {
    const p = this.usagePercent(a);
    if (p >= 90) {
      return 'usage--critical';
    }
    if (p >= 70) {
      return 'usage--warning';
    }
    return 'usage--ok';
  }

  nextAccountName(): string {
    const count = this.svc.accounts().length + 1;
    const names = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
    return `Billing Account ${names[count - 1] ?? count}`;
  }

  normalizeBillingId(raw: string): string {
    const value = raw.trim();
    if (!value) {
      return '';
    }
    return value.startsWith('billingAccounts/') ? value.slice('billingAccounts/'.length) : value;
  }

  startAdd(): void {
    this.addId.set('');
    this.addName.set(this.nextAccountName());
    this.addMax.set(15);
    this.addError.set('');
  }

  async addAccount(): Promise<void> {
    const id = this.normalizeBillingId(this.addId());
    const name = this.addName().trim();
    if (!id || !name) {
      this.addError.set('ID y nombre son requeridos.');
      return;
    }
    this.isAdding.set(true);
    this.addError.set('');
    try {
      await this.svc.addAccount({ id, name, maxProjects: this.addMax() });
      this.addId.set('');
      this.addName.set('');
    } catch (err: unknown) {
      this.addError.set(errorMessage(err, 'Error al agregar cuenta.'));
    } finally {
      this.isAdding.set(false);
    }
  }

  startEdit(a: BillingAccount): void {
    this.editingId.set(a.id);
    this.editName.set(a.name);
    this.editMax.set(a.maxProjects);
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
        maxProjects: this.editMax(),
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
