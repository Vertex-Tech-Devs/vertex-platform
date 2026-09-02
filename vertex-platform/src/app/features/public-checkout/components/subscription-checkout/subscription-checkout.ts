import {
  Component,
  type OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicCheckoutService } from '../../services/public-checkout';
import type { PublicStoreSubscriptionInfo } from '../../models/public-subscription';

@Component({
  selector: 'app-subscription-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './subscription-checkout.html',
  styleUrl: './subscription-checkout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionCheckout implements OnInit {
  private route = inject(ActivatedRoute);
  private checkoutService = inject(PublicCheckoutService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly storeInfo = signal<PublicStoreSubscriptionInfo | null>(null);

  readonly billingCycle = signal<'monthly' | 'annual'>('annual');
  readonly payerEmail = signal<string>('');
  readonly isProcessingPayment = signal(false);
  readonly paymentError = signal<string | null>(null);

  readonly basePrice = computed(() => {
    const info = this.storeInfo();
    if (!info) {
      return 0;
    }
    return this.billingCycle() === 'annual' ? info.annualPrice : info.monthlyPrice;
  });

  readonly surchargeAmount = computed(() => {
    const info = this.storeInfo();
    if (!info || !info.isOverdue) {
      return 0;
    }
    return this.billingCycle() === 'annual'
      ? info.overdueAnnualSurchargeAmount || 0
      : info.overdueMonthlySurchargeAmount || 0;
  });

  readonly effectivePrice = computed(() => {
    return this.basePrice() + this.surchargeAmount();
  });

  readonly savingsAmount = computed(() => {
    const info = this.storeInfo();
    if (!info) {
      return 0;
    }
    const monthly12 = info.monthlyPrice * 12;
    return Math.max(0, monthly12 - info.annualPrice);
  });

  ngOnInit(): void {
    const storeIdOrSlug = this.route.snapshot.paramMap.get('id');
    if (!storeIdOrSlug) {
      this.errorMessage.set('Identificador de tienda no especificado.');
      this.isLoading.set(false);
      return;
    }

    void this.loadStore(storeIdOrSlug);
  }

  async loadStore(idOrSlug: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const data = await this.checkoutService.getPublicStoreInfo(idOrSlug);
      this.storeInfo.set(data);
      if (data.ownerEmail) {
        this.payerEmail.set(data.ownerEmail);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo encontrar la tienda o el enlace no es válido.';
      this.errorMessage.set(msg);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectCycle(cycle: 'monthly' | 'annual'): void {
    this.billingCycle.set(cycle);
  }

  async proceedToPayment(): Promise<void> {
    const info = this.storeInfo();
    if (!info) {
      return;
    }

    this.isProcessingPayment.set(true);
    this.paymentError.set(null);

    try {
      const result = await this.checkoutService.createCheckoutLink({
        storeId: info.storeId,
        billingCycle: this.billingCycle(),
        payerEmail: this.payerEmail().trim() || undefined,
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        this.paymentError.set('No se pudo generar el enlace de pago de Mercado Pago.');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al conectar con Mercado Pago. Intente nuevamente.';
      this.paymentError.set(msg);
    } finally {
      this.isProcessingPayment.set(false);
    }
  }
}
