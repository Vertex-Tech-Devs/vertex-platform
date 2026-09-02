import { Component, type OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StoresService, type PlatformBillingConfig } from '@core/services/stores';
import type { Store } from '@core/models/store';
import { errorMessage } from '@core/utils/error.util';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
  templateUrl: './subscriptions.html',
  styleUrl: './subscriptions.scss',
})
export class Subscriptions implements OnInit {
  private storesSvc = inject(StoresService);

  readonly platformBillingConfig = signal<PlatformBillingConfig | null>(null);
  readonly isLoading = signal(true);
  readonly isSavingPricing = signal(false);
  readonly showMasterConfig = signal(false);
  readonly pricingSaveSuccess = signal<string | null>(null);
  readonly pricingSaveError = signal<string | null>(null);

  readonly editMonthlyPrice = signal<number>(50000);
  readonly editAnnualPrice = signal<number>(500000);
  readonly editMpAccessToken = signal<string>('');

  // Store search & payment links
  readonly storeSearchQuery = signal<string>('');
  readonly copiedStoreId = signal<string | null>(null);

  // Store subscription breakdown
  readonly stores = this.storesSvc.stores;

  readonly filteredStores = computed(() => {
    const list = this.stores() || [];
    const q = this.storeSearchQuery().toLowerCase().trim();
    if (!q) {
      return list.slice(0, 10);
    }
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.ownerEmail.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  });

  readonly activeSubscriptionsCount = computed(() => {
    const list = this.stores() || [];
    return list.filter((s) => s.subscription?.status === 'active').length;
  });

  readonly trialSubscriptionsCount = computed(() => {
    const list = this.stores() || [];
    return list.filter((s) => !s.subscription?.status || s.subscription?.status === 'trial').length;
  });

  readonly complimentaryCount = computed(() => {
    const list = this.stores() || [];
    return list.filter((s) => s.subscription?.status === 'complimentary').length;
  });

  readonly pastDueCount = computed(() => {
    const list = this.stores() || [];
    return list.filter(
      (s) => s.subscription?.status === 'past_due' || s.subscription?.status === 'suspended',
    ).length;
  });

  ngOnInit(): void {
    void this.loadPlatformBillingConfig();
  }

  toggleMasterConfig(): void {
    this.showMasterConfig.update((v) => !v);
  }

  getPublicCheckoutUrl(storeId: string): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/pay/${storeId}`;
    }
    return `https://vertex-platform-app.web.app/pay/${storeId}`;
  }

  getWhatsAppShareUrl(store: Store): string {
    const url = this.getPublicCheckoutUrl(store.id);
    const text = encodeURIComponent(
      `¡Hola! Te comparto el enlace seguro para activar la suscripción de tu tienda ${store.name} en Vertex: ${url}`,
    );
    return `https://wa.me/?text=${text}`;
  }

  copyStorePaymentLink(storeId: string): void {
    const url = this.getPublicCheckoutUrl(storeId);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
    }
    this.copiedStoreId.set(storeId);
    setTimeout(() => {
      this.copiedStoreId.set(null);
    }, 2500);
  }

  async loadPlatformBillingConfig(): Promise<void> {
    this.isLoading.set(true);
    try {
      const config = await this.storesSvc.getPlatformBillingConfig();
      this.platformBillingConfig.set(config);
      if (config.pricing) {
        this.editMonthlyPrice.set(config.pricing.monthlyPrice);
        this.editAnnualPrice.set(config.pricing.annualPrice);
      }
    } catch (err: unknown) {
      this.pricingSaveError.set(errorMessage(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  async savePlatformPricing(): Promise<void> {
    this.isSavingPricing.set(true);
    this.pricingSaveSuccess.set(null);
    this.pricingSaveError.set(null);

    try {
      await this.storesSvc.updatePlatformBillingConfig({
        monthlyPrice: this.editMonthlyPrice(),
        annualPrice: this.editAnnualPrice(),
        mpAccessToken: this.editMpAccessToken().trim() || undefined,
      });

      this.pricingSaveSuccess.set('Tarifas y configuración de recaudación actualizadas con éxito.');
      this.editMpAccessToken.set('');
      await this.loadPlatformBillingConfig();
      setTimeout(() => this.pricingSaveSuccess.set(null), 4000);
    } catch (err: unknown) {
      this.pricingSaveError.set(errorMessage(err));
    } finally {
      this.isSavingPricing.set(false);
    }
  }
}
