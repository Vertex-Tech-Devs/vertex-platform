import type { OnInit } from '@angular/core';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoreConfigService } from '@core/services/store-config.service';
import { StoreConfigSchema } from '@vertex/contracts';
import { StorageService } from '@core/services/storage.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';
import { AuthService } from '@core/services/auth.service';
import type { StoreConfig } from '@core/models/store-config.model';

@Component({
  selector: 'app-store-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './store-config.component.html',
  styleUrls: ['./store-config.component.scss'],
})
export class StoreConfigComponent implements OnInit {
  private fb = inject(FormBuilder);
  private storeConfigService = inject(StoreConfigService);
  private storageService = inject(StorageService);
  private sweetAlert = inject(SweetAlertService);
  private authService = inject(AuthService);

  readonly isOwner = toSignal(this.authService.isOwner$, { initialValue: false });
  isSubmitting = false;
  activeTab = signal<'identity' | 'colors' | 'payments' | 'contact-seo'>('identity');

  // File uploading states
  logoProgress = signal<number>(0);
  faviconProgress = signal<number>(0);
  logoUploading = signal<boolean>(false);
  faviconUploading = signal<boolean>(false);

  // Visibility toggle for keys
  showMpKey = signal<boolean>(false);

  form = this.fb.group({
    setupCompleted: [true],
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
    metaDescription: ['', Validators.required],
  });

  ngOnInit(): void {
    const cfg = this.storeConfigService.storeConfig();
    if (cfg) {
      this.form.patchValue({
        setupCompleted: cfg.setupCompleted ?? true,
        storeName: cfg.storeName ?? '',
        tagline: cfg.tagline ?? '',
        logoUrl: cfg.logoUrl ?? '',
        faviconUrl: cfg.faviconUrl ?? '',
        colorPrimary: cfg.colorPrimary ?? '#ea580c',
        colorAccent: cfg.colorAccent ?? '#ef4444',
        colorBackground: cfg.colorBackground ?? '#1a1a2e',
        mercadoPagoPublicKey: cfg.mercadoPagoPublicKey ?? '',
        contactPhone: cfg.contactPhone ?? '',
        contactEmail: cfg.contactEmail ?? '',
        whatsappNumber: cfg.whatsappNumber ?? '',
        instagramUrl: cfg.instagramUrl ?? '',
        facebookUrl: cfg.facebookUrl ?? '',
        metaDescription: cfg.metaDescription ?? '',
      });
    } else {
      this.form.patchValue({
        setupCompleted: false,
        storeName: 'Mi Tienda',
        tagline: 'La mejor tienda online',
        colorPrimary: '#ea580c',
        colorAccent: '#ef4444',
        colorBackground: '#1a1a2e',
        contactPhone: '+54 11 1234-5678',
        contactEmail: 'contacto@mitienda.com',
        metaDescription: 'Bienvenidos a mi tienda virtual.',
      });
    }
  }

  setTab(tab: 'identity' | 'colors' | 'payments' | 'contact-seo'): void {
    this.activeTab.set(tab);
  }

  derivedWebhookUrl(): string {
    const origin = window.location.origin;
    return `${origin}/api/mercadoPagoWebhookHandler`;
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
        this.sweetAlert.success('Logo subido', 'El logo corporativo fue cargado exitosamente.');
      },
      error: (err) => {
        console.error('Error al subir el logo:', err);
        this.logoUploading.set(false);
        this.sweetAlert.error('Error de subida', 'No se pudo cargar el logo corporativo.');
      },
    });
  }

  onFaviconUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    this.faviconUploading.set(true);
    this.faviconProgress.set(0);

    const upload = this.storageService.uploadFile(file, 'store/branding');
    upload.progress$.subscribe((progress) => this.faviconProgress.set(Math.round(progress)));
    upload.downloadUrl$.subscribe({
      next: (url) => {
        this.form.patchValue({ faviconUrl: url });
        this.faviconUploading.set(false);
        this.sweetAlert.success(
          'Favicon subido',
          'El favicon corporativo fue cargado exitosamente.'
        );
      },
      error: (err) => {
        console.error('Error al subir el favicon:', err);
        this.faviconUploading.set(false);
        this.sweetAlert.error('Error de subida', 'No se pudo cargar el favicon corporativo.');
      },
    });
  }

  toggleMpKeyVisibility(): void {
    this.showMpKey.update((val) => !val);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.sweetAlert.error(
        'Formulario inválido',
        'Revisá los campos obligatorios en cada pestaña.'
      );
      return;
    }
    this.isSubmitting = true;
    try {
      const rawValue = this.form.value;
      const validatedData = StoreConfigSchema.parse(rawValue);
      await this.storeConfigService.saveConfig(validatedData as StoreConfig);
      this.sweetAlert.success(
        '¡Listo!',
        'La configuración de marca blanca fue guardada con éxito.'
      );
    } catch (err) {
      console.error('Error al guardar la configuración:', err);
      this.sweetAlert.error('Error', 'No se pudo guardar la configuración de la tienda.');
    } finally {
      this.isSubmitting = false;
    }
  }
}
