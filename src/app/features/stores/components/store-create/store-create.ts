import { Component, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoresService, type RuntimeCapacitySummary } from '@core/services/stores';

const SLUG_RE = /^[a-z0-9-]+$/;

@Component({
  selector: 'app-store-create',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './store-create.html',
  styleUrls: ['./store-create.scss'],
})
export class StoreCreate implements OnInit {
  private fb = inject(FormBuilder);
  private storesService = inject(StoresService);
  private router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly runtimeSummary = signal<RuntimeCapacitySummary | null>(null);
  readonly runtimeSummaryError = signal('');

  readonly selectedVerticalType = signal<'indumentaria' | 'gastronomia' | 'retail' | 'custom'>('indumentaria');
  readonly customVerticalName = signal('');

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', [Validators.required, Validators.pattern(SLUG_RE)]],
    ownerEmail: ['', [Validators.required, Validators.email]],
    logoUrl: [''],
    customDomain: [''],
    verticalId: ['indumentaria' as string, Validators.required],
    includeMockData: [true],
    dedicatedProject: [false],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.runtimeSummary.set(await this.storesService.getRuntimeCapacitySummary());
    } catch {
      this.runtimeSummaryError.set('No se pudo cargar la capacidad actual de shared-shards.');
    }
  }

  autoSlug(): void {
    const name = this.form.get('name')?.value ?? '';
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    this.form.get('slug')?.setValue(slug);
  }

  selectVertical(type: 'indumentaria' | 'gastronomia' | 'retail' | 'custom'): void {
    this.selectedVerticalType.set(type);
    if (type !== 'custom') {
      this.form.get('verticalId')?.setValue(type);
    } else {
      this.form.get('verticalId')?.setValue(this.customVerticalName().trim());
    }
  }

  onCustomVerticalChange(value: string): void {
    this.customVerticalName.set(value);
    if (this.selectedVerticalType() === 'custom') {
      this.form.get('verticalId')?.setValue(value.trim());
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      const id = await this.storesService.createStore(this.form.value as Parameters<typeof this.storesService.createStore>[0]);
      void this.router.navigate(['/stores', id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      this.errorMessage.set(message || 'No se pudo crear la tienda. Intentá de nuevo.');
      this.isSubmitting.set(false);
    }
  }
}
