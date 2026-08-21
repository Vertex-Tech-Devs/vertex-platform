import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
  signal,
  effect,
  DestroyRef,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@core/utils/error.util';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { StoresService } from '@core/services/stores';
import { AppSpinner } from '../../../../shared/components/app-spinner/app-spinner';
import { AuthService } from '@core/services/auth';
import { StoreDetailStaffService } from './services/store-detail-staff.service';
import { StoreDetailDomainsService } from './services/store-detail-domains.service';
import { StoreDetailOrchestrationService } from './services/store-detail-orchestration.service';
import {
  formatDateUtil,
  statusLabelUtil,
  stepIconUtil,
  formatDeployHistoryUtil,
  type DeploymentHistoryItem,
  STEP_ORDER,
  type ActionProgressState,
  IDLE_STATE,
} from './services/store-detail.util';
import { SeedStoreModal, type SeedPayload } from '../seed-store-modal/seed-store-modal';

@Component({
  selector: 'app-store-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, ReactiveFormsModule, AppSpinner, SeedStoreModal],
  templateUrl: './store-detail.html',
  styleUrl: './store-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreDetail implements OnInit {
  private storesService = inject(StoresService);
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private staffService = inject(StoreDetailStaffService);
  private domainsService = inject(StoreDetailDomainsService);
  private orchestrationService = inject(StoreDetailOrchestrationService);

  readonly storeId = signal<string | null>(null);
  readonly deployHistory = signal<DeploymentHistoryItem[]>([]);
  readonly isLoadingHistory = signal(true);
  readonly oauthRedirect = this.orchestrationService.oauthRedirect;
  readonly activeTab = signal<'orquestacion' | 'equipo' | 'dominios' | 'historial'>('orquestacion');

  readonly store = computed(() => {
    const id = this.storeId();
    if (!id) {
      return null;
    }
    return this.storesService.stores().find((s) => s.id === id) ?? null;
  });

  readonly storeUrl = computed(() => {
    const s = this.store();
    if (!s) {
      return '';
    }
    return typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? `http://localhost:4201/shop?tenantId=${s.slug}`
      : s.defaultUrl;
  });

  readonly orderedSteps = computed(() => STEP_ORDER.filter((id) => id in (this.store()?.provisioningSteps ?? {})));

  readonly provisioningSnapshot = computed(() =>
    this.orchestrationService.computeProvisioningSnapshot(this.store()),
  );

  readonly progressPercent = computed(() => this.provisioningSnapshot().percent);
  readonly isSeeding = this.orchestrationService.isSeeding;
  readonly isRetrying = this.orchestrationService.isRetrying;
  readonly isDeleting = this.orchestrationService.isDeleting;
  readonly isSuspending = this.orchestrationService.isSuspending;
  readonly isActivating = this.orchestrationService.isActivating;
  readonly isSaving = this.orchestrationService.isSaving;
  readonly actionError = this.orchestrationService.actionError;
  readonly actionSuccess = this.orchestrationService.actionSuccess;
  readonly saveError = this.orchestrationService.saveError;

  readonly showDeleteConfirm = signal(false);
  readonly showSleepConfirm = signal(false);
  readonly showEditModal = signal(false);
  readonly showSeedConfirm = signal(false);
  readonly logoPreviewError = signal(false);

  readonly localDeployError = this.orchestrationService.localDeployError;
  readonly isDeployProgressDismissed = this.orchestrationService.isDeployProgressDismissed;
  readonly hasUserInitiatedDeploy = this.orchestrationService.hasUserInitiatedDeploy;
  readonly deploySessionTimestamp = this.orchestrationService.deploySessionTimestamp;
  readonly isDeploying = this.orchestrationService.isDeploying;

  readonly deployActionState = computed<ActionProgressState>(() =>
    this.orchestrationService.computeDeployActionState(this.store()),
  );

  readonly seedActionState = signal<ActionProgressState>(IDLE_STATE);
  readonly suspendActionState = signal<ActionProgressState>(IDLE_STATE);
  readonly domainActionState = signal<ActionProgressState>(IDLE_STATE);
  readonly retryActionState = signal<ActionProgressState>(IDLE_STATE);

  readonly domainInput = this.domainsService.domainInput;
  readonly domainStatus = this.domainsService.domainStatus;
  readonly dnsRecords = this.domainsService.dnsRecords;
  readonly isVerifyingDNS = this.domainsService.isVerifyingDNS;
  readonly isConnectingDomain = this.domainsService.isConnectingDomain;
  readonly dnsVerificationError = this.domainsService.dnsVerificationError;
  readonly dnsVerificationSuccess = this.domainsService.dnsVerificationSuccess;

  deleteConfirmInput = '';
  sleepConfirmInput = '';
  readonly editForm = this.orchestrationService.editForm;

  readonly staff = this.staffService.staff;
  readonly invitations = this.staffService.invitations;
  readonly isLoadingStaff = this.staffService.isLoadingStaff;
  readonly isInvitingStaff = this.staffService.isInvitingStaff;
  readonly inviteError = this.staffService.inviteError;
  readonly inviteSuccess = this.staffService.inviteSuccess;
  readonly generatedResetLink = this.staffService.generatedResetLink;
  readonly isGeneratingLink = this.staffService.isGeneratingLink;
  readonly copyFeedbackSuccess = this.staffService.copyFeedbackSuccess;
  readonly inviteForm = this.staffService.inviteForm;

  readonly isStoreLoading = computed(
    () => (this.auth.isLoading() || this.storesService.isLoading()) && !this.store(),
  );
  readonly availableVersions = this.orchestrationService.versions;
  readonly isLoadingVersions = this.orchestrationService.isLoadingVersions;
  readonly isUpdatingAutoUpdate = signal(false);
  readonly selectedVersion = signal('0.5.0');
  readonly hasDomainOwnership = signal(false);
  readonly hasDnsAccess = signal(false);
  readonly wantsRootOrWwwReady = signal(false);
  readonly canConnectDomain = computed(
    () =>
      !!this.domainInput().trim() &&
      this.hasDomainOwnership() &&
      this.hasDnsAccess() &&
      this.wantsRootOrWwwReady(),
  );

  readonly statusLabel = statusLabelUtil;
  readonly stepIcon = stepIconUtil;
  readonly formatDate = formatDateUtil;

  constructor() {
    effect(() => {
      const s = this.store();
      if (s) {
        void this.orchestrationService.checkOauthRedirect(s);
        const latest = this.orchestrationService.latestVersion();
        if (!this.selectedVersion() || this.selectedVersion() === '0.5.0') {
          this.selectedVersion.set(s.templateVersion || latest?.version || '0.5.0');
        }
      }
    });
  }

  ngOnInit(): void {
    void this.loadVersions();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        this.storeId.set(id);
        if (id) {
          this.refreshDeployHistory(id);
          void this.staffService.loadStaff(id);
        }
      });
  }

  copyOAuthUri(): Promise<void> {
    const uri = this.oauthRedirect()?.redirectUri;
    return uri ? this.staffService.copyToClipboard(uri) : Promise.resolve();
  }

  async loadVersions(): Promise<void> {
    await this.orchestrationService.loadVersions();
    const latest = this.orchestrationService.latestVersion();
    const defaultVer =
      latest?.version ||
      this.availableVersions()[0]?.version ||
      this.store()?.templateVersion ||
      '0.5.0';
    this.selectedVersion.set(defaultVer);
  }

  async triggerDeployment(): Promise<void> {
    const s = this.store();
    const version = this.selectedVersion();
    if (!s || !version) {
      return;
    }
    this.isDeployProgressDismissed.set(false);
    this.hasUserInitiatedDeploy.set(true);
    this.deploySessionTimestamp.set(Date.now());
    this.isDeploying.set(true);
    this.localDeployError.set('');
    try {
      if (version === s.templateVersion) {
        await this.storesService.redeployStore(s.id);
      } else {
        await this.storesService.updateStoreVersion(s.id, version);
      }
    } catch (err) {
      this.localDeployError.set(errorMessage(err, 'No se pudo iniciar el despliegue.'));
    } finally {
      this.isDeploying.set(false);
    }
  }

  async toggleAutoUpdate(event: Event): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isUpdatingAutoUpdate.set(true);
    try {
      await this.storesService.updateStore(s.id, {
        autoUpdate: (event.target as HTMLInputElement).checked,
      });
    } catch (err) {
      console.error('Error updating autoUpdate:', err);
    } finally {
      this.isUpdatingAutoUpdate.set(false);
    }
  }

  setTab(tab: 'orquestacion' | 'equipo' | 'dominios' | 'historial'): void {
    this.activeTab.set(tab);
    const s = this.store();
    if (tab === 'dominios' && s?.customDomain && !this.domainInput()) {
      this.domainInput.set(s.customDomain);
    }
  }

  async loadStaff(): Promise<void> {
    const s = this.store();
    if (s) {
      await this.staffService.loadStaff(s.id);
    }
  }

  sendInvitation(): Promise<void> {
    const s = this.store();
    return s ? this.staffService.sendInvitationFromForm(s.id).then(() => {}) : Promise.resolve();
  }

  generateAccessLink(email: string): Promise<void> {
    const s = this.store();
    return s ? this.staffService.generateAccessLink(s.id, email) : Promise.resolve();
  }

  formatVersion(v?: string): string {
    if (!v) {
      return 'v0.5.0';
    }
    return v.startsWith('v') ? v : `v${v}`;
  }

  copyToClipboard(text: string): Promise<void> {
    return this.staffService.copyToClipboard(text);
  }

  verifyDNS(silent = false): Promise<unknown> {
    const s = this.store();
    return s
      ? this.domainsService.verifyDNS(s.id, s.customDomain || this.domainInput(), silent)
      : Promise.resolve();
  }

  connectDomain(): Promise<unknown> {
    const s = this.store();
    return s ? this.domainsService.connectDomain(s.id, this.domainInput()) : Promise.resolve();
  }

  openEdit(): void {
    this.orchestrationService.openEditForm(this.store());
    this.showEditModal.set(true);
  }

  async saveStore(): Promise<void> {
    const id = this.store()?.id;
    if (id && (await this.orchestrationService.saveStoreFromForm(id))) {
      this.showEditModal.set(false);
    }
  }

  async suspend(): Promise<void> {
    const id = this.store()?.id;
    if (id && (await this.orchestrationService.suspendStore(id))) {
      this.showSleepConfirm.set(false);
    }
    this.sleepConfirmInput = '';
  }

  activate(): Promise<void> {
    const id = this.store()?.id;
    return id ? this.orchestrationService.activateStore(id).then(() => {}) : Promise.resolve();
  }

  dismissDeployProgress(): void {
    this.isDeployProgressDismissed.set(true);
    const s = this.store();
    if (s && (s.versionUpdateStatus === 'updating' || s.redeployStatus === 'deploying')) {
      void this.storesService.resetStoreDeployStatus(s.id);
    }
  }

  openSeedConfirm(): void {
    this.showSeedConfirm.set(true);
  }

  async handleSeedConfirm(p: SeedPayload): Promise<void> {
    const id = this.store()?.id;
    if (!id) {
      return;
    }
    this.showSeedConfirm.set(false);
    await this.orchestrationService.seedData(id, p.includeMockData, p.provisioningMode, p.verticalId);
  }

  retry(): Promise<void> {
    const id = this.store()?.id;
    return id ? this.orchestrationService.retryStep(id).then(() => {}) : Promise.resolve();
  }

  async deleteStore(): Promise<void> {
    const s = this.store();
    if (!s || this.deleteConfirmInput !== s.slug) {
      return;
    }
    if (await this.orchestrationService.deleteStore(s.id)) {
      void this.router.navigate(['/stores']);
    } else {
      this.showDeleteConfirm.set(false);
      this.deleteConfirmInput = '';
    }
  }

  private formatDeployHistory(history: DeploymentHistoryItem[]): DeploymentHistoryItem[] {
    const storeVer = this.store()?.templateVersion || this.store()?.appVersion;
    return formatDeployHistoryUtil(history, storeVer);
  }

  refreshDeployHistory(explicitId?: string): void {
    const id = explicitId || this.storeId() || this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.isLoadingHistory.set(false);
      return;
    }
    this.deployHistory.set([]);
    this.isLoadingHistory.set(true);
    this.storesService
      .getStoreDeploymentHistory(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((h) => {
        this.deployHistory.set(this.formatDeployHistory(h));
        this.isLoadingHistory.set(false);
      });
  }
}
