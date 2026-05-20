import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StoresService } from '@core/services/stores';
import type { Store } from '@core/models/store';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container">
      <div class="page-top">
        <div>
          <h1 class="page-title">Tiendas</h1>
          <p class="page-sub">
            {{ stores.stores().length }}
            tienda{{ stores.stores().length !== 1 ? 's' : '' }}
            registrada{{ stores.stores().length !== 1 ? 's' : '' }}
          </p>
        </div>
        <a routerLink="/stores/new" class="btn-primary">
          <i class="bi bi-plus-lg"></i> Nueva tienda
        </a>
      </div>

      @if (stores.stores().length === 0) {
        <div class="empty-state">
          <i class="bi bi-shop empty-state__icon"></i>
          <h2>Sin tiendas todavía</h2>
          <p>Creá la primera tienda para empezar.</p>
          <a routerLink="/stores/new" class="btn-primary">Crear tienda</a>
        </div>
      } @else {
        <div class="stores-grid">
          @for (store of stores.stores(); track store.id) {
            <a [routerLink]="['/stores', store.id]" class="store-card">
              <div class="store-card__header">
                <h3 class="store-card__name">{{ store.name }}</h3>
                <span class="badge badge--{{ store.status }}">{{ statusLabel(store.status) }}</span>
              </div>
              <p class="store-card__url">{{ store.defaultUrl }}</p>
              <p class="store-card__meta">
                <span class="plan-badge">{{ store.plan }}</span>
                {{ store.ownerEmail }}
              </p>
            </a>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./stores-list.scss'],
})
export class StoresList {
  readonly stores = inject(StoresService);

  statusLabel(s: Store['status']): string {
    return STATUS_LABELS[s];
  }
}
