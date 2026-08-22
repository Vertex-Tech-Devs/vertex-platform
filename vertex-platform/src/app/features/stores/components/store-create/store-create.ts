import { Component, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoresService, type RuntimeCapacitySummary } from '@core/services/stores';
import { DEFAULT_STORE_VERTICAL } from '@core/constants/store-defaults.constants';
import type { VerticalOption } from '@core/constants/business-verticals.constants';

import { RubroSelector } from '@shared/components/rubro-selector/rubro-selector';
import { CustomVerticalModal } from '../custom-vertical-modal/custom-vertical-modal';

// Must match backend: 3-20 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;

export type { VerticalOption };

export interface ProvisioningModeOption {
  id: string;
  icon: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-store-create',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RubroSelector, CustomVerticalModal],
  templateUrl: './store-create.html',
  styleUrl: './store-create.scss',
})
export class StoreCreate implements OnInit {
  private fb = inject(FormBuilder);
  private storesService = inject(StoresService);
  private router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly runtimeSummary = signal<RuntimeCapacitySummary | null>(null);
  readonly runtimeSummaryError = signal('');
  readonly showCustomVerticalModal = signal<boolean>(false);

  readonly logoPreview = signal<string | null>(null);
  readonly logoFileName = signal<string>('');
  readonly logoFileSize = signal<string>('');
  readonly isDraggingLogo = signal<boolean>(false);

  readonly verticals = this.storesService.allVerticals;

  readonly provisioningModes: ProvisioningModeOption[] = [
    {
      id: 'FULL_DEMO',
      icon: '🚀',
      name: 'Demo Completo',
      description: 'Catálogo de muestra + clientes y pedidos simulados.',
    },
    {
      id: 'CATALOG_ONLY',
      icon: '📦',
      name: 'Solo Catálogo',
      description: 'Categorías y productos iniciales listos para vender.',
    },
    {
      id: 'EMPTY',
      icon: '✨',
      name: 'Tienda Limpia',
      description: 'Estructura vacía lista para cargar productos desde cero.',
    },
  ];

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', [Validators.required, Validators.pattern(SLUG_RE)]],
    ownerEmail: ['', [Validators.required, Validators.email]],
    logoUrl: [''],
    businessVertical: [DEFAULT_STORE_VERTICAL, Validators.required],
    provisioningMode: ['FULL_DEMO', Validators.required],
    verticalId: [DEFAULT_STORE_VERTICAL],
    includeMockData: [true],
    dedicatedProject: [false],
  });

  ngOnInit(): void {
    void (async () => {
      try {
        this.runtimeSummary.set(await this.storesService.getRuntimeCapacitySummary());
      } catch {
        this.runtimeSummaryError.set('No se pudo cargar la capacidad actual de shared-shards.');
      }
    })();
  }

  selectVertical(id: string): void {
    this.form.get('businessVertical')?.setValue(id);
    this.form.get('verticalId')?.setValue(id);
  }

  onCustomVerticalCreated(vertical: VerticalOption): void {
    if (vertical?.id) {
      this.selectVertical(vertical.id);
    }
    this.showCustomVerticalModal.set(false);
  }

  selectMode(id: string): void {
    this.form.get('provisioningMode')?.setValue(id);
    this.form.get('includeMockData')?.setValue(id === 'FULL_DEMO');
  }

  autoSlug(): void {
    const name = this.form.get('name')?.value ?? '';
    const slug = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    this.form.get('slug')?.setValue(slug);
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processLogoFile(input.files[0]);
    }
  }

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingLogo.set(true);
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingLogo.set(false);
  }

  onLogoDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingLogo.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.processLogoFile(event.dataTransfer.files[0]);
    }
  }

  private processLogoFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Por favor seleccioná un archivo de imagen válido (PNG, JPG, SVG o WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.errorMessage.set('El logo no debe superar los 2MB de tamaño.');
      return;
    }

    this.logoFileName.set(file.name);
    this.logoFileSize.set(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.logoPreview.set(dataUrl);
      this.form.get('logoUrl')?.setValue(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.logoPreview.set(null);
    this.logoFileName.set('');
    this.logoFileSize.set('');
    this.form.get('logoUrl')?.setValue('');
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      const val = this.form.value;
      const vertical = val.businessVertical || 'INDUMENTARIA_MODA';
      const mode = val.provisioningMode || 'FULL_DEMO';
      const payload = {
        ...val,
        verticalId: vertical,
        businessVertical: vertical,
        provisioningMode: mode,
        includeMockData: mode === 'FULL_DEMO',
      };
      const id = await this.storesService.createStore(
        payload as Parameters<typeof this.storesService.createStore>[0],
      );
      void this.router.navigate(['/stores', id]);
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      const lower = raw.toLowerCase();
      let message = raw || 'No se pudo crear la tienda. Intentá de nuevo.';
      if (lower.includes('permission-denied') || lower.includes('unauthenticated')) {
        message =
          'Tu sesión no tiene permisos de administrador de plataforma. Recargá la página y volvé a iniciar sesión.';
      } else if (
        lower.includes('quota') ||
        lower.includes('project count') ||
        lower.includes('exceeded')
      ) {
        message =
          'No hay cuota de proyectos GCP disponible para esta operación. Usá la tienda estándar (sin marcar "proyecto dedicado") o pedí el aumento de cuota de proyectos.';
      } else if (lower.includes('already exists') || lower.includes('ya existe')) {
        message = 'Ya existe una tienda con ese slug o nombre.';
      }
      this.errorMessage.set(message);
      this.isSubmitting.set(false);
    }
  }
}
