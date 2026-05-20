import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-platform-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './platform-layout.component.html',
  styleUrl: './platform-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformLayoutComponent {
  readonly auth = inject(AuthService);
  readonly isSidebarOpen = signal(false);

  readonly userInitial = computed(() => {
    const email = this.auth.user()?.email ?? '';
    return (email[0] ?? '?').toUpperCase();
  });

  private readonly breakpointLg = 1024;

  toggleSidebar(): void {
    this.isSidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    if (this.isSidebarOpen()) this.isSidebarOpen.set(false);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > this.breakpointLg) this.isSidebarOpen.set(false);
  }
}
