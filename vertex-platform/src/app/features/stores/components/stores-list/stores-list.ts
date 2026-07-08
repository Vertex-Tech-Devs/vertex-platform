import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StoresService } from '@core/services/stores';
import type { Store, StoreStatus } from '@core/models/store';

const STATUS_LABELS: Record<StoreStatus, string> = {
  provisioning: 'Provisionando',
  active: 'Activa',
  suspended: 'Suspendida',
  error: 'Error',
};

@Component({
  selector: 'app-stores-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container">
      <!-- Page header -->
      <div class="page-top">
        <div>
          <h1 class="page-title">Tiendas</h1>
          <p class="page-sub">
            {{ stores.stores().length }} tienda{{
              stores.stores().length !== 1 ? 's' : ''
            }}
            registrada{{ stores.stores().length !== 1 ? 's' : '' }}
          </p>
        </div>
        <a routerLink="/stores/new" class="btn-primary">
          <i class="bi bi-plus-lg"></i> Nueva tienda
        </a>
      </div>

      <!-- Stats bar -->
      <div class="stats-bar">
        <div class="stat-chip stat-chip--total">
          <span class="stat-chip__count">{{ counts().total }}</span>
          <span class="stat-chip__label">Total</span>
        </div>
        <div class="stat-chip stat-chip--active">
          <span class="stat-chip__count">{{ counts().active }}</span>
          <span class="stat-chip__label">Activas</span>
        </div>
        <div class="stat-chip stat-chip--provisioning">
          <span class="stat-chip__count">{{ counts().provisioning }}</span>
          <span class="stat-chip__label">Provisionando</span>
        </div>
        <div class="stat-chip stat-chip--suspended">
          <span class="stat-chip__count">{{ counts().suspended }}</span>
          <span class="stat-chip__label">Suspendidas</span>
        </div>
        @if (counts().error > 0) {
          <div class="stat-chip stat-chip--error">
            <span class="stat-chip__count">{{ counts().error }}</span>
            <span class="stat-chip__label">Error</span>
          </div>
        }
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="search-wrap">
          <i class="bi bi-search search-wrap__icon"></i>
          <input
            class="search-input"
            type="text"
            placeholder="Buscar por nombre, email o slug…"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>
        <div class="filter-controls" style="display: flex; gap: 1rem;">
          <select class="filter-select" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
            <option value="all">Todos los estados</option>
            <option value="active">Activa</option>
            <option value="provisioning">Provisionando</option>
            <option value="suspended">Suspendida</option>
            <option value="error">Error</option>
          </select>
          <select class="filter-select" [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)">
            <option value="created-desc">Más recientes primero</option>
            <option value="created-asc">Más antiguas primero</option>
            <option value="name-asc">Nombre (A-Z)</option>
            <option value="name-desc">Nombre (Z-A)</option>
          </select>
        </div>
      </div>

      <!-- Results -->
      @if (stores.stores().length === 0) {
        <div class="empty-state">
          <i class="bi bi-shop empty-state__icon"></i>
          <h2>Sin tiendas todavía</h2>
          <p>Creá la primera tienda para empezar.</p>
          <a routerLink="/stores/new" class="btn-primary">Crear tienda</a>
        </div>
      } @else if (filteredStores().length === 0) {
        <div class="empty-state">
          <i class="bi bi-funnel empty-state__icon"></i>
          <h2>Sin resultados</h2>
          <p>No hay tiendas que coincidan con los filtros aplicados.</p>
        </div>
      } @else {
        <div class="stores-grid">
          @for (store of filteredStores(); track store.id) {
            <a [routerLink]="['/stores', store.id]" class="store-card">
              <div class="store-card__header">
                <h3 class="store-card__name">{{ store.name }}</h3>
                <span class="badge badge--{{ store.status }}">{{ statusLabel(store.status) }}</span>
              </div>
              <p class="store-card__url">{{ getStoreUrl(store) }}</p>
              <p class="store-card__meta">
                {{ store.ownerEmail }}
              </p>
              @if (store.status === 'provisioning' || store.status === 'error') {
                <div class="store-card__progress">
                  <div class="store-card__progress-head">
                    <span>{{ provisioningStepLabel(store) }}</span>
                    <span>{{ provisioningPercent(store) }}%</span>
                  </div>
                  <div class="store-card__progress-bar">
                    <div
                      class="store-card__progress-fill"
                      [style.width.%]="provisioningPercent(store)"
                    ></div>
                  </div>
                </div>
              }
            </a>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './stores-list.scss',
})
export class StoresList {
  readonly stores = inject(StoresService);

  searchQuery = signal('');
  statusFilter = signal<StoreStatus | 'all'>('all');
  sortBy = signal<'created-desc' | 'created-asc' | 'name-asc' | 'name-desc'>('created-desc');

  readonly counts = computed(() => {
    const all = this.stores.stores();
    return {
      total: all.length,
      active: all.filter((s) => s.status === 'active').length,
      provisioning: all.filter((s) => s.status === 'provisioning').length,
      suspended: all.filter((s) => s.status === 'suspended').length,
      error: all.filter((s) => s.status === 'error').length,
    };
  });

  readonly filteredStores = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const sort = this.sortBy();

    const filtered = this.stores.stores().filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.ownerEmail.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || s.status === status;
      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sort === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (sort === 'created-asc') {
        return dateA - dateB;
      }
      // default: created-desc
      return dateB - dateA;
    });
  });

  getStoreUrl(store: Store): string {
    if (window.location.hostname === 'localhost') {
      return `http://localhost:4201/shop?tenantId=${store.slug}`;
    }
    return store.defaultUrl;
  }

  statusLabel(s: Store['status']): string {
    return STATUS_LABELS[s];
  }

  provisioningPercent(store: Store): number {
    const steps = store.provisioningSteps ?? {};
    const entries = Object.values(steps);
    if (entries.length === 0) {
      return 0;
    }
    const done = entries.filter((step) => step.status === 'done').length;
    return Math.round((done / entries.length) * 100);
  }

  provisioningStepLabel(store: Store): string {
    const steps = store.provisioningSteps ?? {};
    const ordered = Object.values(steps);
    const running = ordered.find((step) => step.status === 'running');
    if (running) {
      return `En curso: ${running.label}`;
    }

    const failed = ordered.find((step) => step.status === 'error');
    if (failed) {
      return `Falló: ${failed.label}`;
    }

    const pending = ordered.find((step) => step.status === 'pending');
    if (pending) {
      return `Pendiente: ${pending.label}`;
    }

    return 'Provisioning completado, esperando validación final';
  }
}
