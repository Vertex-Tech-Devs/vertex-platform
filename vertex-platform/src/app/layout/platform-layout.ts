import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/services/auth';

/** Hosts oficiales de producción de la plataforma (nunca DEV). */
const PROD_HOSTS = new Set([
  'vertex-platform.web.app',
  'vertex-platform-app.web.app',
  'vertex-platform.firebaseapp.com',
]);

/** Entorno no productivo: localhost o hosts web.app/firebaseapp.com de desarrollo. */
export function isDevHostname(host: string): boolean {
  if (!host) {
    return false;
  }
  const h = host.toLowerCase();
  if (PROD_HOSTS.has(h)) {
    return false;
  }
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.local') ||
    h.includes('-dev.web.app') ||
    h.includes('-dev.firebaseapp.com') ||
    h.includes('dev.')
  );
}

@Component({
  selector: 'app-platform-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './platform-layout.html',
  styleUrl: './platform-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformLayout {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly isSidebarOpen = signal(false);

  /** Entorno no productivo (localhost o host de dev/web.app que no sea vertex-platform-app).
   *  La lógica vive en isDevHostname() (cubierta por unit tests); esta línea solo
   *  delega el hostname actual del navegador. */
  /* istanbul ignore next */
  readonly isDevEnv: boolean = isDevHostname(
    typeof window !== 'undefined' ? window.location.hostname : '',
  );

  readonly userInitial = computed(() => {
    const email = this.auth.user()?.email ?? '';
    return (email[0] ?? '?').toUpperCase();
  });

  private readonly breakpointLg = 1024;

  toggleSidebar(): void {
    this.isSidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    if (this.isSidebarOpen()) {
      this.isSidebarOpen.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > this.breakpointLg) {
      this.isSidebarOpen.set(false);
    }
  }
}
