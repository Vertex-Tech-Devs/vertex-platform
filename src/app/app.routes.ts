import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/components/login/login').then((m) => m.Login),
  },
  {
    path: '',
    loadComponent: () => import('./layout/platform-layout').then((m) => m.PlatformLayout),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'stores', pathMatch: 'full' },
      {
        path: 'stores',
        children: [
          {
            path: '',
            title: 'Tiendas',
            loadComponent: () =>
              import('./features/stores/components/stores-list/stores-list').then(
                (m) => m.StoresList,
              ),
          },
          {
            path: 'new',
            title: 'Nueva tienda',
            loadComponent: () =>
              import('./features/stores/components/store-create/store-create').then(
                (m) => m.StoreCreate,
              ),
          },
          {
            path: ':id',
            title: 'Detalle de tienda',
            loadComponent: () =>
              import('./features/stores/components/store-detail/store-detail').then(
                (m) => m.StoreDetail,
              ),
          },
        ],
      },
      {
        path: 'settings',
        children: [
          {
            path: 'team',
            title: 'Equipo',
            loadComponent: () =>
              import('./features/settings/components/team/team').then((m) => m.Team),
          },
          {
            path: 'billing',
            title: 'Facturación',
            loadComponent: () =>
              import('./features/settings/components/billing/billing').then((m) => m.Billing),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'stores' },
];
