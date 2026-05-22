import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import type { OnInit, OnDestroy } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoresService } from '@core/services/stores';
import type { DeploymentHistoryItem } from '@core/services/stores';
import type { ProvisioningStep } from '@core/models/store';

const STEP_ORDER = [
  'createProject',
  'linkBilling',
  'addFirebase',
  'enableApis',
  'createWebApp',
  'initFirestore',
  'initAdmin',
  'grantAccess',
  'triggerDeploy',
];

@Component({
  selector: 'app-store-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, ReactiveFormsModule],
  templateUrl: './store-detail.html',
  styleUrls: ['./store-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreDetail implements OnInit, OnDestroy {
  private storesService = inject(StoresService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly store = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return this.storesService.stores().find((s) => s.id === id) ?? null;
  });

  readonly orderedSteps = computed(() => {
    const steps = this.store()?.provisioningSteps ?? {};
    return STEP_ORDER.filter((id) => id in steps);
  });

  readonly progressPercent = computed(() => {
    const steps = this.store()?.provisioningSteps ?? {};
    const done = Object.values(steps).filter((s) => s.status === 'done').length;
    return Math.round((done / STEP_ORDER.length) * 100);
  });

  readonly isRedeploying = signal(false);
  readonly isRetrying = signal(false);
  readonly isDeleting = signal(false);
  readonly isConnectingDomain = signal(false);
  readonly isSuspending = signal(false);
  readonly isActivating = signal(false);
  readonly isSaving = signal(false);
  readonly showDeleteConfirm = signal(false);
  readonly showSleepConfirm = signal(false);
  readonly showDomainForm = signal(false);
  readonly showEditModal = signal(false);
  readonly actionError = signal('');
  readonly saveError = signal('');
  readonly dnsRecords = signal<Array<{ rdata: string; requiredAction: string }>>([]);
  readonly deploymentHistory = signal<DeploymentHistoryItem[]>([]);
  readonly isLoadingHistory = signal(false);
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;

  domainInput = '';
  deleteConfirmInput = '';
  sleepConfirmInput = '';

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    plan: ['starter' as const, Validators.required],
    ownerEmail: ['', [Validators.required, Validators.email]],
    logoUrl: [''],
  });

  ngOnInit(): void {
    void this.loadHistory();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async loadHistory(): Promise<void> {
    const s = this.store();
    if (!s) return;
    const projectId = s.firebaseProjectId;
    if (!projectId) return;
    
    this.isLoadingHistory.set(true);
    try {
      const history = await this.storesService.getDeploymentHistory(projectId);
      this.deploymentHistory.set(history);
    } catch (err) {
      console.error('Error loading deployment history:', err);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  startPolling(): void {
    this.stopPolling();
    this.pollIntervalId = setInterval(() => {
      const s = this.store();
      if (!s) return;
      void this.loadHistory();
    }, 6000);
  }

  stopPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  openEdit(): void {
    const s = this.store();
    if (!s) return;
    this.editForm.setValue({
      name: s.name,
      plan: s.plan as 'starter',
      ownerEmail: s.ownerEmail,
      logoUrl: s.logoUrl ?? '',
    });
    this.saveError.set('');
    this.showEditModal.set(true);
  }

  async saveStore(): Promise<void> {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    const id = this.store()?.id;
    if (!id) return;
    this.isSaving.set(true);
    this.saveError.set('');
    try {
      const { name, plan, ownerEmail, logoUrl } = this.editForm.value;
      await this.storesService.updateStore(id, {
        name: name!,
        plan: plan as 'starter' | 'professional' | 'enterprise',
        ownerEmail: ownerEmail!,
        ...(logoUrl ? { logoUrl } : {}),
      });
      this.showEditModal.set(false);
    } catch {
      this.saveError.set('No se pudo guardar los cambios. Intentá de nuevo.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async suspend(): Promise<void> {
    const id = this.store()?.id;
    if (!id) return;
    this.isSuspending.set(true);
    this.actionError.set('');
    try {
      await this.storesService.setStatus(id, 'suspended');
      this.showSleepConfirm.set(false);
    } catch {
      this.actionError.set('No se pudo suspender la tienda.');
    } finally {
      this.isSuspending.set(false);
      this.sleepConfirmInput = '';
    }
  }

  async activate(): Promise<void> {
    const id = this.store()?.id;
    if (!id) return;
    this.isActivating.set(true);
    this.actionError.set('');
    try {
      await this.storesService.setStatus(id, 'active');
    } catch {
      this.actionError.set('No se pudo reactivar la tienda.');
    } finally {
      this.isActivating.set(false);
    }
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      provisioning: 'Aprovisionando',
      active: 'Activa',
      suspended: 'Suspendida',
      error: 'Error',
    };
    return labels[status] ?? status;
  }

  stepIcon(status: ProvisioningStep['status']): string {
    return { pending: '○', running: '…', done: '✓', error: '✗' }[status] ?? '○';
  }

  async redeploy(): Promise<void> {
    const id = this.store()?.id;
    if (!id) return;
    this.isRedeploying.set(true);
    this.actionError.set('');
    try {
      await this.storesService.redeployStore(id);
      setTimeout(() => void this.loadHistory(), 2000);
    } catch {
      this.actionError.set('No se pudo iniciar el redeploy. Intentá de nuevo.');
    } finally {
      this.isRedeploying.set(false);
    }
  }

  async retry(): Promise<void> {
    const id = this.store()?.id;
    if (!id) return;
    this.isRetrying.set(true);
    this.actionError.set('');
    try {
      await this.storesService.retryProvisioning(id);
    } catch {
      this.actionError.set('No se pudo reintentar el aprovisionamiento. Intentá de nuevo.');
    } finally {
      this.isRetrying.set(false);
    }
  }

  async connectDomain(): Promise<void> {
    const id = this.store()?.id;
    if (!id || !this.domainInput) return;
    this.isConnectingDomain.set(true);
    this.actionError.set('');
    try {
      const result = await this.storesService.connectDomain(id, this.domainInput.trim());
      this.dnsRecords.set(result.dnsRecords);
      this.showDomainForm.set(false);
    } catch {
      this.actionError.set('No se pudo conectar el dominio. Verificá que sea válido.');
    } finally {
      this.isConnectingDomain.set(false);
    }
  }

  async deleteStore(): Promise<void> {
    const id = this.store()?.id;
    if (!id) return;
    this.isDeleting.set(true);
    this.actionError.set('');
    try {
      await this.storesService.deleteStore(id);
      void this.router.navigate(['/stores']);
    } catch {
      this.actionError.set('No se pudo eliminar la tienda. Intentá de nuevo.');
      this.isDeleting.set(false);
      this.showDeleteConfirm.set(false);
      this.deleteConfirmInput = '';
    }
  }
}
