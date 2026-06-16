import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FormGroup, AbstractControl } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Observable } from 'rxjs';
import { take } from 'rxjs';
import type { FooterData } from '@core/models/footer.model';
import { FooterService } from '@core/services/footer.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';

@Component({
  selector: 'app-footer-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './footer-management.component.html',
  styleUrls: ['./footer-management.component.scss'],
})
export class FooterManagementComponent implements OnInit {
  private fb = inject(FormBuilder);
  private footerService = inject(FooterService);
  private alertService = inject(SweetAlertService);

  footerForm!: FormGroup;
  data$: Observable<FooterData | undefined>;
  isLoading = true;
  isSubmitting = false;

  private urlPattern = /^(|https?:\/\/[^\s$.?#].[^\s]*)$/;

  constructor() {
    this.data$ = this.footerService.getFooterData();
    this.buildForm();
  }

  ngOnInit(): void {
    this.loadDataIntoForm();
  }

  private buildForm(data: FooterData | null = null): void {
    this.footerForm = this.fb.group({
      contactPhone: [data?.contactPhone ?? ''],
      contactEmail: [data?.contactEmail ?? '', [Validators.required, Validators.email]],

      socialInstagramUrl: [data?.socialInstagramUrl ?? '', [Validators.pattern(this.urlPattern)]],
      socialFacebookUrl: [data?.socialFacebookUrl ?? '', [Validators.pattern(this.urlPattern)]],
      socialWhatsAppUrl: [data?.socialWhatsAppUrl ?? '', [Validators.pattern(this.urlPattern)]],

      copyrightText: [data?.copyrightText ?? '', Validators.required],
    });
  }

  private loadDataIntoForm(): void {
    this.isLoading = true;
    this.data$.pipe(take(1)).subscribe((data) => {
      if (data) {
        this.buildForm(data);
      } else {
      }
      this.isLoading = false;
    });
  }

  get email(): AbstractControl | null {
    return this.footerForm.get('contactEmail');
  }
  get instagram(): AbstractControl | null {
    return this.footerForm.get('socialInstagramUrl');
  }
  get facebook(): AbstractControl | null {
    return this.footerForm.get('socialFacebookUrl');
  }
  get whatsapp(): AbstractControl | null {
    return this.footerForm.get('socialWhatsAppUrl');
  }
  get copyright(): AbstractControl | null {
    return this.footerForm.get('copyrightText');
  }

  onSubmit(): void {
    if (this.footerForm.invalid) {
      this.footerForm.markAllAsTouched();
      this.alertService.error(
        'Formulario Inválido',
        'Revisa los campos, algunas URLs o el email no son válidos.'
      );
      return;
    }

    this.isSubmitting = true;
    this.alertService.loading('Actualizando Footer...');

    const formData = this.footerForm.value as FooterData;

    this.footerService
      .saveFooterData(formData)
      .then(() => {
        this.alertService.success('¡Actualizado!', 'La información del footer ha sido guardada.');
        this.footerForm.markAsPristine();
      })
      .catch((err) => {
        console.error('Error saving footer data:', err);
        this.alertService.error('Error', 'No se pudieron guardar los cambios.');
      })
      .finally(() => {
        this.isSubmitting = false;
      });
  }

  resetForm(): void {
    void this.alertService
      .confirm(
        'Descartar Cambios',
        '¿Quieres descartar los cambios no guardados y recargar los datos actuales?'
      )
      .then((confirmed) => {
        if (confirmed) {
          this.loadDataIntoForm();
        }
      });
  }
}
