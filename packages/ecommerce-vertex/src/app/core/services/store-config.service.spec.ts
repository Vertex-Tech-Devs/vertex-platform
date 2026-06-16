import { TestBed } from '@angular/core/testing';
import { StoreConfigService } from './store-config.service';
import { Firestore } from '@angular/fire/firestore';
import type { DocumentReference, DocumentSnapshot } from '@angular/fire/firestore';
import type { StoreConfig } from '@core/models/store-config.model';

interface StoreConfigServiceWithPrivates {
  getDocRef: (path: string, ...segments: string[]) => DocumentReference;
  getDocSnap: (ref: DocumentReference) => Promise<DocumentSnapshot>;
  setDocData: (ref: DocumentReference, data: Record<string, unknown>) => Promise<void>;
}

describe('StoreConfigService', () => {
  let service: StoreConfigService;
  let firestoreSpy: jasmine.SpyObj<Firestore>;

  const mockConfig: StoreConfig = {
    tenantId: 'test-tenant',
    storeId: 'white-label-store',
    storeName: 'Test Store Name',
    tagline: 'Test Tagline',
    logoUrl: 'https://logo.url',
    faviconUrl: 'https://favicon.url',
    colors: {
      primary: '#ea580c',
      accent: '#ef4444',
      background: '#ffffff',
    },
    payments: {
      mercadoPagoPublicKey: 'TEST-12345',
    },
    contact: {
      phone: '12345678',
      email: 'test@store.com',
      whatsApp: '123456',
      instagram: 'instagram',
      facebook: 'facebook',
    },
    seo: {
      metaDescription: 'Meta Description Test',
    },
    setupCompleted: true,
  };

  beforeEach(() => {
    firestoreSpy = jasmine.createSpyObj('Firestore', ['type']);

    TestBed.configureTestingModule({
      providers: [StoreConfigService, { provide: Firestore, useValue: firestoreSpy }],
    });
    service = TestBed.inject(StoreConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial fallback values', () => {
    expect(service.storeName()).toBe('Mi Tienda');
    expect(service.logoUrl()).toBe('');
    expect(service.isFirstRun()).toBeTrue();
  });

  it('should cover loadConfig and saveConfig error paths', async () => {
    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocSnap').and.returnValue(Promise.reject(new Error('Firestore error')));
    await service.loadConfig();
    expect(service.storeConfig()).toBeNull();
  });

  it('should load config successfully from configuracion collection', async () => {
    const mockSnap = {
      exists: () => true,
      data: () => mockConfig,
    } as unknown as DocumentSnapshot;

    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'getDocSnap').and.returnValue(Promise.resolve(mockSnap));

    await service.loadConfig();
    expect(service.storeConfig()).toEqual(mockConfig);
    expect(service.storeName()).toBe('Test Store Name');
    expect(service.logoUrl()).toBe('https://logo.url');
    expect(service.isFirstRun()).toBeFalse();
  });

  it("should load config from fallback settings collection when configuracion doesn't exist", async () => {
    let callCount = 0;
    const mockSnapEmpty = {
      exists: () => false,
    } as unknown as DocumentSnapshot;
    const mockSnapFallback = {
      exists: () => true,
      data: () => ({
        storeName: 'Fallback Store',
        tagline: 'Fallback Tag',
        logoUrl: 'https://fallback.logo',
        faviconUrl: 'https://fallback.favicon',
        colors: {
          primary: '#ea580c',
          accent: '#ef4444',
          background: '#ffffff',
        },
        payments: {
          mercadoPago: { publicKey: 'TEST-MP' },
        },
        contact: {
          phone: '987654',
          email: 'fallback@store.com',
          whatsapp: '98765',
        },
        seo: {
          metaDescription: 'Fallback Meta',
        },
      }),
    } as unknown as DocumentSnapshot;

    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'getDocSnap').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(mockSnapEmpty);
      }
      return Promise.resolve(mockSnapFallback);
    });

    await service.loadConfig();
    expect(service.storeConfig()?.storeName).toBe('Fallback Store');
    expect(service.storeConfig()?.payments.mercadoPagoPublicKey).toBe('TEST-MP');
  });

  it('should save config successfully', async () => {
    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'setDocData').and.returnValue(Promise.resolve());

    await service.saveConfig(mockConfig);
    expect(service.storeConfig()).toEqual(mockConfig);
  });

  it('should trigger theme injection effect when config is updated', () => {
    const root = document.documentElement;
    spyOn(root.style, 'setProperty');

    const privateService = service as unknown as {
      _storeConfig: {
        set: (value: StoreConfig) => void;
      };
    };

    privateService._storeConfig.set({
      colors: {
        primary: '#111111',
        accent: '#222222',
        background: '#333333',
      },
    } as unknown as StoreConfig);

    TestBed.flushEffects();

    expect(root.style.setProperty).toHaveBeenCalledWith('--color-primary', '#111111');
    expect(root.style.setProperty).toHaveBeenCalledWith('--color-accent', '#222222');
    expect(root.style.setProperty).toHaveBeenCalledWith('--shop-bg', '#333333');
  });
});
