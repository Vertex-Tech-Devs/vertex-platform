import { Component, type OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  StoresService,
  type PlatformBillingConfig,
} from '@core/services/stores';
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
  readonly pricingSaveSuccess = signal<string | null>(null);
  readonly pricingSaveError = signal<string | null>(null);

  readonly editMonthlyPrice = signal<number>(50000);
  readonly editAnnualPrice = signal<number>(500000);
  readonly editMpAccessToken = signal<string>('');

  // Store subscription breakdown
  readonly stores = this.storesSvc.stores;

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
    return list.filter((s) => s.subscription?.status === 'past_due' || s.subscription?.status === 'suspended').length;
  });

  ngOnInit(): void {
    void this.loadPlatformBillingConfig();
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
