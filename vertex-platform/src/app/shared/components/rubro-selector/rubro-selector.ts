import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoresService } from '@core/services/stores';
import {
  PLATFORM_BUSINESS_VERTICALS,
  type VerticalOption,
} from '@core/constants/business-verticals.constants';

@Component({
  selector: 'app-rubro-selector',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './rubro-selector.html',
  styleUrl: './rubro-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RubroSelector {
  private storesService = inject(StoresService);

  /** Lista opcional de rubros. Si no se pasa, toma la lista reactiva completa de StoresService. */
  readonly customList = input<VerticalOption[] | null>(null, { alias: 'verticals' });
  readonly selectedVerticalId = input<string>('TECNOLOGIA_ELECTRONICA');
  readonly pageSize = input<number>(6);
  readonly allowCreate = input<boolean>(true);
  readonly compact = input<boolean>(false);

  readonly selectedVerticalChange = output<string>();
  readonly createRequested = output<void>();

  readonly searchTerm = signal<string>('');
  readonly currentPage = signal<number>(1);

  /** Lista base de rubros (nativos + custom de Firestore) */
  readonly allAvailableVerticals = computed<VerticalOption[]>(() => {
    const list = this.customList();
    if (list && list.length > 0) {
      return list;
    }
    const fromService = this.storesService.allVerticals?.();
    if (fromService && fromService.length > 0) {
      return fromService;
    }
    return PLATFORM_BUSINESS_VERTICALS;
  });

  /** Filtrado reactivo en tiempo real */
  readonly filteredVerticals = computed<VerticalOption[]>(() => {
    const list = this.allAvailableVerticals();
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) {
      return list;
    }
    return list.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query) ||
        v.id.toLowerCase().includes(query) ||
        (v.categories && v.categories.some((c) => c.toLowerCase().includes(query))),
    );
  });

  /** Cantidad total de páginas */
  readonly totalPages = computed<number>(() => {
    const total = this.filteredVerticals().length;
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  /** Lista paginada para la página actual */
  readonly paginatedVerticals = computed<VerticalOption[]>(() => {
    const list = this.filteredVerticals();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  /** Array con los números de página (ej. [1, 2, 3]) */
  readonly pagesList = computed<number[]>(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  /** Rango visual de elementos actuales (ej. "1-6 de 21") */
  readonly paginationSummary = computed<string>(() => {
    const total = this.filteredVerticals().length;
    if (total === 0) {
      return '0 rubros';
    }
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return `${start}-${end} de ${total}`;
  });

  constructor() {
    // Resetear a página 1 cuando cambia el término de búsqueda
    effect(() => {
      this.searchTerm();
      this.currentPage.set(1);
    });

    // Si se pasa un selectedVerticalId inicial, asegurar que su página esté activa
    effect(() => {
      const selId = this.selectedVerticalId();
      const list = this.filteredVerticals();
      const index = list.findIndex((v) => v.id === selId);
      if (index >= 0) {
        const expectedPage = Math.floor(index / this.pageSize()) + 1;
        if (expectedPage !== this.currentPage()) {
          this.currentPage.set(expectedPage);
        }
      }
    });
  }

  selectVertical(id: string): void {
    this.selectedVerticalChange.emit(id);
  }

  onKeyDownCard(event: KeyboardEvent, id: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectVertical(id);
    }
  }

  setPage(page: number): void {
    const clamped = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(clamped);
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
    }
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.currentPage.set(1);
  }

  requestCreate(): void {
    this.createRequested.emit();
  }
}
