import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  computed,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PLATFORM_BUSINESS_VERTICALS,
  type VerticalOption,
} from '@core/constants/business-verticals.constants';

export interface SeedPayload {
  verticalId: string;
  provisioningMode: 'FULL_DEMO' | 'CATALOG_ONLY' | 'EMPTY';
  includeMockData: boolean;
}

export interface ProvisioningModeOption {
  id: 'FULL_DEMO' | 'CATALOG_ONLY' | 'EMPTY';
  icon: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-seed-store-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './seed-store-modal.html',
  styleUrl: './seed-store-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeedStoreModal implements OnInit {
  readonly storeId = input.required<string>();
  readonly storeName = input<string>('');
  readonly currentVerticalId = input<string>('TECNOLOGIA_ELECTRONICA');
  readonly isSeeding = input<boolean>(false);

  readonly close = output<void>();
  readonly seedConfirmed = output<SeedPayload>();

  readonly verticals: VerticalOption[] = PLATFORM_BUSINESS_VERTICALS;
  readonly selectedVerticalId = signal<string>('TECNOLOGIA_ELECTRONICA');
  readonly selectedMode = signal<'FULL_DEMO' | 'CATALOG_ONLY' | 'EMPTY'>('FULL_DEMO');
  readonly purgeConfirmed = signal<boolean>(true);
  readonly searchTerm = signal<string>('');

  readonly modes: ProvisioningModeOption[] = [
    {
      id: 'FULL_DEMO',
      icon: '🚀',
      name: 'Demo Completo',
      description: 'Catálogo de muestra + clientes y órdenes simuladas con stock.',
    },
    {
      id: 'CATALOG_ONLY',
      icon: '📦',
      name: 'Solo Catálogo',
      description: 'Categorías, atributos y productos iniciales listos para operar.',
    },
    {
      id: 'EMPTY',
      icon: '✨',
      name: 'Tienda Limpia',
      description: 'Estructura y páginas base sin productos ni órdenes residuales.',
    },
  ];

  readonly filteredVerticals = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.verticals;
    }
    return this.verticals.filter(
      (v) =>
        v.name.toLowerCase().includes(term) ||
        v.description.toLowerCase().includes(term) ||
        v.id.toLowerCase().includes(term),
    );
  });

  ngOnInit(): void {
    if (this.currentVerticalId()) {
      this.selectedVerticalId.set(this.currentVerticalId());
    }
  }

  selectVertical(id: string): void {
    this.selectedVerticalId.set(id);
  }

  selectMode(mode: 'FULL_DEMO' | 'CATALOG_ONLY' | 'EMPTY'): void {
    this.selectedMode.set(mode);
  }

  onCancel(): void {
    if (!this.isSeeding()) {
      this.close.emit();
    }
  }

  onConfirm(): void {
    if (!this.purgeConfirmed()) {
      return;
    }
    this.seedConfirmed.emit({
      verticalId: this.selectedVerticalId(),
      provisioningMode: this.selectedMode(),
      includeMockData: this.selectedMode() === 'FULL_DEMO',
    });
  }
}
