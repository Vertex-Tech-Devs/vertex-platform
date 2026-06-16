import { inject } from '@angular/core';
import type { CanActivateFn, UrlTree } from '@angular/router';
import { Router } from '@angular/router';
import { environment } from '@environments/environment';

export const SeedDataGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  return environment.features.seedDataEnabled ? true : router.createUrlTree(['/admin/dashboard']);
};
