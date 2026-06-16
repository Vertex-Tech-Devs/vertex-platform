import type { Routes } from '@angular/router';
import { AdminComponent } from './admin.component';

import { OwnerGuard } from '@core/guards/owner.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./components/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'products',
        title: 'Productos',
        loadComponent: () =>
          import('./components/products/products-list/products-list.component').then(
            (m) => m.ProductsListComponent
          ),
      },
      {
        path: 'products/create',
        title: 'Nuevo producto',
        loadComponent: () =>
          import('./components/products/product-create/product-create.component').then(
            (m) => m.ProductCreateComponent
          ),
      },
      {
        path: 'products/edit/:id',
        title: 'Editar producto',
        loadComponent: () =>
          import('./components/products/product-create/product-create.component').then(
            (m) => m.ProductCreateComponent
          ),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./components/products/product-detail/product-detail.component').then(
            (m) => m.ProductDetailComponent
          ),
      },
      {
        path: 'categories',
        title: 'Categorías',
        loadComponent: () =>
          import('./components/categories/categories-list/categories-list.component').then(
            (m) => m.CategoriesListComponent
          ),
      },
      {
        path: 'attributes',
        title: 'Atributos',
        loadComponent: () =>
          import('./components/attributes/attributes-list/attributes-list.component').then(
            (m) => m.AttributesListComponent
          ),
      },
      {
        path: 'orders',
        title: 'Pedidos',
        loadComponent: () =>
          import('./components/orders/orders-list/orders-list.component').then(
            (m) => m.OrdersListComponent
          ),
      },
      {
        path: 'orders/:id',
        loadComponent: () =>
          import('./components/orders/order-detail/order-detail.component').then(
            (m) => m.OrderDetailComponent
          ),
      },
      {
        path: 'customers',
        title: 'Clientes',
        loadComponent: () =>
          import('./components/client/clients-list/clients-list.component').then(
            (m) => m.ClientsListComponent
          ),
      },
      {
        path: 'customers/:email',
        loadComponent: () =>
          import('./components/client/client-details/client-details.component').then(
            (m) => m.ClientDetailsComponent
          ),
      },
      {
        path: 'home-management',
        title: 'Gestión Home',
        loadComponent: () =>
          import('./components/home-management/home-management.component').then(
            (m) => m.HomeManagementComponent
          ),
      },
      {
        path: 'about-management',
        title: 'Gestión Nosotros',
        loadComponent: () =>
          import('./components/about-us-management/about-us-management.component').then(
            (m) => m.AboutUsManagementComponent
          ),
      },
      {
        path: 'footer-management',
        title: 'Gestión Footer',
        loadComponent: () =>
          import('./components/footer-management/footer-management.component').then(
            (m) => m.FooterManagementComponent
          ),
      },
      {
        path: 'email-management',
        title: 'Gestión de Emails',
        loadComponent: () =>
          import('./components/email-management/email-management.component').then(
            (m) => m.EmailManagementComponent
          ),
      },
      {
        path: 'staff',
        title: 'Equipo (RBAC)',
        canActivate: [OwnerGuard],
        loadComponent: () =>
          import('./components/staff/staff.component').then((m) => m.StaffComponent),
      },
      {
        path: 'store-config',
        title: 'Configuración',
        loadComponent: () =>
          import('./components/store-config/store-config.component').then(
            (m) => m.StoreConfigComponent
          ),
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./components/account/account.component').then((m) => m.AccountComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
