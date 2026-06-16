import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { StoreConfigComponent } from './store-config.component';
import { StoreConfigService } from '@core/services/store-config.service';
import { StorageService } from '@core/services/storage.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';
import { AuthService } from '@core/services/auth.service';
import type { StoreConfig } from '@core/models/store-config.model';

describe('StoreConfigComponent', () => {
  let component: StoreConfigComponent;
  let fixture: ComponentFixture<StoreConfigComponent>;
  let storeConfigServiceSpy: jasmine.SpyObj<StoreConfigService>;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let sweetAlertSpy: jasmine.SpyObj<SweetAlertService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const mockConfig: StoreConfig = {
    storeName: 'Test Store',
    tagline: 'Test Tagline',
    logoUrl: 'http://example.com/logo.png',
    faviconUrl: 'http://example.com/favicon.png',
    colorPrimary: '#ea580c',
    colorAccent: '#ef4444',
    colorBackground: '#ffffff',
    mercadoPagoPublicKey: 'TEST-PUBLIC-KEY',
    contactPhone: '+54 11 1234-5678',
    contactEmail: 'test@store.com',
    whatsappNumber: '+5491112345678',
    instagramUrl: 'https://instagram.com/test',
    facebookUrl: 'https://facebook.com/test',
    metaDescription: 'Test SEO Description',
    setupCompleted: true,
  };

  beforeEach(async () => {
    storeConfigServiceSpy = jasmine.createSpyObj('StoreConfigService', [
      'loadConfig',
      'saveConfig',
    ]);
    storageServiceSpy = jasmine.createSpyObj('StorageService', ['uploadFile']);
    sweetAlertSpy = jasmine.createSpyObj('SweetAlertService', ['success', 'error']);
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      isOwner$: of(true),
    });

    // Mock signals
    const mockConfigSignal = signal<StoreConfig | null>(mockConfig);
    const mockStoreNameSignal = signal<string>('Test Store');
    const mockLogoUrlSignal = signal<string>('http://example.com/logo.png');
    const mockIsFirstRunSignal = signal<boolean>(false);

    Object.defineProperty(storeConfigServiceSpy, 'storeConfig', {
      value: mockConfigSignal.asReadonly(),
    });
    Object.defineProperty(storeConfigServiceSpy, 'storeName', {
      value: mockStoreNameSignal.asReadonly(),
    });
    Object.defineProperty(storeConfigServiceSpy, 'logoUrl', {
      value: mockLogoUrlSignal.asReadonly(),
    });
    Object.defineProperty(storeConfigServiceSpy, 'isFirstRun', {
      value: mockIsFirstRunSignal.asReadonly(),
    });

    storeConfigServiceSpy.saveConfig.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [StoreConfigComponent, ReactiveFormsModule],
      providers: [
        { provide: StoreConfigService, useValue: storeConfigServiceSpy },
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: SweetAlertService, useValue: sweetAlertSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StoreConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with values from StoreConfigService', () => {
    expect(component.form.get('storeName')?.value).toBe('Test Store');
    expect(component.form.get('tagline')?.value).toBe('Test Tagline');
    expect(component.form.get('colorPrimary')?.value).toBe('#ea580c');
    expect(component.form.get('mercadoPagoPublicKey')?.value).toBe('TEST-PUBLIC-KEY');
    expect(component.form.get('contactEmail')?.value).toBe('test@store.com');
  });

  it('should change activeTab signal when setTab is called', () => {
    expect(component.activeTab()).toBe('identity');
    component.setTab('colors');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('colors');
    component.setTab('payments');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('payments');
    component.setTab('contact-seo');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('contact-seo');
  });

  it('should show error alert if form is invalid on submit', async () => {
    component.form.patchValue({ storeName: '' }); // Invalid
    await component.onSubmit();
    expect(sweetAlertSpy.error).toHaveBeenCalled();
    expect(storeConfigServiceSpy.saveConfig).not.toHaveBeenCalled();
  });

  it('should call saveConfig and show success alert on valid submit', async () => {
    await component.onSubmit();
    expect(storeConfigServiceSpy.saveConfig).toHaveBeenCalled();
    expect(sweetAlertSpy.success).toHaveBeenCalled();
  });

  it('should toggle MP key visibility flag', () => {
    expect(component.showMpKey()).toBeFalse();
    component.toggleMpKeyVisibility();
    expect(component.showMpKey()).toBeTrue();
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
      downloadUrl$: of('http://example.com/new-logo.png'),
    };
    storageServiceSpy.uploadFile.and.returnValue(
      mockUpload as unknown as ReturnType<StorageService['uploadFile']>
    );

    component.onLogoUpload(event);

    expect(storageServiceSpy.uploadFile).toHaveBeenCalledWith(file, 'store/branding');
    expect(component.form.get('logoUrl')?.value).toBe('http://example.com/new-logo.png');
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
      progress$: of(50),
      downloadUrl$: throwError(() => new Error('Upload error')),
    };
    storageServiceSpy.uploadFile.and.returnValue(
      mockUpload as unknown as ReturnType<StorageService['uploadFile']>
    );

    component.onLogoUpload(event);

    expect(component.logoUploading()).toBeFalse();
    expect(sweetAlertSpy.error).toHaveBeenCalled();
  });

  it('should handle successful favicon upload', () => {
    const file = new File([''], 'favicon.png', { type: 'image/png' });
    const event = {
      target: {
        files: [file],
      },
    } as unknown as Event;

    const mockUpload = {
      progress$: of(50, 100),
      downloadUrl$: of('http://example.com/new-favicon.png'),
    };
    storageServiceSpy.uploadFile.and.returnValue(
      mockUpload as unknown as ReturnType<StorageService['uploadFile']>
    );

    component.onFaviconUpload(event);

    expect(storageServiceSpy.uploadFile).toHaveBeenCalledWith(file, 'store/branding');
    expect(component.form.get('faviconUrl')?.value).toBe('http://example.com/new-favicon.png');
    expect(component.faviconUploading()).toBeFalse();
    expect(sweetAlertSpy.success).toHaveBeenCalled();
  });

  it('should handle failed favicon upload', () => {
    const file = new File([''], 'favicon.png', { type: 'image/png' });
    const event = {
      target: {
        files: [file],
      },
    } as unknown as Event;

    const mockUpload = {
      progress$: of(50),
      downloadUrl$: throwError(() => new Error('Upload error')),
    };
    storageServiceSpy.uploadFile.and.returnValue(
      mockUpload as unknown as ReturnType<StorageService['uploadFile']>
    );

    component.onFaviconUpload(event);

    expect(component.faviconUploading()).toBeFalse();
    expect(sweetAlertSpy.error).toHaveBeenCalled();
  });

  it('should ignore logo upload if files list is empty or null', () => {
    const event1 = {
      target: {
        files: [],
      },
    } as unknown as Event;
    component.onLogoUpload(event1);
    expect(storageServiceSpy.uploadFile).not.toHaveBeenCalled();

    const event2 = {
      target: {
        files: null,
      },
    } as unknown as Event;
    component.onLogoUpload(event2);
    expect(storageServiceSpy.uploadFile).not.toHaveBeenCalled();
  });

  it('should ignore favicon upload if files list is empty or null', () => {
    const event1 = {
      target: {
        files: [],
      },
    } as unknown as Event;
    component.onFaviconUpload(event1);
    expect(storageServiceSpy.uploadFile).not.toHaveBeenCalled();

    const event2 = {
      target: {
        files: null,
      },
    } as unknown as Event;
    component.onFaviconUpload(event2);
    expect(storageServiceSpy.uploadFile).not.toHaveBeenCalled();
  });

  it('should handle error when saveConfig fails in onSubmit', async () => {
    storeConfigServiceSpy.saveConfig.and.returnValue(Promise.reject(new Error('Save failed')));
    await component.onSubmit();
    expect(sweetAlertSpy.error).toHaveBeenCalled();
    expect(component.isSubmitting).toBeFalse();
  });

  it('should not patch form if config is null on init', () => {
    const mockConfigSignal = signal<StoreConfig | null>(null);
    const mockStoreNameSignal = signal<string>('Test Store');
    const mockLogoUrlSignal = signal<string>('');
    const mockIsFirstRunSignal = signal<boolean>(true);

    const localSpy = jasmine.createSpyObj('StoreConfigService', ['loadConfig', 'saveConfig']);
    Object.defineProperty(localSpy, 'storeConfig', {
      value: mockConfigSignal.asReadonly(),
    });
    Object.defineProperty(localSpy, 'storeName', {
      value: mockStoreNameSignal.asReadonly(),
    });
    Object.defineProperty(localSpy, 'logoUrl', {
      value: mockLogoUrlSignal.asReadonly(),
    });
    Object.defineProperty(localSpy, 'isFirstRun', {
      value: mockIsFirstRunSignal.asReadonly(),
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StoreConfigComponent, ReactiveFormsModule],
      providers: [
        { provide: StoreConfigService, useValue: localSpy },
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: SweetAlertService, useValue: sweetAlertSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    const localFixture = TestBed.createComponent(StoreConfigComponent);
    const localComp = localFixture.componentInstance;
    localFixture.detectChanges();
    expect(localComp.form.get('storeName')?.value).toBe('Mi Tienda');
  });

  it('should use default values for individual fields if config exists but fields are missing', () => {
    const mockConfigSignal = signal<StoreConfig | null>({} as StoreConfig);
    const mockStoreNameSignal = signal<string>('Test Store');
    const mockLogoUrlSignal = signal<string>('');
    const mockIsFirstRunSignal = signal<boolean>(true);

    const localSpy = jasmine.createSpyObj('StoreConfigService', ['loadConfig', 'saveConfig']);
    Object.defineProperty(localSpy, 'storeConfig', {
      value: mockConfigSignal.asReadonly(),
    });
    Object.defineProperty(localSpy, 'storeName', {
      value: mockStoreNameSignal.asReadonly(),
    });
    Object.defineProperty(localSpy, 'logoUrl', {
      value: mockLogoUrlSignal.asReadonly(),
    });
    Object.defineProperty(localSpy, 'isFirstRun', {
      value: mockIsFirstRunSignal.asReadonly(),
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StoreConfigComponent, ReactiveFormsModule],
      providers: [
        { provide: StoreConfigService, useValue: localSpy },
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: SweetAlertService, useValue: sweetAlertSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    const localFixture = TestBed.createComponent(StoreConfigComponent);
    const localComp = localFixture.componentInstance;
    localFixture.detectChanges();
    expect(localComp.form.get('setupCompleted')?.value).toBeTrue();
    expect(localComp.form.get('colorPrimary')?.value).toBe('#ea580c');
  });

  it('should handle isOwner being false on initialization', () => {
    const localAuth = jasmine.createSpyObj('AuthService', [], {
      isOwner$: of(false),
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StoreConfigComponent, ReactiveFormsModule],
      providers: [
        { provide: StoreConfigService, useValue: storeConfigServiceSpy },
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: SweetAlertService, useValue: sweetAlertSpy },
        { provide: AuthService, useValue: localAuth },
      ],
    });

    const localFixture = TestBed.createComponent(StoreConfigComponent);
    const localComp = localFixture.componentInstance;
    localFixture.detectChanges();
    expect(localComp.isOwner()).toBeFalse();
  });
});
