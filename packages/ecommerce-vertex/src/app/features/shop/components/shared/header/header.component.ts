import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '@core/services/cart.service';
import { StoreConfigService } from '@core/services/store-config.service';

@Component({
  selector: 'app-shop-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  private readonly cartService = inject(CartService);
  private readonly storeConfig = inject(StoreConfigService);

  readonly cartItemCount = this.cartService.itemCount;
  readonly storeName = this.storeConfig.storeName;
  readonly logoUrl = this.storeConfig.logoUrl;
  readonly isMenuOpen = signal(false);
  readonly isScrolled = signal(false);

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const scrollOffset = window.pageYOffset || document.documentElement.scrollTop || 0;
    this.isScrolled.set(scrollOffset > 20);
  }

  toggleMenu(): void {
    this.isMenuOpen.update((value) => !value);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
