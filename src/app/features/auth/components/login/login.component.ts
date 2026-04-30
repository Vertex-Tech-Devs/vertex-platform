import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-card__title">Vertex Platform</h1>
        <p class="login-card__sub">Panel de gestión de tiendas</p>

        @if (auth.authError() === 'unauthorized') {
          <div class="alert">
            <strong>Acceso denegado.</strong> Tu cuenta no tiene permisos para ingresar.
            Contactá al administrador.
          </div>
        } @else if (auth.authError() === 'unknown') {
          <div class="alert">Error al iniciar sesión. Intentá de nuevo.</div>
        }

        <button class="btn btn-google" (click)="login()">
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.34-8.16 2.34-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .login-card {
      background: white; border-radius: 16px; padding: 3rem 2.5rem;
      text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,0.25);
      width: 100%; max-width: 380px;
      &__title { font-size: 1.8rem; font-weight: 700; margin: 0 0 .5rem; }
      &__sub { color: #6b7280; margin: 0 0 2rem; }
    }
    .alert {
      background: #fee2e2; color: #991b1b; border-radius: 8px;
      padding: .75rem 1rem; font-size: .875rem; margin-bottom: 1.25rem; text-align: left;
    }
    .btn-google {
      display: flex; align-items: center; justify-content: center; gap: .75rem;
      width: 100%; padding: .75rem 1.5rem; border: 1px solid #d1d5db; border-radius: 8px;
      background: white; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background .2s;
      &:hover { background: #f9fafb; }
    }
  `],
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  async login(): Promise<void> {
    await this.auth.loginWithGoogle();
    if (this.auth.isLoggedIn()) {
      void this.router.navigate(['/stores']);
    }
  }
}
