import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoreConfigService } from '@core/services/store-config.service';
import { StorageService } from '@core/services/storage.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';
import { StoreConfigSchema } from '@vertex/contracts';
import type { StoreConfig } from '@vertex/contracts';

@Component({
  selector: 'app-first-run-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './first-run-wizard.component.html',
  styleUrls: ['./first-run-wizard.component.scss'],
})
export class FirstRunWizardComponent {
  private fb = inject(FormBuilder);
  private storeConfigService = inject(StoreConfigService);
  private storageService = inject(StorageService);
  private sweetAlert = inject(SweetAlertService);

  wizardCompleted = output<void>();

  currentStep = signal<number>(1);
  isSubmitting = false;

  // Upload progress states
  logoProgress = signal<number>(0);
  logoUploading = signal<boolean>(false);

  form = this.fb.group({
    storeName: ['', Validators.required],
    tagline: [''],
    logoUrl: [''],
    faviconUrl: [''],
    colorPrimary: ['#ea580c', Validators.required],
    colorAccent: ['#ef4444', Validators.required],
    colorBackground: ['#1a1a2e', Validators.required],
    mercadoPagoPublicKey: [''],
    contactPhone: ['', Validators.required],
    contactEmail: ['', [Validators.required, Validators.email]],
    whatsappNumber: [''],
    instagramUrl: [''],
    facebookUrl: [''],
    metaDescription: ['La mejor tienda online del mercado.'],
  });

  nextStep(): void {
    if (this.currentStep() === 1) {
      if (this.form.get('storeName')?.invalid) {
        this.form.get('storeName')?.markAsTouched();
        return;
      }
    }
    if (this.currentStep() === 2) {
      if (
        this.form.get('colorPrimary')?.invalid ||
        this.form.get('colorAccent')?.invalid ||
        this.form.get('colorBackground')?.invalid
      ) {
        this.form.get('colorPrimary')?.markAsTouched();
        this.form.get('colorAccent')?.markAsTouched();
        this.form.get('colorBackground')?.markAsTouched();
        return;
      }
    }
    this.currentStep.update((step) => step + 1);
  }

  prevStep(): void {
    this.currentStep.update((step) => step - 1);
  }

  onLogoUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    this.logoUploading.set(true);
    this.logoProgress.set(0);

    const upload = this.storageService.uploadFile(file, 'store/branding');
    upload.progress$.subscribe((progress) => this.logoProgress.set(Math.round(progress)));
    upload.downloadUrl$.subscribe({
      next: (url) => {
        this.form.patchValue({ logoUrl: url });
        this.logoUploading.set(false);
        this.sweetAlert.success('Logo subido', 'El logo de la tienda fue cargado.');
      },
      error: (err) => {
        console.error('Error al subir logo:', err);
        this.logoUploading.set(false);
        this.sweetAlert.error('Error de subida', 'No se pudo cargar el logo.');
      },
    });
  }

  async finishWizard(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.sweetAlert.error(
        'Formulario incompleto',
        'Por favor, completá todos los campos requeridos.'
      );
      return;
    }

    this.isSubmitting = true;
    try {
      const formValue = this.form.value;
      const completeConfig: StoreConfig = {
        setupCompleted: true,
        storeName: formValue.storeName ?? '',
        tagline: formValue.tagline ?? '',
        logoUrl: formValue.logoUrl ?? '',
        faviconUrl: formValue.faviconUrl ?? '',
        colorPrimary: formValue.colorPrimary ?? '#ea580c',
        colorAccent: formValue.colorAccent ?? '#ef4444',
        colorBackground: formValue.colorBackground ?? '#1a1a2e',
        mercadoPagoPublicKey: formValue.mercadoPagoPublicKey ?? '',
        contactPhone: formValue.contactPhone ?? '',
        contactEmail: formValue.contactEmail ?? '',
        whatsappNumber: formValue.whatsappNumber ?? '',
        instagramUrl: formValue.instagramUrl ?? '',
        facebookUrl: formValue.facebookUrl ?? '',
        metaDescription: formValue.metaDescription ?? '',
      };

      const validated = StoreConfigSchema.parse(completeConfig);
      await this.storeConfigService.saveConfig(validated as StoreConfig);
      this.sweetAlert.success(
        '¡Instalación Exitosa!',
        'Tu tienda ha sido configurada y ya está lista para operar.'
      );
      this.wizardCompleted.emit();
    } catch (err) {
      console.error('Error al finalizar el asistente:', err);
      this.sweetAlert.error('Error', 'Ocurrió un error al guardar la configuración inicial.');
    } finally {
      this.isSubmitting = false;
    }
  }
}
