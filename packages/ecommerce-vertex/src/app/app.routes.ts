import type { Routes } from '@angular/router';
import { AdminGuard } from '@core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'shop',
  },
  {
    path: 'shop',
    loadChildren: () => import('./features/shop/shop.routes').then((m) => m.SHOP_ROUTES),
  },
  {
    path: 'admin',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/admin/components/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: '',
        canActivate: [AdminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/shared/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
