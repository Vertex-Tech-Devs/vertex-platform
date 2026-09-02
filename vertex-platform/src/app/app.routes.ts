import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/components/login/login').then((m) => m.Login),
  },
  {
    path: 'pay/:id',
    title: 'Suscripción de Tienda — Vertex',
    loadComponent: () =>
      import(
        './features/public-checkout/components/subscription-checkout/subscription-checkout'
      ).then((m) => m.SubscriptionCheckout),
  },
  {
    path: 'pay/:id/success',
    title: 'Suscripción Activada — Vertex',
    loadComponent: () =>
      import(
        './features/public-checkout/components/subscription-success/subscription-success'
      ).then((m) => m.SubscriptionSuccess),
  },
  {
    path: 'subscribe/:id',
    redirectTo: 'pay/:id',
    pathMatch: 'full',
  },
  {
    path: 'subscribe/:id/success',
    redirectTo: 'pay/:id/success',
    pathMatch: 'full',
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
            path: 'subscriptions',
            title: 'Suscripciones SaaS — Vertex',
            loadComponent: () =>
              import(
                './features/settings/components/subscriptions/subscriptions'
              ).then((m) => m.Subscriptions),
          },
          {
            path: 'infrastructure',
            title: 'Infraestructura GCP — Vertex',
            loadComponent: () =>
              import(
                './features/settings/components/infrastructure/infrastructure'
              ).then((m) => m.Infrastructure),
          },
          {
            path: 'team',
            title: 'Equipo — Vertex',
            loadComponent: () =>
              import('./features/settings/components/team/team').then((m) => m.Team),
          },
          {
            path: 'billing',
            redirectTo: 'subscriptions',
            pathMatch: 'full',
          },
        ],
      },
      {
        path: 'billing',
        redirectTo: 'settings/subscriptions',
        pathMatch: 'full',
      },
      {
        path: 'infrastructure',
        redirectTo: 'settings/infrastructure',
        pathMatch: 'full',
      },
    ],
  },
  { path: '**', redirectTo: 'stores' },
];
