import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoresService } from '@core/services/stores.service';

const SLUG_RE = /^[a-z0-9-]+$/;

@Component({
  selector: 'app-store-create',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './store-create.component.html',
  styleUrls: ['./store-create.component.scss'],
})
export class StoreCreateComponent {
  private fb = inject(FormBuilder);
  private storesService = inject(StoresService);
  private router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', [Validators.required, Validators.pattern(SLUG_RE)]],
    ownerEmail: ['', [Validators.required, Validators.email]],
    plan: ['starter' as const, Validators.required],
    primaryColor: ['#ea580c', Validators.required],
    logoUrl: [''],
    customDomain: [''],
  });

  autoSlug(): void {
    const name = this.form.get('name')?.value ?? '';
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    this.form.get('slug')?.setValue(slug);
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
    } catch {
      this.errorMessage.set('No se pudo crear la tienda. Intentá de nuevo.');
      this.isSubmitting.set(false);
    }
  }
}
