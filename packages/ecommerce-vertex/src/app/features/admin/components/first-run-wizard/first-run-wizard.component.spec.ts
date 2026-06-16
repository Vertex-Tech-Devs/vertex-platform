import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { FirstRunWizardComponent } from './first-run-wizard.component';
import { StoreConfigService } from '@core/services/store-config.service';
import { StorageService } from '@core/services/storage.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';

describe('FirstRunWizardComponent', () => {
  let component: FirstRunWizardComponent;
  let fixture: ComponentFixture<FirstRunWizardComponent>;
  let storeConfigServiceSpy: jasmine.SpyObj<StoreConfigService>;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let sweetAlertSpy: jasmine.SpyObj<SweetAlertService>;

  beforeEach(async () => {
    storeConfigServiceSpy = jasmine.createSpyObj('StoreConfigService', ['saveConfig']);
    storageServiceSpy = jasmine.createSpyObj('StorageService', ['uploadFile']);
    sweetAlertSpy = jasmine.createSpyObj('SweetAlertService', ['success', 'error']);

    storeConfigServiceSpy.saveConfig.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [FirstRunWizardComponent, ReactiveFormsModule],
      providers: [
        { provide: StoreConfigService, useValue: storeConfigServiceSpy },
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: SweetAlertService, useValue: sweetAlertSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FirstRunWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start at step 1', () => {
    expect(component.currentStep()).toBe(1);
  });

  it('should validate step 1 storeName before moving to step 2', () => {
    component.form.patchValue({ storeName: '' }); // invalid
    component.nextStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(1);

    component.form.patchValue({ storeName: 'Store Name' }); // valid
    component.nextStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(2);
  });

  it('should validate step 2 colors before moving to step 3', () => {
    component.form.patchValue({ storeName: 'Store Name' });
    component.nextStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(2);

    component.form.patchValue({ colorPrimary: '' }); // invalid
    component.nextStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(2);

    component.form.patchValue({ colorPrimary: '#ea580c', colorAccent: '' }); // invalid
    component.nextStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(2);

    component.form.patchValue({ colorAccent: '#ef4444', colorBackground: '' }); // invalid
    component.nextStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(2);

    component.form.patchValue({ colorBackground: '#1a1a2e' });
    component.nextStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(3);
  });

  it('should navigate back using prevStep', () => {
    component.form.patchValue({ storeName: 'Store Name' });
    component.nextStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(2);
    component.prevStep();
    fixture.detectChanges();
    expect(component.currentStep()).toBe(1);
  });

  it('should handle null form controls in nextStep', () => {
    spyOn(component.form, 'get').and.returnValue(null);
    component.currentStep.set(1);
    component.nextStep();
    expect(component.currentStep()).toBe(2);

    component.currentStep.set(2);
    component.nextStep();
    expect(component.currentStep()).toBe(3);
  });

  it('should handle successful logo upload', () => {
    const file = new File([''], 'logo.png', { type: 'image/png' });
    const event = {
      target: {
        files: [file],
      },
    } as unknown as Event;

    const mockUpload = {
      progress$: of(50, 100),
      downloadUrl$: of('http://example.com/logo.png'),
    };
    storageServiceSpy.uploadFile.and.returnValue(
      mockUpload as unknown as ReturnType<StorageService['uploadFile']>
    );

    component.onLogoUpload(event);

    expect(storageServiceSpy.uploadFile).toHaveBeenCalledWith(file, 'store/branding');
    expect(component.form.get('logoUrl')?.value).toBe('http://example.com/logo.png');
    expect(component.logoUploading()).toBeFalse();
    expect(sweetAlertSpy.success).toHaveBeenCalled();
  });

  it('should handle failed logo upload', () => {
    const file = new File([''], 'logo.png', { type: 'image/png' });
    const event = {
      target: {
        files: [file],
      },
    } as unknown as Event;

    const mockUpload = {
      progress$: of(10),
      downloadUrl$: throwError(() => new Error('Upload error')),
    };
    storageServiceSpy.uploadFile.and.returnValue(
      mockUpload as unknown as ReturnType<StorageService['uploadFile']>
    );

    component.onLogoUpload(event);

    expect(component.logoUploading()).toBeFalse();
    expect(sweetAlertSpy.error).toHaveBeenCalled();
  });

  it('should not upload if file list is empty', () => {
    const event = {
      target: {
        files: [],
      },
    } as unknown as Event;

    component.onLogoUpload(event);
    expect(storageServiceSpy.uploadFile).not.toHaveBeenCalled();
  });

  it('should prevent finishWizard if form is invalid', async () => {
    component.form.patchValue({
      storeName: 'Test Store',
      contactPhone: '',
      contactEmail: '',
    });
    await component.finishWizard();
    expect(storeConfigServiceSpy.saveConfig).not.toHaveBeenCalled();
    expect(sweetAlertSpy.error).toHaveBeenCalled();
  });

  it('should handle finishWizard saveConfig error', async () => {
    component.form.patchValue({
      storeName: 'Test Store',
      contactPhone: '+5411223344',
      contactEmail: 'test@example.com',
    });
    storeConfigServiceSpy.saveConfig.and.returnValue(Promise.reject('error'));
    await component.finishWizard();
    expect(storeConfigServiceSpy.saveConfig).toHaveBeenCalled();
    expect(sweetAlertSpy.error).toHaveBeenCalled();
  });

  it('should handle successful finishWizard execution and emit wizardCompleted', async () => {
    component.form.patchValue({
      storeName: 'Test Store',
      contactPhone: '+5411223344',
      contactEmail: 'test@example.com',
    });
    let emitted = false;
    component.wizardCompleted.subscribe(() => {
      emitted = true;
    });

    await component.finishWizard();
    expect(storeConfigServiceSpy.saveConfig).toHaveBeenCalled();
    expect(sweetAlertSpy.success).toHaveBeenCalled();
    expect(emitted).toBeTrue();
  });

  it('should fallback to default values in finishWizard when form controls are disabled', async () => {
    component.form.patchValue({
      storeName: 'Test Store',
      colorPrimary: '#ea580c',
      colorAccent: '#ef4444',
      colorBackground: '#1a1a2e',
      contactPhone: '+5411223344',
      contactEmail: 'test@example.com',
    });
    component.form.disable();

    await component.finishWizard();
    expect(storeConfigServiceSpy.saveConfig).toHaveBeenCalled();
  });

  it('should ignore logo upload if files is null', () => {
    const event = {
      target: {
        files: null,
      },
    } as unknown as Event;

    component.onLogoUpload(event);
    expect(storageServiceSpy.uploadFile).not.toHaveBeenCalled();
  });
});
