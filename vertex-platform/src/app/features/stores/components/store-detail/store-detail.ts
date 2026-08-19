import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@core/utils/error.util';
import type { OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { StoresService } from '@core/services/stores';
import { AppSpinnerComponent } from '../../../../shared/components/app-spinner/app-spinner.component';
import { AuthService } from '@core/services/auth';
import type { DnsRecord } from '@core/services/stores';
import type {
  ProvisioningStep,
  StoreConfig,
  StaffMember,
  PendingInvitation,
  Store,
  TemplateVersion,
} from '@core/models/store';

const STEP_ORDER = [
  'createProject',
  'linkBilling',
  'addFirebase',
  'enableApis',
  'createWebApp',
  'initFirestore',
  'configureEmail',
  'initAdmin',
  'grantAccess',
  'triggerDeploy',
];

export interface ActionProgressState {
  status: 'idle' | 'running' | 'success' | 'error';
  progress: number;
  message: string;
}

const IDLE_ACTION_STATE: ActionProgressState = { status: 'idle', progress: 0, message: '' };

@Component({
  selector: 'app-store-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, ReactiveFormsModule, AppSpinnerComponent],
  templateUrl: './store-detail.html',
  styleUrl: './store-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreDetail implements OnInit {
  private storesService = inject(StoresService);
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  readonly deployHistory = signal<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Estado del redirect URI OAuth del shard (login con Google del admin de la tienda)
  readonly oauthRedirect = signal<{
    ok: boolean;
    redirectUri: string | null;
    consoleUrl?: string;
  } | null>(null);

  // Tab management
  readonly activeTab = signal<'orquestacion' | 'config' | 'equipo' | 'dominios' | 'historial'>(
    'orquestacion',
  );

  readonly store = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return this.storesService.stores().find((s) => s.id === id) ?? null;
  });

  readonly storeUrl = computed(() => {
    const s = this.store();
    if (!s) {
      return '';
    }
    if (window.location.hostname === 'localhost') {
      return `http://localhost:4201/shop?tenantId=${s.slug}`;
    }
    return s.defaultUrl;
  });

  readonly orderedSteps = computed(() => {
    const steps = this.store()?.provisioningSteps ?? {};
    return STEP_ORDER.filter((id) => id in steps);
  });

  readonly provisioningSnapshot = computed(() => {
    const steps = this.store()?.provisioningSteps ?? {};
    const ordered = this.orderedSteps().map((id) => ({ id, ...steps[id] }));
    const total = ordered.length;
    const done = ordered.filter((step) => step.status === 'done').length;
    const running = ordered.find((step) => step.status === 'running');
    const failed = ordered.find((step) => step.status === 'error');
    const pending = ordered.find((step) => step.status === 'pending');
    const current = running ?? failed ?? pending ?? ordered[ordered.length - 1];

    return {
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      currentLabel: current?.label ?? 'Esperando inicio',
      currentStatus: current?.status ?? 'pending',
    };
  });

  readonly progressPercent = computed(() => {
    return this.provisioningSnapshot().percent;
  });

  // Action loading signals
  readonly isRedeploying = signal(false);
  readonly isSeeding = signal(false);
  readonly isRetrying = signal(false);
  readonly isDeleting = signal(false);
  readonly isConnectingDomain = signal(false);
  readonly isSuspending = signal(false);
  readonly isActivating = signal(false);
  readonly isSaving = signal(false);

  // Confirmation modales
  readonly showDeleteConfirm = signal(false);
  readonly showSleepConfirm = signal(false);
  readonly showEditModal = signal(false);
  readonly showSeedConfirm = signal(false);
  readonly seedIncludeMock = signal(true);
  readonly logoPreviewError = signal(false);

  // Error/Success state signals
  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly saveError = signal('');
  readonly dnsRecords = signal<DnsRecord[]>([]);

  readonly localRedeployError = signal('');

  // Individual Action Mini Progress Bar Signals
  readonly redeployActionState = computed<ActionProgressState>(() => {
    const s = this.store();
    if (!s) {
      return IDLE_ACTION_STATE;
    }

    if (this.localRedeployError()) {
      return {
        status: 'error',
        progress: 100,
        message: this.localRedeployError(),
      };
    }

    if (s.redeployStatus === 'deploying' || this.isRedeploying()) {
      return {
        status: 'running',
        progress: 60,
        message: '🔨 Compilando e instalando infraestructura en GitHub Actions (en curso...)',
      };
    }

    if (s.redeployStatus === 'failed') {
      return {
        status: 'error',
        progress: 100,
        message: s.redeployError || '✗ Falló el despliegue del storefront en GitHub Actions.',
      };
    }

    if (s.redeployStatus === 'idle' && s.lastDeployedAt && s.redeployStartedAt) {
      const lastDeployTime = new Date(this.formatDate(s.lastDeployedAt) ?? 0).getTime();
      const redeployStartTime = new Date(this.formatDate(s.redeployStartedAt) ?? 0).getTime();

      if (lastDeployTime >= redeployStartTime) {
        return {
          status: 'success',
          progress: 100,
          message: '✓ Re-despliegue completado con éxito. La nueva versión ya está disponible en Firebase Hosting.',
        };
      }
    }

    return IDLE_ACTION_STATE;
  });

  readonly applyVersionActionState = signal<ActionProgressState>(IDLE_ACTION_STATE);
  readonly seedActionState = signal<ActionProgressState>(IDLE_ACTION_STATE);
  readonly suspendActionState = signal<ActionProgressState>(IDLE_ACTION_STATE);
  readonly domainActionState = signal<ActionProgressState>(IDLE_ACTION_STATE);
  readonly retryActionState = signal<ActionProgressState>(IDLE_ACTION_STATE);

  readonly domainInput = signal('');
  deleteConfirmInput = '';
  sleepConfirmInput = '';
  private readonly optionalUrlRegex = /^(|https?:\/\/[^\s$.?#].[^\s]*)$/i;

  // Edit general store form
  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    ownerEmail: ['', [Validators.required, Validators.email]],
    logoUrl: [''],
  });

  // Dynamic Hot UPDATE Configuration fields
  readonly isLoadingConfig = signal(false);
  readonly isSavingConfig = signal(false);
  readonly configError = signal('');
  readonly configSuccess = signal('');

  readonly configForm = this.fb.group({
    storeName: ['', Validators.required],
    strapline: [''],
    logoUrl: ['', [Validators.pattern(this.optionalUrlRegex)]],
    faviconUrl: ['', [Validators.pattern(this.optionalUrlRegex)]],
    currency: ['ARS', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    currencySymbol: ['$', [Validators.required, Validators.maxLength(5)]],
    country: ['Argentina', Validators.required],
    contact: this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      whatsapp: [''],
      address: [''],
      instagram: [''],
      facebook: ['', [Validators.pattern(this.optionalUrlRegex)]],
    }),
    seo: this.fb.group({
      metaTitle: [''],
      metaDescription: [''],
    }),
    payments: this.fb.group({
      mercadoPago: this.fb.group({
        publicKey: [''],
        accessToken: [''],
        accessTokenSecret: ['mp-access-token'],
        accessTokenMasked: [''],
        accountEmail: [''],
        accountUserId: [''],
        webhookUrl: [''],
        validationStatus: ['pending'],
        validationMessage: [''],
      }),
    }),
  });

  // Team RBAC fields
  readonly staff = signal<StaffMember[]>([]);
  readonly invitations = signal<PendingInvitation[]>([]);
  readonly isLoadingStaff = signal(false);
  readonly isInvitingStaff = signal(false);
  readonly inviteError = signal('');
  readonly inviteSuccess = signal('');

  readonly generatedResetLink = signal('');
  readonly isGeneratingLink = signal(false);
  readonly copyFeedbackSuccess = signal(false);

  readonly inviteForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['admin', Validators.required],
  });

  // Version management
  readonly availableVersions = signal<TemplateVersion[]>([]);
  readonly isLoadingVersions = signal(false);
  readonly isUpdatingVersion = signal(false);
  readonly isUpdatingAutoUpdate = signal(false);
  readonly selectedVersion = signal('');
  readonly versionUpdateError = signal('');
  readonly versionUpdateSuccess = signal('');

  // Domain DNS fields
  readonly domainStatus = signal<'live' | 'pending' | 'none'>('none');
  readonly isVerifyingDNS = signal(false);
  readonly dnsVerificationError = signal('');
  readonly dnsVerificationSuccess = signal('');
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

  ngOnInit(): void {
    void this.loadVersions();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.storesService
        .getStoreDeploymentHistory(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((history) => {
          this.deployHistory.set(history);
        });
      void this.checkOAuthRedirect(id);
    }
  }

  private async checkOAuthRedirect(storeId: string): Promise<void> {
    try {
      const fns = getFunctions();
      const check = httpsCallable<{ storeId: string }, any>(fns, 'checkStoreOAuthRedirect'); // eslint-disable-line @typescript-eslint/no-explicit-any
      const res = await check({ storeId });
      const data = res.data as { ok: boolean; redirectUri: string | null; consoleUrl?: string };
      this.oauthRedirect.set({
        ok: data.ok,
        redirectUri: data.redirectUri,
        consoleUrl: data.consoleUrl,
      });
    } catch {
      this.oauthRedirect.set(null);
    }
  }

  async copyOAuthUri(): Promise<void> {
    const uri = this.oauthRedirect()?.redirectUri;
    if (!uri) {
      return;
    }
    try {
      await navigator.clipboard.writeText(uri);
    } catch {
      // Fallback para contextos no seguros (http) — textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = uri;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  async loadVersions(): Promise<void> {
    this.isLoadingVersions.set(true);
    try {
      const versions = await this.storesService.listTemplateVersions();
      this.availableVersions.set(versions);
      const current = this.store()?.templateVersion;
      if (current) {
        this.selectedVersion.set(current);
      } else if (versions.length > 0) {
        this.selectedVersion.set(versions[0].version);
      }
    } catch (err) {
      console.error('Error loading template versions:', err);
    } finally {
      this.isLoadingVersions.set(false);
    }
  }

  async applyVersionUpdate(): Promise<void> {
    const s = this.store();
    const version = this.selectedVersion();
    if (!s || !version || s.templateVersion === version) {
      return;
    }

    this.isUpdatingVersion.set(true);
    this.versionUpdateError.set('');
    this.versionUpdateSuccess.set('');
    this.applyVersionActionState.set({
      status: 'running',
      progress: 45,
      message: `Enviando solicitud de cambio a plantilla v${version}...`,
    });
    try {
      await this.storesService.updateStoreVersion(s.id, version);
      const msg = `✓ Plantilla v${version} aplicada a la tienda. El deploy automatizado en GitHub Actions iniciará la actualización.`;
      this.versionUpdateSuccess.set(msg);
      this.applyVersionActionState.set({
        status: 'success',
        progress: 100,
        message: msg,
      });
    } catch (err: unknown) {
      const msg = errorMessage(err, 'Error al iniciar la actualización.');
      this.versionUpdateError.set(msg);
      this.applyVersionActionState.set({
        status: 'error',
        progress: 100,
        message: `✗ Error al aplicar versión v${version}: ${msg}`,
      });
    } finally {
      this.isUpdatingVersion.set(false);
    }
  }

  async toggleAutoUpdate(event: Event): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    this.isUpdatingAutoUpdate.set(true);
    try {
      await this.storesService.updateStore(s.id, { autoUpdate: checked });
    } catch (err) {
      console.error('Error updating autoUpdate:', err);
    } finally {
      this.isUpdatingAutoUpdate.set(false);
    }
  }

  // Dynamic Tabs switching
  async setTab(
    tab: 'orquestacion' | 'config' | 'equipo' | 'dominios' | 'historial',
  ): Promise<void> {
    this.activeTab.set(tab);
    const s = this.store();
    if (!s) {
      return;
    }

    if (tab === 'config') {
      await this.loadConfig();
    } else if (tab === 'equipo') {
      await this.loadStaff();
    } else if (tab === 'dominios') {
      if (s.customDomain) {
        this.domainInput.set(s.customDomain);
        await this.verifyDNS(true);
      }
    }
  }

  // Configuration Loading and Saving
  async loadConfig(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isLoadingConfig.set(true);
    this.configError.set('');
    this.configSuccess.set('');
    try {
      const computedWebhookUrl = this.computeMercadoPagoWebhookUrl(s);
      const config = await this.storesService.getStoreConfig(s.id);
      if (config) {
        this.configForm.patchValue({
          storeName: config.storeName || s.name || '',
          strapline: config.strapline || '',
          logoUrl: config.logoUrl || s.logoUrl || '',
          faviconUrl: config.faviconUrl || '',
          currency: config.currency || 'ARS',
          currencySymbol: config.currencySymbol || '$',
          country: config.country || 'Argentina',
          contact: {
            email: config.contact?.email || s.ownerEmail || '',
            phone: config.contact?.phone || '',
            whatsapp: config.contact?.whatsapp || '',
            address: config.contact?.address || '',
            instagram: config.contact?.instagram || '',
            facebook: config.contact?.facebook || '',
          },
          seo: {
            metaTitle: config.seo?.metaTitle || '',
            metaDescription: config.seo?.metaDescription || '',
          },
          payments: {
            mercadoPago: {
              publicKey: config.payments?.mercadoPago?.publicKey || '',
              accessToken: '',
              accessTokenSecret:
                config.payments?.mercadoPago?.accessTokenSecret || 'mp-access-token',
              accessTokenMasked: config.payments?.mercadoPago?.accessTokenMasked || '',
              accountEmail: config.payments?.mercadoPago?.accountEmail || '',
              accountUserId: config.payments?.mercadoPago?.accountUserId || '',
              webhookUrl: computedWebhookUrl || config.payments?.mercadoPago?.webhookUrl || '',
              validationStatus: config.payments?.mercadoPago?.validationStatus || 'pending',
              validationMessage: config.payments?.mercadoPago?.validationMessage || '',
            },
          },
        });
      } else {
        // Pre-fill with store defaults
        this.configForm.patchValue({
          storeName: s.name,
          logoUrl: s.logoUrl ?? '',
          contact: {
            email: s.ownerEmail,
            phone: '',
            whatsapp: '',
            address: '',
            instagram: '',
            facebook: '',
          },
          payments: {
            mercadoPago: {
              publicKey: '',
              accessToken: '',
              accessTokenSecret: 'mp-access-token',
              accessTokenMasked: '',
              accountEmail: '',
              accountUserId: '',
              webhookUrl: computedWebhookUrl,
              validationStatus: 'pending',
              validationMessage: '',
            },
          },
        });
      }
    } catch (err) {
      console.error('Error loading config:', err);
      this.configError.set('No se pudo cargar la configuración de la tienda.');
    } finally {
      this.isLoadingConfig.set(false);
    }
  }

  async saveConfig(): Promise<void> {
    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      return;
    }
    const s = this.store();
    if (!s) {
      return;
    }
    this.isSavingConfig.set(true);
    this.configError.set('');
    this.configSuccess.set('');
    try {
      const formValue = this.configForm.value as StoreConfig;
      formValue.storeName = formValue.storeName?.trim();
      formValue.strapline = formValue.strapline?.trim();
      formValue.logoUrl = formValue.logoUrl?.trim();
      formValue.faviconUrl = formValue.faviconUrl?.trim();
      formValue.currency = (formValue.currency || '').trim().toUpperCase();
      formValue.currencySymbol = (formValue.currencySymbol || '').trim();
      formValue.country = (formValue.country || '').trim();
      formValue.contact.email = formValue.contact.email?.trim().toLowerCase();
      formValue.contact.facebook = formValue.contact.facebook?.trim();
      formValue.seo.metaTitle = formValue.seo.metaTitle?.trim();
      formValue.seo.metaDescription = formValue.seo.metaDescription?.trim();
      if (formValue.payments?.mercadoPago) {
        formValue.payments.mercadoPago.publicKey = formValue.payments.mercadoPago.publicKey?.trim();
        formValue.payments.mercadoPago.accessToken =
          formValue.payments.mercadoPago.accessToken?.trim();

        const computedWebhookUrl = this.computeMercadoPagoWebhookUrl(s);
        formValue.payments.mercadoPago.webhookUrl =
          computedWebhookUrl || formValue.payments.mercadoPago.webhookUrl?.trim();

        const hasStoredToken = !!formValue.payments.mercadoPago.accessTokenSecret?.trim();
        const isRotatingToken = !!formValue.payments.mercadoPago.accessToken;
        if ((hasStoredToken || isRotatingToken) && !formValue.payments.mercadoPago.publicKey) {
          this.configError.set('Para activar Mercado Pago necesitás configurar una Public Key.');
          return;
        }
      }

      await this.storesService.updateStoreConfig(s.id, formValue);
      this.configSuccess.set(
        'Configuración actualizada con éxito. Los cambios se aplicarán en tiempo real.',
      );

      // Update central store doc if needed
      const centralUpdates: Partial<Pick<Store, 'name' | 'logoUrl'>> = {};
      if (formValue.storeName && formValue.storeName !== s.name) {
        centralUpdates.name = formValue.storeName;
      }
      if (formValue.logoUrl !== undefined && formValue.logoUrl !== s.logoUrl) {
        centralUpdates.logoUrl = formValue.logoUrl;
      }

      if (Object.keys(centralUpdates).length > 0) {
        await this.storesService.updateStore(s.id, centralUpdates);
      }
    } catch (err) {
      console.error('Error saving config:', err);
      this.configError.set('No se pudo guardar la configuración. Intentá de nuevo.');
    } finally {
      this.isSavingConfig.set(false);
    }
  }

  computeMercadoPagoWebhookUrl(store: Store | null): string {
    if (!store) {
      return '';
    }
    const projectId = store.runtimeProjectId || store.firebaseProjectId;
    if (!projectId) {
      return '';
    }
    return `https://us-central1-${projectId}.cloudfunctions.net/mercadoPagoWebhookHandler`;
  }

  // Staff management
  async loadStaff(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isLoadingStaff.set(true);
    this.inviteError.set('');
    this.inviteSuccess.set('');
    try {
      const res = await this.storesService.getStoreStaff(s.id);
      this.staff.set(res.staff);
      this.invitations.set(res.invitations);
    } catch (err) {
      console.error('Error loading staff:', err);
      this.inviteError.set('No se pudieron cargar los miembros del equipo.');
    } finally {
      this.isLoadingStaff.set(false);
    }
  }

  async sendInvitation(): Promise<void> {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    const s = this.store();
    if (!s) {
      return;
    }
    this.isInvitingStaff.set(true);
    this.inviteError.set('');
    this.inviteSuccess.set('');
    try {
      const { email, role } = this.inviteForm.value;
      const result = await this.storesService.inviteStaff(s.id, email!, role!);
      if (result.inviteEmailSent) {
        this.inviteSuccess.set(
          `Invitación enviada con éxito a ${email}. El acceso queda habilitado con Google OAuth y el rol seleccionado.`,
        );
      } else {
        this.inviteSuccess.set(
          `El correo ${email} quedó preautorizado con rol ${role}, pero el email automático falló. Compartí manualmente el acceso por Google OAuth.`,
        );
      }
      this.inviteForm.reset({ email: '', role: 'admin' });
      await this.loadStaff();
    } catch (err) {
      console.error('Error inviting staff:', err);
      const msg = errorMessage(err);
      this.inviteError.set(msg || 'No se pudo enviar la invitación. Intentá de nuevo.');
    } finally {
      this.isInvitingStaff.set(false);
    }
  }

  async generateAccessLink(email: string): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isGeneratingLink.set(true);
    this.generatedResetLink.set('');
    this.copyFeedbackSuccess.set(false);
    this.actionError.set('');
    this.inviteError.set('');
    try {
      const res = await this.storesService.generatePasswordResetLink(s.id, email);
      if (res.success && res.actionLink) {
        this.generatedResetLink.set(res.actionLink);
      } else {
        this.actionError.set('No se pudo obtener el enlace de acceso manual.');
        this.inviteError.set('No se pudo obtener el enlace de acceso manual.');
      }
    } catch (err: unknown) {
      const msg = errorMessage(err, 'Error al generar link de acceso.');
      this.actionError.set(msg);
      this.inviteError.set(msg);
    } finally {
      this.isGeneratingLink.set(false);
    }
  }

  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copyFeedbackSuccess.set(true);
      setTimeout(() => this.copyFeedbackSuccess.set(false), 3000);
    } catch {
      console.error('Failed to copy to clipboard automatically.');
    }
  }

  // DNS & Domain verification
  async verifyDNS(silent = false): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    const domain = s.customDomain || this.domainInput();
    if (!domain) {
      return;
    }

    if (!silent) {
      this.isVerifyingDNS.set(true);
      this.dnsVerificationError.set('');
      this.dnsVerificationSuccess.set('');
    }
    try {
      const res = await this.storesService.verifyDomain(s.id, domain.trim());
      this.dnsRecords.set(res.dnsRecords);
      if (res.status === 'live') {
        this.domainStatus.set('live');
        if (!silent) {
          this.dnsVerificationSuccess.set('¡Dominio verificado con éxito y activo!');
        }
      } else {
        this.domainStatus.set('pending');
        if (!silent) {
          this.dnsVerificationError.set(
            'La verificación del dominio está pendiente. Completá la configuración DNS.',
          );
        }
      }
    } catch (err) {
      console.error('Error verifying DNS:', err);
      if (!silent) {
        const msg = errorMessage(err);
        this.dnsVerificationError.set(
          msg || 'No se pudo verificar el estado DNS. Intentá de nuevo.',
        );
      }
    } finally {
      if (!silent) {
        this.isVerifyingDNS.set(false);
      }
    }
  }

  openEdit(): void {
    const s = this.store();
    if (!s) {
      return;
    }
    this.editForm.setValue({
      name: s.name,
      ownerEmail: s.ownerEmail,
      logoUrl: s.logoUrl ?? '',
    });
    this.saveError.set('');
    this.showEditModal.set(true);
  }

  async saveStore(): Promise<void> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const id = this.store()?.id;
    if (!id) {
      return;
    }
    this.isSaving.set(true);
    this.saveError.set('');
    try {
      const { name, ownerEmail, logoUrl } = this.editForm.value;
      const normalizedLogo = (logoUrl ?? '').trim();
      await this.storesService.updateStore(id, {
        name: name!.trim(),
        ownerEmail: ownerEmail!.trim(),
        logoUrl: normalizedLogo || null,
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
    if (!id) {
      return;
    }
    this.isSuspending.set(true);
    this.actionError.set('');
    this.suspendActionState.set({
      status: 'running',
      progress: 50,
      message: 'Suspendiendo proyecto temporalmente...',
    });
    try {
      await this.storesService.suspendStore(id);
      this.showSleepConfirm.set(false);
      this.suspendActionState.set({
        status: 'success',
        progress: 100,
        message: '✓ Tienda suspendida correctamente.',
      });
    } catch {
      this.actionError.set('No se pudo suspender la tienda.');
      this.suspendActionState.set({
        status: 'error',
        progress: 100,
        message: '✗ Error al suspender la tienda.',
      });
    } finally {
      this.isSuspending.set(false);
      this.sleepConfirmInput = '';
    }
  }

  async activate(): Promise<void> {
    const id = this.store()?.id;
    if (!id) {
      return;
    }
    this.isActivating.set(true);
    this.actionError.set('');
    this.suspendActionState.set({
      status: 'running',
      progress: 50,
      message: 'Reactivando tienda y acceso al storefront...',
    });
    try {
      await this.storesService.activateStore(id);
      this.suspendActionState.set({
        status: 'success',
        progress: 100,
        message: '✓ Tienda reactivada exitosamente.',
      });
    } catch {
      this.actionError.set('No se pudo reactivar la tienda.');
      this.suspendActionState.set({
        status: 'error',
        progress: 100,
        message: '✗ Error al reactivar la tienda.',
      });
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
    if (!id) {
      return;
    }
    this.isRedeploying.set(true);
    this.localRedeployError.set('');
    try {
      await this.storesService.redeployStore(id);
    } catch (err: unknown) {
      const msg = errorMessage(err);
      this.localRedeployError.set('No se pudo iniciar el re-despliegue: ' + msg);
    } finally {
      this.isRedeploying.set(false);
    }
  }

  openSeedConfirm(): void {
    this.seedIncludeMock.set(true);
    this.showSeedConfirm.set(true);
  }

  async seedStore(): Promise<void> {
    const id = this.store()?.id;
    if (!id) {
      return;
    }
    this.showSeedConfirm.set(false);
    this.isSeeding.set(true);
    this.actionError.set('');
    this.actionSuccess.set('');
    this.seedActionState.set({
      status: 'running',
      progress: 45,
      message: 'Generando e insertando catálogo de prueba en Firestore...',
    });
    try {
      await this.storesService.seedStore(id, this.seedIncludeMock());
      const msg = '✓ ¡Catálogo de productos de prueba cargado con éxito en tu tienda!';
      this.actionSuccess.set(msg);
      this.seedActionState.set({
        status: 'success',
        progress: 100,
        message: msg,
      });
    } catch (err: unknown) {
      const msg = errorMessage(err);
      this.actionError.set('Error al semillar datos: ' + msg);
      this.seedActionState.set({
        status: 'error',
        progress: 100,
        message: '✗ Error al semillar datos: ' + msg,
      });
    } finally {
      this.isSeeding.set(false);
    }
  }

  async retry(): Promise<void> {
    const id = this.store()?.id;
    if (!id) {
      return;
    }
    this.isRetrying.set(true);
    this.actionError.set('');
    this.retryActionState.set({
      status: 'running',
      progress: 30,
      message: 'Reintentando aprovisionamiento del proyecto...',
    });
    try {
      await this.storesService.retryProvisioning(id);
      this.retryActionState.set({
        status: 'success',
        progress: 100,
        message: '✓ Reintento de aprovisionamiento iniciado.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo reintentar aprovisionamiento.';
      this.actionError.set(msg);
      this.retryActionState.set({
        status: 'error',
        progress: 100,
        message: '✗ Error: ' + msg,
      });
    } finally {
      this.isRetrying.set(false);
    }
  }

  async connectDomain(): Promise<void> {
    const id = this.store()?.id;
    if (!id || !this.domainInput()) {
      return;
    }
    this.isConnectingDomain.set(true);
    this.dnsVerificationError.set('');
    this.dnsVerificationSuccess.set('');
    try {
      const result = await this.storesService.connectDomain(id, this.domainInput().trim());
      this.dnsRecords.set(result.dnsRecords);
      this.domainStatus.set('pending');
      // Wait a moment and verify domain silently
      setTimeout(() => void this.verifyDNS(true), 1500);
    } catch {
      this.dnsVerificationError.set('No se pudo conectar el dominio. Verificá que sea válido.');
    } finally {
      this.isConnectingDomain.set(false);
    }
  }

  formatDate(dateVal: unknown): Date | string | null {
    if (!dateVal) {
      return null;
    }
    if (typeof dateVal === 'string') {
      const match = dateVal.match(/Timestamp\(seconds=(\d+),\s*nanoseconds=(\d+)\)/);
      if (match) {
        return new Date(parseInt(match[1], 10) * 1000);
      }
    }
    const val = dateVal as Record<string, unknown>;
    if (typeof val['toDate'] === 'function') {
      return (val['toDate'] as () => Date)();
    }
    if (typeof val['seconds'] === 'number') {
      return new Date(val['seconds'] * 1000);
    }
    return dateVal as Date | string | null;
  }

  async deleteStore(): Promise<void> {
    const s = this.store();
    if (!s || this.deleteConfirmInput !== s.slug) {
      return;
    }
    this.isDeleting.set(true);
    this.actionError.set('');
    try {
      await this.storesService.deleteStore(s.id);
      void this.router.navigate(['/stores']);
    } catch {
      this.actionError.set('No se pudo eliminar la tienda. Intentá de nuevo.');
      this.isDeleting.set(false);
      this.showDeleteConfirm.set(false);
      this.deleteConfirmInput = '';
    }
  }

  refreshDeployHistory(): void {
    this.deployHistory.set([]);
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.storesService
        .getStoreDeploymentHistory(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((history) => {
          this.deployHistory.set(history);
        });
    }
  }
}
