import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { CartService } from '@core/services/cart.service';

export const checkoutGuard: CanActivateFn = () => {
  const cartService = inject(CartService);
  const router = inject(Router);

  if (cartService.itemCount() === 0) {
    return router.createUrlTree(['/shop/cart']);
  }
  return true;
};
