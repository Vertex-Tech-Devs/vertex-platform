import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoresService } from '@core/services/stores.service';
import type { ProvisioningStep } from '@core/models/store.model';

const STEP_ORDER = [
  'createProject',
  'linkBilling',
  'addFirebase',
  'enableApis',
  'createWebApp',
  'initFirestore',
  'grantAccess',
  'triggerDeploy',
];

@Component({
  selector: 'app-store-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  template: `
    @if (store()) {
      <div class="detail-page">
        <div class="detail-page__back">
          <a routerLink="/stores">← Volver a tiendas</a>
        </div>

        <div class="detail-header">
          <div class="detail-header__color"></div>
          <div class="detail-header__info">
            <h1 class="detail-header__name">{{ store()!.name }}</h1>
            <span class="badge badge--{{ store()!.status }}">{{ statusLabel(store()!.status) }}</span>
          </div>
          <div class="detail-header__actions">
            @if (store()!.status === 'active') {
              <a [href]="store()!.defaultUrl" target="_blank" class="btn btn-secondary">Abrir tienda ↗</a>
            }
          </div>
        </div>

        <!-- Provisioning panel -->
        @if (store()!.status === 'provisioning' || store()!.status === 'error') {
          <div class="provisioning-panel">
            <p class="provisioning-panel__title">
              {{ store()!.status === 'error' ? 'Error en el aprovisionamiento' : 'Aprovisionando tienda…' }}
            </p>
            <p class="provisioning-panel__sub">
              {{ store()!.status === 'error'
                ? 'Hubo un problema. Revisá los detalles del error abajo.'
                : 'Esto tarda unos minutos. El proceso sigue aunque cierres esta ventana.' }}
            </p>
            <ul class="step-list">
              @for (stepId of orderedSteps(); track stepId) {
                @let step = store()!.provisioningSteps?.[stepId];
                @if (step) {
                  <li class="step-item step-item--{{ step.status }}">
                    <span class="step-item__icon">
                      @if (step.status === 'running') {
                        <span class="spinner"></span>
                      } @else {
                        {{ stepIcon(step.status) }}
                      }
                    </span>
                    <span class="step-item__label">
                      {{ step.label }}
                      @if (step.error) {
                        <div class="step-item__error">{{ step.error }}</div>
                      }
                    </span>
                  </li>
                }
              }
            </ul>
          </div>
        }

        <!-- Main content (active stores) -->
        @if (store()!.status === 'active' || store()!.status === 'suspended') {
          <div class="detail-grid">
            <div class="detail-card">
              <h2 class="detail-card__title">Información general</h2>
              <dl class="detail-dl">
                <dt>Slug</dt><dd>{{ store()!.slug }}</dd>
                <dt>Plan</dt><dd class="capitalize">{{ store()!.plan }}</dd>
                <dt>Cliente</dt><dd>{{ store()!.ownerEmail }}</dd>
                <dt>Firebase Project</dt><dd>{{ store()!.firebaseProjectId }}</dd>
                <dt>URL</dt><dd><a [href]="store()!.defaultUrl" target="_blank">{{ store()!.defaultUrl }}</a></dd>
                @if (store()!.customDomain) {
                  <dt>Dominio</dt><dd>{{ store()!.customDomain }}</dd>
                }
                <dt>Creada</dt><dd>{{ store()!.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                @if (store()!.lastDeployedAt) {
                  <dt>Último deploy</dt><dd>{{ store()!.lastDeployedAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                }
              </dl>
            </div>

            <div class="detail-card">
              <h2 class="detail-card__title">Acciones</h2>
              <div class="action-list">

                <!-- Redeploy -->
                <button
                  class="action-btn"
                  [disabled]="isRedeploying()"
                  (click)="redeploy()">
                  @if (isRedeploying()) {
                    <span class="spinner-sm"></span> Desplegando…
                  } @else {
                    🚀 Redeploy manual
                  }
                  <small>Actualiza la tienda con la última versión del template</small>
                </button>

                <!-- Connect domain -->
                @if (!store()!.customDomain) {
                  <button class="action-btn" (click)="showDomainForm.set(!showDomainForm())">
                    🌐 Conectar dominio
                    <small>Asigná un dominio custom a esta tienda</small>
                  </button>
                  @if (showDomainForm()) {
                    <div class="domain-form">
                      <input
                        class="form-control"
                        [(ngModel)]="domainInput"
                        placeholder="mitienda.com"
                        type="text" />
                      <button
                        class="btn btn-primary"
                        [disabled]="isConnectingDomain() || !domainInput"
                        (click)="connectDomain()">
                        {{ isConnectingDomain() ? 'Conectando…' : 'Confirmar' }}
                      </button>
                    </div>
                  }
                }

                <!-- DNS records after domain connection -->
                @if (dnsRecords().length > 0) {
                  <div class="dns-card">
                    <p class="dns-card__title">Configurá estos registros DNS en tu proveedor:</p>
                    @for (record of dnsRecords(); track record.rdata) {
                      <code class="dns-record">{{ record.requiredAction }}: {{ record.rdata }}</code>
                    }
                  </div>
                }

                @if (actionError()) {
                  <p class="action-error">{{ actionError() }}</p>
                }

                <!-- Delete -->
                <button
                  class="action-btn action-btn--danger"
                  [disabled]="isDeleting()"
                  (click)="showDeleteConfirm.set(true)">
                  🗑 Eliminar tienda
                  <small>Elimina el proyecto Firebase y todos sus datos</small>
                </button>

              </div>
            </div>
          </div>
        }
      </div>

      <!-- Delete confirmation modal -->
      @if (showDeleteConfirm()) {
        <div class="modal-overlay" (click)="showDeleteConfirm.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3 class="modal__title">⚠️ Eliminar tienda</h3>
            <p class="modal__body">
              Vas a eliminar <strong>{{ store()!.name }}</strong> y su proyecto Firebase.
              Esta acción <strong>no se puede deshacer</strong> y todos los datos se perderán.
            </p>
            <div class="modal__actions">
              <button class="btn btn-secondary" (click)="showDeleteConfirm.set(false)">Cancelar</button>
              <button class="btn btn-danger" [disabled]="isDeleting()" (click)="deleteStore()">
                {{ isDeleting() ? 'Eliminando…' : 'Sí, eliminar' }}
              </button>
            </div>
          </div>
        </div>
      }

    } @else {
      <div class="loading">Cargando…</div>
    }
  `,
  styleUrls: ['./store-detail.component.scss'],
})
export class StoreDetailComponent {
  private storesService = inject(StoresService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly store = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return this.storesService.stores().find((s) => s.id === id) ?? null;
  });

  readonly orderedSteps = computed(() => {
    const steps = this.store()?.provisioningSteps ?? {};
    return STEP_ORDER.filter((id) => id in steps);
  });

  readonly isRedeploying = signal(false);
  readonly isDeleting = signal(false);
  readonly isConnectingDomain = signal(false);
  readonly showDeleteConfirm = signal(false);
  readonly showDomainForm = signal(false);
  readonly actionError = signal('');
  readonly dnsRecords = signal<Array<{ rdata: string; requiredAction: string }>>([]);
  domainInput = '';

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
    } catch {
      this.actionError.set('No se pudo iniciar el redeploy. Intentá de nuevo.');
    } finally {
      this.isRedeploying.set(false);
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
    }
  }
}
