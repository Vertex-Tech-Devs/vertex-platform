import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { take, map } from 'rxjs';

export const OwnerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isOwner$.pipe(
    take(1),
    map((isOwner) => (isOwner ? true : router.createUrlTree(['/admin/dashboard'])))
  );
};
