import { Injectable, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { StoresService } from '@core/services/stores';
import { errorMessage } from '@core/utils/error.util';
import type { Store, TemplateVersion, ProvisioningStep } from '@core/models/store';
import {
  STEP_ORDER,
  IDLE_STATE,
  type ActionProgressState,
  parseDateToMillis,
} from './store-detail.util';

@Injectable({ providedIn: 'root' })
export class StoreDetailOrchestrationService {
  private storesService = inject(StoresService);
  private fb = inject(FormBuilder);

  readonly isSeeding = signal(false);
  readonly isRetrying = signal(false);
  readonly isDeleting = signal(false);
  readonly isSuspending = signal(false);
  readonly isActivating = signal(false);
  readonly isSaving = signal(false);

  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly saveError = signal('');

  readonly versions = signal<TemplateVersion[]>([]);
  readonly latestVersion = signal<TemplateVersion | null>(null);
  readonly isLoadingVersions = signal(false);
  /** Cache de sesión: evita recargar releases en cada visita al detalle. */
  private cachedVersions: TemplateVersion[] | null = null;
  readonly isUpdatingVersion = signal(false);

  readonly localDeployError = signal('');
  readonly isDeployProgressDismissed = signal(false);
  readonly hasUserInitiatedDeploy = signal(false);
  readonly deploySessionTimestamp = signal<number>(0);
  readonly isDeploying = signal(false);

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    ownerEmail: ['', [Validators.required, Validators.email]],
    logoUrl: [''],
  });

  readonly oauthRedirect = signal<{
    ok: boolean;
    redirectUri: string | null;
    consoleUrl?: string;
  } | null>(null);

  private lastKnownProgress = 0;

  computeDeployActionState(store: Store | null): ActionProgressState {
    if (this.isDeployProgressDismissed()) {
      this.lastKnownProgress = 0;
      return IDLE_STATE;
    }
    if (!store) {
      this.lastKnownProgress = 0;
      return IDLE_STATE;
    }
    if (this.localDeployError()) {
      this.lastKnownProgress = 0;
      return { status: 'error', progress: 100, message: this.localDeployError() };
    }
    if (store.redeployStatus === 'failed' || store.versionUpdateStatus === 'failed') {
      this.lastKnownProgress = 0;
      return {
        status: 'error',
        progress: 100,
        message: store.redeployError || '✗ Falló el despliegue del storefront.',
      };
    }
    const isGhaRunning =
      store.redeployStatus === 'deploying' || store.versionUpdateStatus === 'updating';
    if (this.isDeploying() || isGhaRunning) {
      const updatedAtMillis = parseDateToMillis(
        store.versionUpdateProgress?.updatedAt || store.updatedAt,
      );
      const isStale = updatedAtMillis > 0 && Date.now() - updatedAtMillis > 10 * 60 * 1000;
      if (isStale && !this.isDeploying()) {
        this.lastKnownProgress = 0;
        void this.storesService.resetStoreDeployStatus(store.id);
        return {
          status: 'error',
          progress: 100,
          message: '⚠️ El despliegue anterior excedió el tiempo límite. Podés volver a desplegar.',
        };
      }
      const rawPct = store.versionUpdateProgress?.pct || (this.isDeploying() ? 25 : 55);
      this.lastKnownProgress = Math.max(this.lastKnownProgress, rawPct);
      return {
        status: 'running',
        progress: this.lastKnownProgress,
        message: `🔨 ${store.versionUpdateProgress?.step || 'Compilando en GitHub Actions…'}`,
      };
    }
    if (this.hasUserInitiatedDeploy()) {
      const lastDeploy = parseDateToMillis(store.lastDeployedAt);
      if (lastDeploy > this.deploySessionTimestamp()) {
        this.lastKnownProgress = 0;
        return { status: 'success', progress: 100, message: '✓ Despliegue completado con éxito.' };
      }
      this.lastKnownProgress = Math.max(this.lastKnownProgress, 25);
      return {
        status: 'running',
        progress: this.lastKnownProgress,
        message: '🔨 Iniciando flujo en GitHub Actions…',
      };
    }
    this.lastKnownProgress = 0;
    return IDLE_STATE;
  }

  computeProvisioningSnapshot(store: Store | null): {
    total: number;
    done: number;
    percent: number;
    currentLabel: string;
    currentStatus: ProvisioningStep['status'];
  } {
    const steps = store?.provisioningSteps ?? {};
    const orderedKeys = STEP_ORDER.filter((id) => id in steps);
    const ordered = orderedKeys.map((id) => ({ id, ...steps[id] }));
    const total = ordered.length;
    const done = ordered.filter((s) => s.status === 'done').length;
    const current =
      ordered.find((s) => s.status === 'running') ??
      ordered.find((s) => s.status === 'error') ??
      ordered.find((s) => s.status === 'pending') ??
      ordered[ordered.length - 1];
    return {
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      currentLabel: current?.label ?? 'Esperando inicio',
      currentStatus: current?.status ?? 'pending',
    };
  }

  async loadVersions(force = false): Promise<void> {
    if (!force && this.cachedVersions !== null) {
      this.versions.set(this.cachedVersions);
      this.latestVersion.set(
        this.cachedVersions.find((v: TemplateVersion) => v.isLatest) ??
          this.cachedVersions[0] ??
          null,
      );
      return;
    }
    this.isLoadingVersions.set(true);
    try {
      const list = await this.storesService.listTemplateVersions();
      this.cachedVersions = list;
      this.versions.set(list);
      this.latestVersion.set(list.find((v: TemplateVersion) => v.isLatest) ?? list[0] ?? null);
    } catch {
      this.versions.set([]);
    } finally {
      this.isLoadingVersions.set(false);
    }
  }

  async checkOauthRedirect(store: Store | null): Promise<void> {
    if (!store) {
      return;
    }
    try {
      const fns = getFunctions();
      const check = httpsCallable<
        { storeId: string },
        { ok: boolean; redirectUri: string | null; consoleUrl?: string }
      >(fns, 'checkStoreOAuthRedirect');
      const res = await check({ storeId: store.id });
      this.oauthRedirect.set(res.data);
    } catch {
      this.oauthRedirect.set(null);
    }
  }

  async retryStep(storeId: string): Promise<boolean> {
    this.isRetrying.set(true);
    this.actionError.set('');
    try {
      await this.storesService.retryProvisioning(storeId);
      this.actionSuccess.set('Paso reintentado con éxito.');
      return true;
    } catch (err) {
      this.actionError.set(errorMessage(err) || 'Error al reintentar el paso.');
      return false;
    } finally {
      this.isRetrying.set(false);
    }
  }

  async seedData(
    storeId: string,
    includeMockData = true,
    provisioningMode = 'FULL_DEMO',
    verticalId?: string,
  ): Promise<boolean> {
    this.isSeeding.set(true);
    this.actionError.set('');
    try {
      await this.storesService.seedStore(storeId, includeMockData, provisioningMode, verticalId);
      this.actionSuccess.set('Datos precargados exitosamente.');
      return true;
    } catch (err) {
      this.actionError.set(errorMessage(err) || 'Error al precargar datos.');
      return false;
    } finally {
      this.isSeeding.set(false);
    }
  }

  async suspendStore(storeId: string): Promise<boolean> {
    this.isSuspending.set(true);
    this.actionError.set('');
    try {
      await this.storesService.suspendStore(storeId);
      this.actionSuccess.set('Tienda suspendida con éxito.');
      return true;
    } catch (err) {
      this.actionError.set(errorMessage(err) || 'Error al suspender la tienda.');
      return false;
    } finally {
      this.isSuspending.set(false);
    }
  }

  async activateStore(storeId: string): Promise<boolean> {
    this.isActivating.set(true);
    this.actionError.set('');
    try {
      await this.storesService.activateStore(storeId);
      this.actionSuccess.set('Tienda activada con éxito.');
      return true;
    } catch (err) {
      this.actionError.set(errorMessage(err) || 'Error al activar la tienda.');
      return false;
    } finally {
      this.isActivating.set(false);
    }
  }

  async deleteStore(storeId: string): Promise<boolean> {
    this.isDeleting.set(true);
    this.actionError.set('');
    try {
      await this.storesService.deleteStore(storeId);
      return true;
    } catch (err) {
      this.actionError.set(errorMessage(err) || 'Error al eliminar la tienda.');
      return false;
    } finally {
      this.isDeleting.set(false);
    }
  }

  openEditForm(store: Store | null): void {
    if (!store) {
      return;
    }
    this.editForm.setValue({
      name: store.name,
      ownerEmail: store.ownerEmail,
      logoUrl: store.logoUrl ?? '',
    });
    this.saveError.set('');
  }

  async saveStoreFromForm(storeId: string): Promise<boolean> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return false;
    }
    this.isSaving.set(true);
    this.saveError.set('');
    try {
      const { name, ownerEmail, logoUrl } = this.editForm.value;
      await this.storesService.updateStore(storeId, {
        name: name!.trim(),
        ownerEmail: ownerEmail!.trim(),
        logoUrl: (logoUrl ?? '').trim() || null,
      });
      return true;
    } catch {
      this.saveError.set('No se pudo guardar los cambios.');
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }
}
