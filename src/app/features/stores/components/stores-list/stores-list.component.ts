import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StoresService } from '@core/services/stores.service';
import { AuthService } from '@core/services/auth.service';
import type { Store } from '@core/models/store.model';

const STATUS_LABELS: Record<Store['status'], string> = {
  provisioning: 'Provisionando',
  active: 'Activa',
  suspended: 'Suspendida',
  error: 'Error',
};

@Component({
  selector: 'app-stores-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="platform-layout">
      <header class="platform-header">
        <span class="platform-header__logo">Vertex Platform</span>
        <div class="platform-header__actions">
          <a routerLink="/settings/team" class="btn-nav">Equipo</a>
          <span class="platform-header__user">{{ auth.user()?.email }}</span>
          <button class="btn-logout" (click)="logout()">Salir</button>
        </div>
      </header>

      <main class="platform-main">
        <div class="page-top">
          <div>
            <h1 class="page-title">Tiendas</h1>
            <p class="page-sub">{{ stores.stores().length }} tienda{{ stores.stores().length !== 1 ? 's' : '' }} registrada{{ stores.stores().length !== 1 ? 's' : '' }}</p>
          </div>
          <a routerLink="/stores/new" class="btn btn-primary">+ Nueva tienda</a>
        </div>

        @if (stores.stores().length === 0) {
          <div class="empty-state">
            <p class="empty-state__icon">🏪</p>
            <h2>Sin tiendas todavía</h2>
            <p>Creá la primera tienda para empezar.</p>
            <a routerLink="/stores/new" class="btn btn-primary">Crear tienda</a>
          </div>
        } @else {
          <div class="stores-grid">
            @for (store of stores.stores(); track store.id) {
              <a [routerLink]="['/stores', store.id]" class="store-card">
                <div class="store-card__color"></div>
                <div class="store-card__body">
                  <div class="store-card__header">
                    <h3 class="store-card__name">{{ store.name }}</h3>
                    <span class="badge badge--{{ store.status }}">{{ statusLabel(store.status) }}</span>
                  </div>
                  <p class="store-card__url">{{ store.defaultUrl }}</p>
                  <p class="store-card__meta">{{ store.plan }} · {{ store.ownerEmail }}</p>
                </div>
              </a>
            }
          </div>
        }
      </main>
    </div>
  `,
  styleUrls: ['./stores-list.component.scss'],
})
export class StoresListComponent {
  readonly stores = inject(StoresService);
  readonly auth = inject(AuthService);

  statusLabel(s: Store['status']): string {
    return STATUS_LABELS[s];
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
