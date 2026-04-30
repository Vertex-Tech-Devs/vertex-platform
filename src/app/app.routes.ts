import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'stores',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'stores',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Tiendas',
        loadComponent: () =>
          import('./features/stores/components/stores-list/stores-list.component').then(
            (m) => m.StoresListComponent
          ),
      },
      {
        path: 'new',
        title: 'Nueva tienda',
        loadComponent: () =>
          import('./features/stores/components/store-create/store-create.component').then(
            (m) => m.StoreCreateComponent
          ),
      },
      {
        path: ':id',
        title: 'Detalle de tienda',
        loadComponent: () =>
          import('./features/stores/components/store-detail/store-detail.component').then(
            (m) => m.StoreDetailComponent
          ),
      },
    ],
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    children: [
      {
        path: 'team',
        title: 'Equipo',
        loadComponent: () =>
          import('./features/settings/components/team/team.component').then(
            (m) => m.TeamComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'stores',
  },
];
