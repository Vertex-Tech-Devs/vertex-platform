import { Injectable, inject, signal } from '@angular/core';
import { getFirestore } from 'firebase/firestore';
import { errorMessage } from '@core/utils/error.util';
import { StoresService, type StoreSubscriptionInfo } from '@core/services/stores';
import { AuthService } from '@core/services/auth';
import type { Store } from '@core/models/store';
import { StoreDetailStaffService } from '../components/store-detail/services/store-detail-staff.service';

@Injectable({ providedIn: 'root' })
export class StoreDetailPaymentsService {
  readonly auth = inject(AuthService);
  /** Tienda en edición (la setea el contenedor/child para acciones sin argumentos). */
  readonly store = signal<Store | null>(null);
  private storesService = inject(StoresService);
  private staffService = inject(StoreDetailStaffService);
  private db = getFirestore();

  readonly activeSubTab = signal<'saas' | 'gateway'>('gateway');

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

  readonly showSimulationTools = signal(false);
  readonly isSimulatingExpiration = signal(false);

  // Pricing Override (Super Admin)
  readonly showPricingOverrideModal = signal(false);
  readonly isSavingOverride = signal(false);
  readonly overrideType = signal<'percentage_discount' | 'fixed_discount' | 'custom_fixed_price'>(
    'percentage_discount',
  );
  readonly overrideValue = signal<number>(20);
  readonly overrideDuration = signal<'lifetime' | 'recurring_cycles' | 'single_cycle'>('lifetime');
  readonly overrideCyclesRemaining = signal<number>(3);
  readonly overrideReason = signal<string>('Beneficio especial Vertex Partner');

  // Prepaid Bridge (Manual Transfer)
  readonly isSavingPrepaid = signal(false);
  readonly prepaidPeriodEndInput = signal<string>('');
  readonly prepaidNotesInput = signal<string>('');

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

  async applyPricingOverride(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isSavingOverride.set(true);
    try {
      await this.storesService.setStorePricingOverride({
        storeId: s.id,
        type: this.overrideType(),
        value: Number(this.overrideValue()),
        duration: this.overrideDuration(),
        cyclesRemaining:
          this.overrideDuration() === 'recurring_cycles'
            ? Number(this.overrideCyclesRemaining())
            : undefined,
        reason: this.overrideReason().trim() || 'Beneficio especial Super Admin',
      });
      this.showPricingOverrideModal.set(false);
      this.discountSaveSuccess.set('Beneficio especial asignado correctamente.');
      await this.loadStoreSubscription(s.id);
      setTimeout(() => this.discountSaveSuccess.set(null), 3500);
    } catch (err) {
      this.discountSaveSuccess.set(errorMessage(err, 'Error al aplicar beneficio.'));
    } finally {
      this.isSavingOverride.set(false);
    }
  }

  async revokePricingOverride(): Promise<void> {
    const s = this.store();
    if (!s) {
      return;
    }
    this.isSavingOverride.set(true);
    try {
      await this.storesService.removeStorePricingOverride(s.id);
      this.discountSaveSuccess.set('Beneficio especial revocado.');
      await this.loadStoreSubscription(s.id);
      setTimeout(() => this.discountSaveSuccess.set(null), 3500);
    } catch (err) {
      this.discountSaveSuccess.set(errorMessage(err, 'Error al revocar beneficio.'));
    } finally {
      this.isSavingOverride.set(false);
    }
  }

  async applyPrepaidCoverage(): Promise<void> {
    const s = this.store();
    if (!s || !this.prepaidPeriodEndInput()) {
      return;
    }
    this.isSavingPrepaid.set(true);
    try {
      await this.storesService.setStorePrepaidCoverage({
        storeId: s.id,
        currentPeriodEnd: this.prepaidPeriodEndInput(),
        notes: this.prepaidNotesInput().trim() || 'Cobertura manual por transferencia bancaria',
      });
      this.discountSaveSuccess.set('Cobertura prepaga registrada con éxito (Prepaid Bridge).');
      this.prepaidNotesInput.set('');
      await this.loadStoreSubscription(s.id);
      setTimeout(() => this.discountSaveSuccess.set(null), 3500);
    } catch (err) {
      this.discountSaveSuccess.set(errorMessage(err, 'Error al registrar cobertura prepaga.'));
    } finally {
      this.isSavingPrepaid.set(false);
    }
  }
}
