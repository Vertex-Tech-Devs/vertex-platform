import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FormGroup, FormArray } from '@angular/forms';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import { take } from 'rxjs';
import type { AboutUsData, AboutUsFeatureCard } from '@core/models/about-us.model';
import { AboutUsService } from '@core/services/about-us.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';

@Component({
  selector: 'app-about-us-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './about-us-management.component.html',
  styleUrls: ['./about-us-management.component.scss'],
})
export class AboutUsManagementComponent implements OnInit {
  private fb = inject(FormBuilder);
  private aboutUsService = inject(AboutUsService);
  private alertService = inject(SweetAlertService);

  aboutUsForm!: FormGroup;
  data$: Observable<AboutUsData | undefined>;
  isLoading = true;
  isSubmitting = false;
  mobileActiveSection: number = 1;

  selectedBannerFile: File | null = null;
  bannerPreviewUrl: string | null = null;
  selectedCentralFile: File | null = null;
  centralPreviewUrl: string | null = null;

  constructor() {
    this.data$ = this.aboutUsService.getAboutUsData();
    this.buildForm();
  }

  ngOnInit(): void {
    this.loadDataIntoForm();
  }

  toggleMobileSection(section: number): void {
    this.mobileActiveSection = this.mobileActiveSection === section ? 0 : section;
  }

  private buildForm(data: AboutUsData | null = null): void {
    const d = data ?? ({} as Partial<AboutUsData>);
    this.aboutUsForm = this.fb.group({
      bannerTitle: [d.bannerTitle ?? '', Validators.required],
      bannerSubtitle: [d.bannerSubtitle ?? ''],
      bannerImageUrl: [d.bannerImageUrl ?? '', [Validators.pattern('https?://.+')]],
      centralTitle: [d.centralTitle ?? '', Validators.required],
      centralImageUrl: [d.centralImageUrl ?? '', [Validators.pattern('https?://.+')]],
      centralDescription: [
        d.centralDescription ?? '',
        [Validators.required, Validators.minLength(50), Validators.maxLength(1000)],
      ],
      cardsSectionTitle: [d.cardsSectionTitle ?? '', Validators.required],
      featureCards: this.fb.array(
        [],
        [Validators.required, Validators.minLength(1), Validators.maxLength(2)]
      ),
    });
    this.initFeatureCards(data);
  }

  private initFeatureCards(data: AboutUsData | null): void {
    if (data?.featureCards && data.featureCards.length > 0) {
      data.featureCards.forEach((card) => this.addFeatureCard(card));
    } else {
      this.addFeatureCard();
    }
  }

  private loadDataIntoForm(): void {
    this.isLoading = true;
    this.data$.pipe(take(1)).subscribe((data) => {
      if (data) {
        this.buildForm(data);
      } else {
        this.buildForm();
      }
      this.bannerPreviewUrl = null;
      this.centralPreviewUrl = null;
      this.selectedBannerFile = null;
      this.selectedCentralFile = null;
      this.isLoading = false;
    });
  }

  get featureCards(): FormArray {
    return this.aboutUsForm.get('featureCards') as FormArray;
  }

  private createFeatureCardGroup(card: AboutUsFeatureCard | null = null): FormGroup {
    return this.fb.group({
      title: [card?.title ?? '', Validators.required],
      content: [card?.content ?? '', Validators.required],
    });
  }

  addFeatureCard(cardData?: AboutUsFeatureCard): void {
    if (this.featureCards.length >= 2) {
      return;
    }
    const cardGroup = this.createFeatureCardGroup(cardData ?? null);
    this.featureCards.push(cardGroup);
  }

  removeFeatureCard(index: number): void {
    if (this.featureCards.length <= 1) {
      return;
    }
    this.featureCards.removeAt(index);
    this.aboutUsForm.markAsDirty();
  }

  onFileSelected(event: Event, type: 'banner' | 'central'): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        this.alertService.error('Archivo no válido', 'Por favor, selecciona un archivo de imagen.');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (): void => {
        const previewUrl = reader.result as string;
        if (type === 'banner') {
          this.selectedBannerFile = file;
          this.bannerPreviewUrl = previewUrl;
          this.aboutUsForm.get('bannerImageUrl')?.setValue('');
        } else if (type === 'central') {
          this.selectedCentralFile = file;
          this.centralPreviewUrl = previewUrl;
          this.aboutUsForm.get('centralImageUrl')?.setValue('');
        }
        this.aboutUsForm.markAsDirty();
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  }

  onSubmit(): void {
    if (this.aboutUsForm.invalid) {
      this.aboutUsForm.markAllAsTouched();
      this.alertService.error(
        'Formulario Inválido',
        'Por favor, revisa todos los campos marcados en rojo.'
      );
      return;
    }

    this.isSubmitting = true;
    this.alertService.loading('Guardando Cambios...');

    const formData = this.aboutUsForm.value as AboutUsData;

    this.aboutUsService
      .saveAboutUsData(formData, this.selectedBannerFile, this.selectedCentralFile)
      .then(() => {
        this.alertService.success(
          '¡Guardado!',
          'El contenido de la página "Nosotros" ha sido actualizado.'
        );
        this.aboutUsForm.markAsPristine();
        this.bannerPreviewUrl = null;
        this.centralPreviewUrl = null;
        this.selectedBannerFile = null;
        this.selectedCentralFile = null;
      })
      .catch((err) => {
        console.error('Error saving data:', err);
        this.alertService.error('Error', 'No se pudieron guardar los cambios.');
      })
      .finally(() => {
        this.isSubmitting = false;
        this.alertService.close();
      });
  }

  resetForm(): void {
    this.loadDataIntoForm();
  }
}
