import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoresService } from '@core/services/stores';
import type { VerticalOption } from '@core/constants/business-verticals.constants';
import { RubroSelector } from '@shared/components/rubro-selector/rubro-selector';
import { CustomVerticalModal } from '../custom-vertical-modal/custom-vertical-modal';

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
  imports: [FormsModule, RubroSelector, CustomVerticalModal],
  templateUrl: './seed-store-modal.html',
  styleUrl: './seed-store-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeedStoreModal implements OnInit {
  private storesService = inject(StoresService);

  readonly storeId = input.required<string>();
  readonly storeName = input<string>('');
  readonly currentVerticalId = input<string>('TECNOLOGIA_ELECTRONICA');
  readonly isSeeding = input<boolean>(false);

  readonly close = output<void>();
  readonly seedConfirmed = output<SeedPayload>();

  readonly verticals = this.storesService.allVerticals;
  readonly selectedVerticalId = signal<string>('TECNOLOGIA_ELECTRONICA');
  readonly selectedMode = signal<'FULL_DEMO' | 'CATALOG_ONLY' | 'EMPTY'>('FULL_DEMO');
  readonly purgeConfirmed = signal<boolean>(true);
  readonly showCustomVerticalModal = signal<boolean>(false);

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

  ngOnInit(): void {
    if (this.currentVerticalId()) {
      this.selectedVerticalId.set(this.currentVerticalId());
    }
  }

  selectVertical(id: string): void {
    this.selectedVerticalId.set(id);
  }

  onCustomVerticalCreated(v: VerticalOption): void {
    if (v?.id) {
      this.selectedVerticalId.set(v.id);
    }
    this.showCustomVerticalModal.set(false);
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
