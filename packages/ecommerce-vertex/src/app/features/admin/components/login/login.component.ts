import type { OnInit } from '@angular/core';
import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  authErrorMessage = '';
  isAlreadyLogged = false;
  isGoogleSubmitting = false;

  ngOnInit(): void {
    this.authService
      .isAuthenticated()
      .pipe(take(1))
      .subscribe((isAuth) => {
        this.isAlreadyLogged = isAuth;
      });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params['authError']) {
        this.authErrorMessage = 'Debes iniciar sesión para acceder al panel de administración.';
      }
    });
  }

  onGoogleLogin(): void {
    this.isGoogleSubmitting = true;
    this.authErrorMessage = '';

    this.authService
      .loginWithGoogle()
      .pipe(take(1))
      .subscribe({
        next: () => {
          void this.router.navigate(['/admin']);
        },
        error: (err: unknown) => {
          console.error('[Google Login Error]:', err);
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('permission-denied') || msg.includes('unauthorized')) {
            this.authErrorMessage =
              'Tu cuenta de Google no está autorizada para acceder a esta tienda. Solicita acceso al administrador.';
          } else if (msg.includes('auth/unauthorized-domain')) {
            this.authErrorMessage =
              'Este dominio no está autorizado para Google OAuth en Firebase Auth de esta tienda. Agregalo en Authentication > Settings > Authorized domains e intentá de nuevo.';
          } else if (msg.includes('auth/popup-blocked')) {
            this.authErrorMessage =
              'El navegador bloqueó la ventana emergente de Google. Permitila e intentá de nuevo.';
          } else {
            this.authErrorMessage = 'No se pudo iniciar sesión con Google. Intentá de nuevo.';
          }
          this.isGoogleSubmitting = false;
        },
      });
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.isAlreadyLogged = false;
  }
}
