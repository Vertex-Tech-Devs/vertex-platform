import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Output, EventEmitter, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { StoreConfigService } from '@core/services/store-config.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  @Output() readonly toggleSidebarEvent = new EventEmitter<void>();

  private readonly authService = inject(AuthService);
  private readonly storeConfig = inject(StoreConfigService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private readonly user$ = this.authService.currentUser$;
  readonly user = toSignal(this.user$);

  readonly userDisplayName = computed(() => {
    const currentUser = this.user();
    return currentUser?.email?.split('@')[0] ?? 'Usuario';
  });
  readonly storeName = this.storeConfig.storeName;
  readonly logoUrl = this.storeConfig.logoUrl;

  scrollToTop(): void {
    const url = this.router.url.split(/[?#]/)[0];

    if (url === '/admin/dashboard' || url === '/admin' || url === '/admin/') {
      const scrollConfig: ScrollToOptions = { top: 0, behavior: 'smooth' };

      window.scrollTo(scrollConfig);
      this.document.documentElement.scrollTo(scrollConfig);
      this.document.body.scrollTo(scrollConfig);

      const mainContainer = this.document.querySelector('.admin-shell__main');
      if (mainContainer) {
        mainContainer.scrollTo(scrollConfig);
      }
    }
  }

  onToggleSidebar(event: Event): void {
    event.stopPropagation();
    this.toggleSidebarEvent.emit();
  }

  logout(): void {
    void this.authService.logout();
  }
}
