import { Component, type OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicCheckoutService } from '../../services/public-checkout';
import type { PublicStoreSubscriptionInfo } from '../../models/public-subscription';

@Component({
  selector: 'app-subscription-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './subscription-success.html',
  styleUrl: './subscription-success.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionSuccess implements OnInit {
  private route = inject(ActivatedRoute);
  private checkoutService = inject(PublicCheckoutService);

  readonly isLoading = signal(true);
  readonly storeInfo = signal<PublicStoreSubscriptionInfo | null>(null);

  ngOnInit(): void {
    const storeId = this.route.snapshot.paramMap.get('id');
    if (storeId) {
      void this.loadStore(storeId);
    } else {
      this.isLoading.set(false);
    }
  }

  async loadStore(id: string): Promise<void> {
    try {
      const data = await this.checkoutService.getPublicStoreInfo(id);
      this.storeInfo.set(data);
    } catch {
      // Si falla, muestra pantalla genérica de éxito
    } finally {
      this.isLoading.set(false);
    }
  }
}
