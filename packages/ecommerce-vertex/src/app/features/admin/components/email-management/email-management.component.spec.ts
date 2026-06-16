import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { EmailManagementComponent } from './email-management.component';
import { EmailSettingsService } from '@core/services/email-settings.service';
import type { EmailSettings } from '@core/models/email-settings.model';
import { SweetAlertService } from '@core/services/sweet-alert.service';

describe('EmailManagementComponent', () => {
  let component: EmailManagementComponent;
  let fixture: ComponentFixture<EmailManagementComponent>;
  let emailSettingsSpy: jasmine.SpyObj<EmailSettingsService>;
  let sweetAlertSpy: jasmine.SpyObj<SweetAlertService>;

  const validSettings = {
    storeOwnerEmail: 'owner@test.com',
    storeWhatsappNumber: '',
    adminNotification: {
      subject: 'Nuevo pedido',
      template: '<p>pedido</p>',
      showManageButton: false,
      showWhatsappButton: false,
    },
    customerConfirmation: {
      subject: 'Confirmación',
      template: '<p>gracias</p>',
      showWhatsappButton: false,
    },
  };

  beforeEach(async () => {
    emailSettingsSpy = jasmine.createSpyObj('EmailSettingsService', [
      'getEmailSettings',
      'saveEmailSettings',
      'sendAdvancedTestEmail',
    ]);
    emailSettingsSpy.getEmailSettings.and.returnValue(of(validSettings as EmailSettings));
    emailSettingsSpy.saveEmailSettings.and.returnValue(Promise.resolve());

    sweetAlertSpy = jasmine.createSpyObj('SweetAlertService', [
      'success',
      'error',
      'confirm',
      'loading',
    ]);
    sweetAlertSpy.confirm.and.returnValue(Promise.resolve(true));

    await TestBed.configureTestingModule({
      imports: [EmailManagementComponent, ReactiveFormsModule],
      providers: [
        { provide: EmailSettingsService, useValue: emailSettingsSpy },
        { provide: SweetAlertService, useValue: sweetAlertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(EmailManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load settings and mark form as pristine', () => {
    expect(emailSettingsSpy.getEmailSettings).toHaveBeenCalled();
    expect(component.emailForm.pristine).toBeTrue();
    expect(component.isLoading).toBeFalse();
  });

  it('should mark form as dirty when markFormDirty() is called (Quill change handler)', () => {
    expect(component.emailForm.dirty).toBeFalse();
    component.markFormDirty();
    expect(component.emailForm.dirty).toBeTrue();
  });

  it('save button should be enabled after markFormDirty()', () => {
    component.markFormDirty();
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBeFalse();
  });

  it('save button should remain disabled when form is invalid', () => {
    component.emailForm.get('storeOwnerEmail')?.setValue('');
    component.markFormDirty();
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(btn.disabled).toBeTrue();
  });

  it('storeWhatsappNumber should be optional (no required validator)', () => {
    component.emailForm.get('storeWhatsappNumber')?.setValue('');
    component.markFormDirty();
    expect(component.emailForm.valid).toBeTrue();
  });

  it('should mark form as dirty when restoreDefaults is called with showAlert=false', async () => {
    await component.restoreDefaults(false);
    expect(component.emailForm.dirty).toBeTrue();
  });

  it('loadEmailSettings should NOT markAsPristine after restoreDefaults', async () => {
    emailSettingsSpy.getEmailSettings.and.returnValue(of<EmailSettings | undefined>(undefined));
    component['loadEmailSettings']();
    await fixture.whenStable();
    expect(component.emailForm.dirty).toBeTrue();
  });

  it('onSubmit should save and mark form as pristine on success', async () => {
    component.markFormDirty();
    fixture.detectChanges();

    await component.onSubmit();

    expect(emailSettingsSpy.saveEmailSettings).toHaveBeenCalled();
    expect(sweetAlertSpy.success).toHaveBeenCalled();
    expect(component.emailForm.pristine).toBeTrue();
  });

  it('onSubmit should call error when form is invalid', async () => {
    component.emailForm.get('storeOwnerEmail')?.setValue('');
    component.markFormDirty();

    await component.onSubmit();

    expect(sweetAlertSpy.error).toHaveBeenCalled();
    expect(emailSettingsSpy.saveEmailSettings).not.toHaveBeenCalled();
  });

  it('onSubmit should call error when saveEmailSettings rejects', async () => {
    emailSettingsSpy.saveEmailSettings.and.returnValue(Promise.reject(new Error('network')));
    component.markFormDirty();

    await component.onSubmit();

    expect(sweetAlertSpy.error).toHaveBeenCalled();
  });

  it('openTestModal should make the modal visible and pre-fill email', () => {
    expect(component.isTestModalVisible).toBeFalse();
    component.openTestModal();
    expect(component.isTestModalVisible).toBeTrue();
    expect(component.testEmailModalForm.get('recipientEmail')?.value).toBe('owner@test.com');
  });

  it('closeTestModal should hide the modal', () => {
    component.openTestModal();
    component.closeTestModal();
    expect(component.isTestModalVisible).toBeFalse();
  });

  it('restoreDefaults(true) with confirm=true should mark form dirty and show success', async () => {
    sweetAlertSpy.confirm.and.returnValue(Promise.resolve(true));
    component.emailForm.markAsPristine();

    await component.restoreDefaults(true);

    expect(component.emailForm.dirty).toBeTrue();
    expect(sweetAlertSpy.success).toHaveBeenCalled();
  });

  it('restoreDefaults(true) with confirm=false should not change form', async () => {
    sweetAlertSpy.confirm.and.returnValue(Promise.resolve(false));
    component.emailForm.markAsPristine();

    await component.restoreDefaults(true);

    expect(component.emailForm.pristine).toBeTrue();
  });

  it('onSendAdvancedTest should call error when modal form is invalid', async () => {
    component.testEmailModalForm.get('recipientEmail')?.setValue('not-an-email');

    await component.onSendAdvancedTest();

    expect(sweetAlertSpy.error).toHaveBeenCalled();
    expect(emailSettingsSpy.sendAdvancedTestEmail).not.toHaveBeenCalled();
  });

  it('onSendAdvancedTest should call error when no templates are selected', async () => {
    component.testEmailModalForm.get('recipientEmail')?.setValue('test@test.com');
    component.testEmailModalForm.get('templatesToTest.adminNotification')?.setValue(false);
    component.testEmailModalForm.get('templatesToTest.customerConfirmation')?.setValue(false);

    await component.onSendAdvancedTest();

    expect(sweetAlertSpy.error).toHaveBeenCalled();
    expect(emailSettingsSpy.sendAdvancedTestEmail).not.toHaveBeenCalled();
  });

  it('onSendAdvancedTest should send email and close modal on success', async () => {
    emailSettingsSpy.sendAdvancedTestEmail.and.returnValue(Promise.resolve());
    component.testEmailModalForm.get('recipientEmail')?.setValue('test@test.com');
    component.isTestModalVisible = true;

    await component.onSendAdvancedTest();

    expect(emailSettingsSpy.sendAdvancedTestEmail).toHaveBeenCalled();
    expect(sweetAlertSpy.success).toHaveBeenCalled();
    expect(component.isTestModalVisible).toBeFalse();
  });

  it('onSendAdvancedTest should call error when sendAdvancedTestEmail rejects', async () => {
    emailSettingsSpy.sendAdvancedTestEmail.and.returnValue(
      Promise.reject(new Error('server error'))
    );
    component.testEmailModalForm.get('recipientEmail')?.setValue('test@test.com');

    await component.onSendAdvancedTest();

    expect(sweetAlertSpy.error).toHaveBeenCalled();
  });
});
