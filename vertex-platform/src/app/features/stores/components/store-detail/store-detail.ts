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
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { StoresService, type StoreSubscriptionInfo } from '@core/services/stores';
import { AppSpinner } from '../../../../shared/components/app-spinner/app-spinner';
import { FormatLabelPipe } from '../../../../shared/pipes/format-label.pipe';

import { getFirestore, doc, onSnapshot, collection, getDocs, updateDoc } from 'firebase/firestore';
import { AuthService } from '@core/services/auth';
import { StoreDetailStaffService } from './services/store-detail-staff.service';
import { StoreDetailDomainsService } from './services/store-detail-domains.service';
import { StoreDetailOrchestrationService } from './services/store-detail-orchestration.service';
import type { PendingInvitation, Store } from '@core/models/store';
import {
  formatDateUtil,
  parseDateToMillis,
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
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    AppSpinner,
    SeedStoreModal,
    FormatLabelPipe,
  ],
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

  private db = getFirestore();
  private storeUnsub: (() => void) | null = null;
  readonly localStore = signal<Store | null>(null);
  readonly isStoreLoading = signal(true);

  readonly storeId = signal<string | null>(null);
  readonly deployHistory = signal<DeploymentHistoryItem[]>([]);
  readonly isLoadingHistory = signal(true);
  readonly oauthRedirect = this.orchestrationService.oauthRedirect;
  readonly activeTab = signal<
    'orquestacion' | 'equipo' | 'dominios' | 'historial' | 'pagos' | 'monitor'
  >('orquestacion');

  readonly store = computed(() => {
    const local = this.localStore();
    if (local) {
      return local;
    }
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

  readonly orderedSteps = computed(() =>
    STEP_ORDER.filter((id) => id in (this.store()?.provisioningSteps ?? {})),
  );

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
  readonly purgeOpen = signal(false);
  readonly purgeClients = signal(true);
  readonly purgeOrders = signal(true);
  readonly purgeCatalog = signal(false);
  readonly purgeContent = signal(false);
  readonly purgeRunning = signal(false);
  readonly purgeError = signal('');
  readonly purgeResult = signal<string>('');
  readonly purgeConfirmInput = signal('');
  readonly itemKind = signal<'client' | 'order'>('order');
  readonly itemReference = signal('');
  readonly itemArmed = signal(false);
  readonly itemRunning = signal(false);
  readonly itemMessage = signal('');
  readonly itemError = signal('');
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

  readonly showDiagnostics = signal(false);
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
  readonly resendingInviteId = signal<string | null>(null);
  readonly generatedResetLink = this.staffService.generatedResetLink;
  readonly isGeneratingLink = this.staffService.isGeneratingLink;
  readonly copyFeedbackSuccess = this.staffService.copyFeedbackSuccess;
  readonly inviteForm = this.staffService.inviteForm;

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

  // ── Mercado Pago ──────────────────────────────────────────────────────────
  readonly mpPublicKey = signal('');
  readonly mpAccessToken = signal('');
  readonly mpPinging = signal(false);
  readonly mpPingResult = signal<{
    ok: boolean;
    account?: { id?: number | string | null; email?: string; nickname?: string };
    message?: string;
    status?: number;
  } | null>(null);
  readonly mpSandbox = signal(false);
  readonly showMpToken = signal(false);
  readonly isSavingPayment = signal(false);
  readonly isLoadingPayment = signal(false);
  readonly paymentSaveError = signal('');
  readonly paymentSaveSuccess = signal('');
  readonly mpValidationStatus = signal<'pending' | 'valid' | 'invalid' | ''>('');
  readonly mpAccountEmail = signal('');
  readonly mpTokenMasked = signal('');

  // ── Dominios: estado desde callable getDomainStatus / disconnectDomain ────
  readonly domainBackendStatus = signal<'ACTIVE' | 'VALIDATING' | 'PENDING_DNS' | ''>('');
  readonly domainRefreshLoading = signal(false);
  readonly domainCheckError = signal('');
  readonly domainDisconnectOpen = signal(false);
  readonly isDisconnectingDomain = signal(false);
  readonly domainDisconnectError = signal('');
  readonly domainCopiedKey = signal<string | null>(null);
  /** Entorno de la consola Platform (para URLs canónicas de ecommerce). */
  isDevPlatformEnv(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('-dev.web.app') ||
        window.location.hostname.endsWith('.local'))
    );
  }

  readonly domainIsLive = computed(
    () => this.domainStatus() === 'live' || this.domainBackendStatus() === 'ACTIVE',
  );

  // ── Mercado Pago: modo de operación según token resuelto (banners) ───────
  readonly mpMode = computed<'sandbox' | 'test' | 'prod'>(() => {
    const raw = this.mpAccessToken().trim() || this.mpTokenMasked() || '';
    if (raw.startsWith('APP_USR-')) {
      return 'prod'; // protege: nunca tratar credenciales reales como sandbox
    }
    if (raw.startsWith('TEST-')) {
      return 'test';
    }
    // Sin token visible: la validación previa distingue producción real (APP) de pruebas.
    if (this.mpValidationStatus() === 'valid' && !this.mpSandbox()) {
      return 'prod';
    }
    if (this.mpValidationStatus() === 'valid') {
      return 'test';
    }
    return 'sandbox';
  });

  readonly mpModeLabel = computed(() => {
    switch (this.mpMode()) {
      case 'prod':
        return 'Producción Real (APP_USR-)';
      case 'test':
        return 'Pruebas (TEST-)';
      default:
        return 'Sandbox de Plataforma (sin credenciales propias)';
    }
  });

  // ── SaaS: precios efectivos y gating de cobro ─────────────────────────────
  readonly saasMonthly = computed(() => {
    const sub = this.storeSubscription()?.subscription;
    return Number(
      sub?.customMonthlyPrice ?? this.storeSubscription()?.basePricing?.monthlyPrice ?? 50000,
    );
  });
  readonly saasAnnual = computed(() => {
    const sub = this.storeSubscription()?.subscription;
    return Number(
      sub?.customAnnualPrice ?? this.storeSubscription()?.basePricing?.annualPrice ?? 500000,
    );
  });
  /** Meses que el plan anual "regala" respecto a pagar 12 meses sueltos. */
  readonly saasAnnualMonthsFree = computed(() => {
    if (!this.saasMonthly()) {
      return 0;
    }
    return Math.max(0, Math.round((this.saasMonthly() * 12 - this.saasAnnual()) / this.saasMonthly()));
  });
  /** Estados en los que NO corresponde generar un cobro. */
  readonly saasChargeBlocked = computed(() => {
    const st = this.storeSubscription()?.subscription?.status;
    return st === 'complimentary' || st === 'suspended' || st === 'trial';
  });

  /** Presentación homogénea del estado de suscripción (grilla resumen). */
  readonly saasStatusInfo = computed<{
    label: string;
    icon: string;
    tone: 'success' | 'warning' | 'danger' | 'primary' | 'neutral';
  }>(() => {
    const map: Record<string, { label: string; icon: string; tone: 'success' | 'warning' | 'danger' | 'primary' | 'neutral' }> = {
      active: { label: 'Activa', icon: 'check-circle-fill', tone: 'success' },
      complimentary: { label: 'Cortesía / Bonificada', icon: 'gift-fill', tone: 'primary' },
      trial: { label: 'Período de prueba', icon: 'stars', tone: 'warning' },
      past_due: { label: 'Período de gracia', icon: 'clock-history', tone: 'warning' },
      suspended: { label: 'Suspendida por pago', icon: 'slash-circle-fill', tone: 'danger' },
    };
    const st = String(this.storeSubscription()?.subscription?.status || '');
    return map[st] ?? { label: 'En configuración', icon: 'question-circle', tone: 'neutral' };
  });

  readonly saasBillingCycleLabel = computed(() =>
    this.storeSubscription()?.subscription?.billingCycle === 'annual' ? 'Anual' : 'Mensual',
  );

  // ── SaaS Subscription Vertex ──────────────────────────────────────────────
  readonly storeSubscription = signal<StoreSubscriptionInfo | null>(null);
  readonly isLoadingSubscription = signal(false);
  readonly isGeneratingSubLink = signal(false);
  readonly subLinkGenerated = signal<string | null>(null);
  readonly subLinkError = signal<string | null>(null);
  readonly isSavingDiscount = signal(false);
  readonly discountSaveSuccess = signal<string | null>(null);

  readonly customMonthlyPriceInput = signal<number | null>(null);
  readonly customAnnualPriceInput = signal<number | null>(null);
  readonly discountPercentInput = signal<number | null>(null);
  readonly trialDaysInput = signal<number>(14);
  readonly isGrantingTrial = signal(false);
  readonly subscriptionStatusSelect = signal<
    'active' | 'complimentary' | 'trial' | 'past_due' | 'suspended'
  >('active');

  readonly trialRemainingDays = computed(() => {
    const sub = this.storeSubscription()?.subscription;
    if (sub?.status !== 'trial') {
      return 0;
    }
    const endTs = sub.trialEndDate || sub.currentPeriodEnd;
    if (!endTs) {
      return 0;
    }
    const endMs = parseDateToMillis(endTs);
    if (!endMs) {
      return 0;
    }
    const diffMs = endMs - Date.now();
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  });

  // QA Lab & Expiration Simulation
  readonly showSimulationTools = signal(false);
  readonly isSimulatingExpiration = signal(false);

  readonly publicCheckoutUrl = computed(() => {
    const s = this.store();
    if (!s) {
      return '';
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/pay/${s.id}`;
  });

  readonly whatsAppShareUrl = computed(() => {
    const s = this.store();
    const url = this.publicCheckoutUrl();
    if (!s || !url) {
      return '';
    }
    const text = encodeURIComponent(
      `¡Hola! Te comparto el enlace seguro para abonar la suscripción de tu tienda ${s.name} en Vertex: ${url}`,
    );
    return `https://wa.me/?text=${text}`;
  });

  readonly copiedPublicLink = signal(false);

  copyPublicCheckoutUrl(): void {
    const url = this.publicCheckoutUrl();
    if (!url) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
    }
    this.copiedPublicLink.set(true);
    setTimeout(() => this.copiedPublicLink.set(false), 2500);
  }

  readonly statusLabel = statusLabelUtil;

  /** Clase de tono correcta para el badge del estado (no usar el raw status como clase). */
  readonly storeStatusBadge = computed<string>(() => {
    const tones: Record<string, string> = {
      active: 'badge--success',
      suspended: 'badge--danger',
      error: 'badge--danger',
      provisioning: 'badge--warning',
    };
    return tones[this.store()?.status || ''] ?? 'badge--neutral';
  });
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

    this.destroyRef.onDestroy(() => {
      if (this.storeUnsub) {
        this.storeUnsub();
      }
    });
  }

  ngOnInit(): void {
    void this.loadVersions();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.storeId.set(id);
      if (this.storeUnsub) {
        this.storeUnsub();
        this.storeUnsub = null;
      }
      if (id) {
        try {
          this.storeUnsub = onSnapshot(
            doc(this.db, 'stores', id),
            (snap) => {
              if (snap.exists()) {
                this.localStore.set({ id: snap.id, ...snap.data() } as Store);
              }
            },
            () => {
              /* ignore error */
            },
          );
        } catch {
          /* ignore error */
        }
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
      this.store()?.templateVersion ||
      latest?.version ||
      this.availableVersions()[0]?.version ||
      '0.8.5';
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

  setTab(
    tab:
      | 'orquestacion'
      | 'equipo'
      | 'dominios'
      | 'historial'
      | 'pagos'
      | 'monitor',
  ): void {
    this.activeTab.set(tab);
    if (tab === 'monitor') {
      void this.loadStoreAlerts();
      if (this.logsEntries().length === 0) {
        void this.loadStoreLogs();
      }
    }
    const s = this.store();
    if (tab === 'dominios' && s?.customDomain) {
      if (!this.domainInput()) {
        this.domainInput.set(s.customDomain);
      }
      // Anti-hang: mostrar los registros estándar de Firebase Hosting de inmediato
      // (A → 199.36.158.100 + CNAME www → {site}.web.app) para que el spinner de
      // "Recuperando registros..." nunca quede en bucle.
      if (this.domainsService.dnsRecords().length === 0) {
        this.domainsService.dnsRecords.set([
          { host: '@', type: 'A', value: '199.36.158.100', requiredAction: 'ADD' },
          {
            host: 'www',
            type: 'CNAME',
            value: `${s.runtimeSiteId || s.id}.web.app`,
            requiredAction: 'ADD',
          },
        ]);
      }
      // Refresco de estado en background (silencioso, no pisa los records mostrados).
      void this.domainsService.verifyDNS(s.id, s.customDomain, true);
    }
    if (tab === 'equipo' && s) {
      void this.staffService.loadStaff(s.id, true);
    }
    if (tab === 'pagos' && s) {
      void this.loadPaymentConfig(s.id);
      void this.loadStoreSubscription(s.id);
    }
  }

  async loadStaff(force = true): Promise<void> {
    const s = this.store();
    if (s) {
      await this.staffService.loadStaff(s.id, force);
    }
  }

  sendInvitation(): Promise<void> {
    const s = this.store();
    return s ? this.staffService.sendInvitationFromForm(s.id).then(() => {}) : Promise.resolve();
  }

  async resendInvite(invite: PendingInvitation): Promise<void> {
    const s = this.store();
    if (!s || !invite?.email) {
      return;
    }
    this.resendingInviteId.set(invite.id);
    try {
      const ok = await this.staffService.sendInvitation(s.id, invite.email, invite.role);
      if (ok) {
        this.staffService.inviteSuccess.set(
          `Invitación reenviada a ${invite.email} — la fila se actualizó con la nueva fecha.`,
        );
      }
    } finally {
      this.resendingInviteId.set(null);
    }
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

  async loadPaymentConfig(storeId: string): Promise<void> {
    this.isLoadingPayment.set(true);
    this.paymentSaveError.set('');
    this.paymentSaveSuccess.set('');
    try {
      const config = await this.storesService.getStoreConfig(storeId);
      const mp = config?.payments?.mercadoPago;
      if (mp) {
        this.mpPublicKey.set(mp.publicKey || '');
        // accessToken no se lee del servidor (nunca se devuelve en texto plano)
        // El modo se deriva del token REAL validado (no de un toggle/sandbox viejo):
        // APP_USR- validado => producción; TEST- validado => pruebas; sin token => preferencia.
        const masked = String(mp.accessTokenMasked || '');
        const valid = mp.validationStatus === 'valid';
        this.mpSandbox.set(
          valid && masked.startsWith('APP_USR-')
            ? false
            : valid && masked.startsWith('TEST-')
              ? true
              : typeof mp.sandbox === 'boolean'
                ? mp.sandbox
                : (mp.accessTokenSecret || '').includes('TEST-') ||
                    (mp.publicKey || '').startsWith('TEST-'),
        );
        this.mpValidationStatus.set(mp.validationStatus || '');
        this.mpAccountEmail.set(mp.accountEmail || '');
        this.mpTokenMasked.set(mp.accessTokenMasked || '');
      }
    } catch (err) {
      console.warn('No se pudo cargar la configuración de pagos:', err);
    } finally {
      this.isLoadingPayment.set(false);
    }
  }

  async savePaymentConfig(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isSavingPayment.set(true);
    this.paymentSaveError.set('');
    this.paymentSaveSuccess.set('');
    try {
      const mpConfig: {
        publicKey: string;
        sandbox: boolean;
        accessToken?: string;
        webhookUrl?: string;
      } = {
        publicKey: this.mpPublicKey().trim(),
        sandbox: this.mpSandbox(),
      };
      const token = this.mpAccessToken().trim();
      if (token) {
        mpConfig['accessToken'] = token;
      }
      await this.storesService.updateStoreConfig(s.id, {
        payments: { mercadoPago: mpConfig },
      });
      this.mpAccessToken.set(''); // Limpiar token del estado tras guardar
      this.paymentSaveSuccess.set('Credenciales guardadas y validadas correctamente.');
      // Recargar para mostrar el estado actualizado (masked token, email, etc.)
      await this.loadPaymentConfig(s.id);
    } catch (err) {
      this.paymentSaveError.set(
        errorMessage(err, 'No se pudieron guardar las credenciales de pago.'),
      );
    } finally {
      this.isSavingPayment.set(false);
    }
  }

  // ── Monitor: Logs por tienda (escalable a alertas/rendimiento) ────────────
  readonly logsSeverity = signal<'ALL' | 'WARNING' | 'ERROR'>('ALL');
  readonly logsQuery = signal('');
  readonly logsSinceMinutes = signal(60);
  readonly logsLoading = signal(false);
  readonly logsError = signal('');
  readonly logsEntries = signal<Array<{
    timestamp: string;
    severity: string;
    function?: string;
    message: string;
    raw?: string;
  }>>([]);
  readonly logsProject = signal('');
  readonly logsLoadedAt = signal<Date | null>(null);
  readonly storeAlerts = signal<
    Array<{ key: string; severity: string; title: string; message: string }>
  >([]);
  readonly storeAlertsLoading = signal(false);
  readonly resolvingAlertKey = signal<string | null>(null);

  async loadStoreAlerts(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.storeAlertsLoading.set(true);
    try {
      const snap = await getDocs(collection(getFirestore(), 'alerts'));
      const mine: Array<{ key: string; severity: string; title: string; message: string }> = [];
      snap.forEach((d) => {
        const data = d.data() as {
          status?: string;
          severity?: string;
          storeId?: string;
          title?: string;
          message?: string;
        };
        if (data.status !== 'open') {
          return;
        }
        if (data.storeId && data.storeId !== s.id && data.storeId !== s.slug) {
          return;
        }
        mine.push({
          key: d.id,
          severity: data.severity || 'warning',
          title: data.title || d.id,
          message: data.message || '',
        });
      });
      this.storeAlerts.set(mine);
    } catch {
      /* sin alertas disponibles no debe romper la pestaña */
      this.storeAlerts.set([]);
    } finally {
      this.storeAlertsLoading.set(false);
    }
  }

  async resolveStoreAlert(key: string): Promise<void> {
    this.resolvingAlertKey.set(key);
    try {
      await updateDoc(doc(getFirestore(), 'alerts', key), {
        status: 'resolved',
        resolvedAt: new Date(),
      });
      this.storeAlerts.update((list) => list.filter((a) => a.key !== key));
    } finally {
      this.resolvingAlertKey.set(null);
    }
  }

  async loadStoreLogs(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.logsLoading.set(true);
    this.logsError.set('');
    try {
      const res = await this.storesService.getStoreLogs(s.id, {
        severity: this.logsSeverity() === 'ALL' ? undefined : this.logsSeverity(),
        query: this.logsQuery().trim() || undefined,
        sinceMinutes: this.logsSinceMinutes(),
        limit: 80,
      });
      this.logsEntries.set(res.entries || []);
      this.logsProject.set(res.project || '');
      this.logsLoadedAt.set(new Date());
    } catch (err) {
      this.logsError.set(
        errorMessage(err, 'No se pudieron cargar los logs de la tienda.'),
      );
      this.logsEntries.set([]);
    } finally {
      this.logsLoading.set(false);
    }
  }

  setLogsSince(minutes: number): void {
    this.logsSinceMinutes.set(minutes);
    void this.loadStoreLogs();
  }

  applyLogsFilters(): void {
    void this.loadStoreLogs();
  }

  cloudLogsUrl(): string {
    const project = this.logsProject() || 'ecommerce-vertex';
    return `https://console.cloud.google.com/logs/query;query=textPayload%3A%22${encodeURIComponent(
      this.store()?.slug || this.store()?.id || '',
    )}%22?project=${project}`;
  }

  copyLogMessage(message: string): void {
    void this.staffService.copyToClipboard(message);
  }

  logsSeverityClass(sev: string): string {
    const s = (sev || '').toUpperCase();
    if (s === 'ERROR' || s === 'CRITICAL' || s === 'ALERT' || s === 'EMERGENCY') {
      return 'log-sev log-sev--error';
    }
    if (s === 'WARNING' || s === 'NOTICE') {
      return 'log-sev log-sev--warn';
    }
    if (s === 'INFO' || s === 'DEBUG') {
      return 'log-sev log-sev--info';
    }
    return 'log-sev';
  }

  copyWebhookUrl(storeId: string): Promise<void> {
    const isDev =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname.includes('-dev.web.app') ||
        window.location.hostname.endsWith('.local'));
    const url = `https://us-central1-${
      isDev ? 'ecommerce-vertex-dev' : 'ecommerce-vertex'
    }.cloudfunctions.net/mercadoPagoWebhookHandler?tenant=${storeId}`;
    return this.staffService.copyToClipboard(url);
  }

  /** Actualiza el estado del dominio consultando el callable getDomainStatus. */
  async loadDomainStatus(): Promise<void> {
    const s = this.store();
    if (!s?.customDomain) {
      return;
    }
    this.domainRefreshLoading.set(true);
    this.domainCheckError.set('');
    try {
      const result = await this.storesService.getDomainStatus(s.id, s.customDomain);
      this.domainBackendStatus.set((result.status as 'ACTIVE' | 'VALIDATING' | 'PENDING_DNS') || '');
      if (result.status === 'ACTIVE') {
        await this.verifyDNS(true);
      }
    } catch (err) {
      this.domainCheckError.set(
        errorMessage(err, 'No se pudo consultar el estado del dominio. Reintentá en unos segundos.'),
      );
    } finally {
      this.domainRefreshLoading.set(false);
    }
  }

  copyDnsRecord(type: string, value: string): void {
    const key = `${type}:${value}`;
    this.domainCopiedKey.set(key);
    void this.staffService.copyToClipboard(value);
    window.setTimeout(() => {
      if (this.domainCopiedKey() === key) {
        this.domainCopiedKey.set(null);
      }
    }, 1800);
  }

  openDisconnectDomainModal(): void {
    this.domainDisconnectError.set('');
    this.domainDisconnectOpen.set(true);
  }

  cancelDisconnectDomainModal(): void {
    if (this.isDisconnectingDomain()) {
      return;
    }
    this.domainDisconnectOpen.set(false);
  }

  async deleteItem(): Promise<void> {
    const s = this.store();
    const ref = this.itemReference().trim();
    if (!s || this.itemRunning()) {
      return;
    }
    if (!ref) {
      this.itemError.set('Ingresá el ID del pedido o el email del cliente.');
      return;
    }
    if (!this.itemArmed()) {
      this.itemArmed.set(true);
      this.itemError.set('');
      this.itemMessage.set('');
      return;
    }
    this.itemRunning.set(true);
    this.itemError.set('');
    this.itemMessage.set('');
    try {
      const res = await this.storesService.deleteStoreDataItem(s.id, this.itemKind(), ref);
      this.itemMessage.set(res.message);
      this.itemArmed.set(false);
      this.itemReference.set('');
    } catch (err) {
      this.itemError.set(errorMessage(err, 'No se pudo eliminar el elemento.'));
    } finally {
      this.itemRunning.set(false);
    }
  }

  resetItem(): void {
    this.itemArmed.set(false);
    this.itemError.set('');
    this.itemMessage.set('');
  }

  async runPurge(): Promise<void> {
    const s = this.store();
    if (!s || this.purgeRunning()) {
      return;
    }
    const typed = this.purgeConfirmInput().trim();
    if (typed !== s.slug && typed !== s.id) {
      this.purgeError.set('Escribí el slug o ID de la tienda para confirmar la limpieza.');
      return;
    }
    this.purgeRunning.set(true);
    this.purgeError.set('');
    this.purgeResult.set('');
    try {
      const res = await this.storesService.purgeStoreData(s.id, {
        deleteClients: this.purgeClients(),
        deleteOrders: this.purgeOrders(),
        deleteCatalog: this.purgeCatalog(),
        deleteContent: this.purgeContent(),
      });
      const parts = Object.entries(res.deleted || {})
        .filter(([, n]) => (n as number) > 0)
        .map(([k, n]) => `${k}: ${n}`);
      this.purgeResult.set(
        res.success
          ? 'Limpieza completada. ' + (parts.join(' · ') || 'Nada para borrar.')
          : 'Limpieza con errores (revisá los logs de la plataforma).',
      );
      this.purgeOpen.set(false);
    } catch (err) {
      this.purgeError.set(errorMessage(err, 'No se pudo limpiar los datos de la tienda.'));
    } finally {
      this.purgeRunning.set(false);
    }
  }
  /** Desvincula el dominio (disconnectDomain callable) y espera el onSnapshot. */
  async confirmDisconnectDomain(): Promise<void> {
    const s = this.store();
    if (!s?.customDomain || this.isDisconnectingDomain()) {
      return;
    }
    this.isDisconnectingDomain.set(true);
    this.domainDisconnectError.set('');
    try {
      await this.storesService.disconnectDomain(s.id, s.customDomain);
      this.domainDisconnectOpen.set(false);
      this.domainBackendStatus.set('');
      this.domainInput.set('');
    } catch (err) {
      this.domainDisconnectError.set(
        errorMessage(err, 'No se pudo desvincular el dominio. Reintentá en unos segundos.'),
      );
    } finally {
      this.isDisconnectingDomain.set(false);
    }
  }

  /** Health check en vivo: prueba el Access Token contra api.mercadopago.com/users/me. */
  async testMpConnection(): Promise<void> {
    const token = this.mpAccessToken().trim();
    if (!token) {
      this.mpPingResult.set({
        ok: false,
        message: 'Ingresá el Access Token para probar la conexión con Mercado Pago.',
      });
      return;
    }
    this.mpPinging.set(true);
    this.mpPingResult.set(null);
    try {
      const result = await this.storesService.pingMercadoPagoConnection(token);
      this.mpPingResult.set(result);
    } catch (err) {
      this.mpPingResult.set({
        ok: false,
        message: errorMessage(err, 'No se pudo conectar con Mercado Pago.'),
      });
    } finally {
      this.mpPinging.set(false);
    }
  }

  async loadStoreSubscription(storeId: string): Promise<void> {
    this.isLoadingSubscription.set(true);
    try {
      const subInfo = await this.storesService.getStoreSubscription(storeId);
      this.storeSubscription.set(subInfo);
      if (subInfo.subscription) {
        this.subscriptionStatusSelect.set(subInfo.subscription.status || 'active');
        this.customMonthlyPriceInput.set(subInfo.subscription.customMonthlyPrice ?? null);
        this.customAnnualPriceInput.set(subInfo.subscription.customAnnualPrice ?? null);
        this.discountPercentInput.set(subInfo.subscription.discountPercent ?? null);
      }
    } catch (err) {
      console.warn('[loadStoreSubscription] Error:', err);
    } finally {
      this.isLoadingSubscription.set(false);
    }
  }

  async generateSubscriptionLink(billingCycle: 'monthly' | 'annual'): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isGeneratingSubLink.set(true);
    this.subLinkGenerated.set(null);
    this.subLinkError.set(null);

    try {
      const result = await this.storesService.createStoreSubscriptionLink(s.id, billingCycle);
      if (result.checkoutUrl) {
        this.subLinkGenerated.set(result.checkoutUrl);
      }
      await this.loadStoreSubscription(s.id);
    } catch (err) {
      this.subLinkError.set(errorMessage(err, 'Error al generar enlace de pago de suscripción.'));
    } finally {
      this.isGeneratingSubLink.set(false);
    }
  }

  async saveCustomSubscriptionPricing(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isSavingDiscount.set(true);
    this.discountSaveSuccess.set(null);

    try {
      await this.storesService.updateStoreSubscriptionStatus({
        storeId: s.id,
        status: this.subscriptionStatusSelect(),
        customMonthlyPrice: this.customMonthlyPriceInput(),
        customAnnualPrice: this.customAnnualPriceInput(),
        discountPercent: this.discountPercentInput(),
      });
      this.discountSaveSuccess.set('Parámetros de suscripción actualizados con éxito.');
      await this.loadStoreSubscription(s.id);
      setTimeout(() => this.discountSaveSuccess.set(null), 3000);
    } catch (err) {
      this.discountSaveSuccess.set(errorMessage(err, 'Error al guardar parámetros.'));
    } finally {
      this.isSavingDiscount.set(false);
    }
  }

  async grantTrial(days: number): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isGrantingTrial.set(true);
    this.discountSaveSuccess.set(null);

    try {
      await this.storesService.updateStoreSubscriptionStatus({
        storeId: s.id,
        status: 'trial',
        trialDays: days,
      });
      this.discountSaveSuccess.set(`Período de prueba de ${days} días activado exitosamente.`);
      await this.loadStoreSubscription(s.id);
      setTimeout(() => this.discountSaveSuccess.set(null), 3500);
    } catch (err) {
      this.discountSaveSuccess.set(errorMessage(err, 'Error al activar período de prueba.'));
    } finally {
      this.isGrantingTrial.set(false);
    }
  }

  async grantFreeStore(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isGrantingTrial.set(true);
    this.discountSaveSuccess.set(null);

    try {
      await this.storesService.updateStoreSubscriptionStatus({
        storeId: s.id,
        status: 'complimentary',
      });
      this.discountSaveSuccess.set('Tienda bonificada al 100% (Gratis / Cortesía) exitosamente.');
      await this.loadStoreSubscription(s.id);
      setTimeout(() => this.discountSaveSuccess.set(null), 3500);
    } catch (err) {
      this.discountSaveSuccess.set(errorMessage(err, 'Error al activar tienda bonificada.'));
    } finally {
      this.isGrantingTrial.set(false);
    }
  }

  async simulateStoreExpiration(
    mode: 'imminent' | 'grace_period' | 'expired_suspended' | 'reset_trial',
  ): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isSimulatingExpiration.set(true);
    this.discountSaveSuccess.set(null);

    const labels: Record<string, string> = {
      imminent: 'Simulación aplicada: Expira en 1 hora.',
      grace_period: 'Simulación aplicada: En período de gracia (vencido hace 2 días).',
      expired_suspended:
        'Simulación aplicada: Tienda suspendida por vencimiento (vencido hace 7 días).',
      reset_trial: 'Simulación restablecida: Prueba renovada por 14 días.',
    };

    try {
      await this.storesService.updateStoreSubscriptionStatus({
        storeId: s.id,
        simulateExpiration: mode,
      });
      this.discountSaveSuccess.set(labels[mode] || 'Simulación de vencimiento ejecutada.');
      await this.loadStoreSubscription(s.id);
      setTimeout(() => this.discountSaveSuccess.set(null), 4000);
    } catch (err) {
      this.discountSaveSuccess.set(errorMessage(err, 'Error al simular vencimiento.'));
    } finally {
      this.isSimulatingExpiration.set(false);
    }
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
    await this.orchestrationService.seedData(
      id,
      p.includeMockData,
      p.provisioningMode,
      p.verticalId,
    );
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
