import { TestBed } from '@angular/core/testing';
import { StoreConfigService } from './store-config.service';
import { Firestore } from '@angular/fire/firestore';
import type { DocumentReference, DocumentSnapshot } from '@angular/fire/firestore';
import type { StoreConfig } from '@vertex/contracts';

interface StoreConfigServiceWithPrivates {
  getDocRef: (path: string, ...segments: string[]) => DocumentReference;
  getDocSnap: (ref: DocumentReference) => Promise<DocumentSnapshot>;
  setDocData: (ref: DocumentReference, data: Record<string, unknown>) => Promise<void>;
}

describe('StoreConfigService', () => {
  let service: StoreConfigService;
  let firestoreSpy: jasmine.SpyObj<Firestore>;

  const mockConfig: StoreConfig = {
    setupCompleted: true,
    storeName: 'Test Store Name',
    tagline: 'Test Tagline',
    logoUrl: 'https://logo.url',
    faviconUrl: 'https://favicon.url',
    colorPrimary: '#ea580c',
    colorAccent: '#ef4444',
    colorBackground: '#1a1a2e',
    mercadoPagoPublicKey: 'TEST-12345',
    contactPhone: '12345678',
    contactEmail: 'test@store.com',
    whatsappNumber: '123456',
    instagramUrl: 'instagram',
    facebookUrl: 'facebook',
    metaDescription: 'Meta Description Test',
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
    expect(service.storeName()).toBe('Mi Tienda Online');
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

  it('should migrate config from legacy settings and footer successfully', async () => {
    const mockSettingsSnap = {
      exists: () => true,
      data: () => ({
        storeName: 'Migrated Store',
        tagline: 'Legacy tagline',
        logoUrl: 'https://migrated.logo',
        colors: { primary: '#ea580c', accent: '#ef4444', background: '#1a1a2e' },
        payments: { mercadoPago: { publicKey: 'MP-KEY' } },
        seo: { metaDescription: 'Migrated SEO' },
      }),
    } as unknown as DocumentSnapshot;

    const mockFooterSnap = {
      exists: () => true,
      data: () => ({
        phone: '987654321',
        email: 'migrated@store.com',
        socials: { whatsApp: 'wa', instagram: 'ig', facebook: 'fb' },
      }),
    } as unknown as DocumentSnapshot;

    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'setDocData').and.returnValue(Promise.resolve());

    let callCount = 0;
    spyOn(privSvc, 'getDocSnap').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      } // configuracion/store
      if (callCount === 2) {
        return Promise.resolve(mockSettingsSnap);
      } // settings/storeConfig
      if (callCount === 3) {
        return Promise.resolve(mockFooterSnap);
      } // configuracion/footer
      return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
    });

    await service.loadConfig();
    expect(service.storeConfig()?.storeName).toBe('Migrated Store');
    expect(service.storeConfig()?.contactEmail).toBe('migrated@store.com');
  });

  it('should migrate config from legacy tenant path successfully', async () => {
    const mockLegacySnap = {
      exists: () => true,
      data: () => ({
        setupCompleted: true,
        storeName: 'Tenant Legacy Store',
        tagline: 'Tenant tagline',
        logoUrl: 'https://tenant.logo',
        colors: { primary: '#ea580c', accent: '#ef4444', background: '#1a1a2e' },
        payments: { mercadoPagoPublicKey: 'MP-KEY' },
        contact: {
          phone: '112233',
          email: 'legacy@store.com',
          whatsApp: 'whatsapp-url',
          instagram: 'ig-url',
          facebook: 'fb-url',
        },
        seo: { metaDescription: 'Legacy SEO description' },
      }),
    } as unknown as DocumentSnapshot;

    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'setDocData').and.returnValue(Promise.resolve());

    let callCount = 0;
    spyOn(privSvc, 'getDocSnap').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      } // configuracion/store
      if (callCount === 2) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      } // settings/storeConfig
      if (callCount === 3) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      } // configuracion/footer
      if (callCount === 4) {
        return Promise.resolve(mockLegacySnap);
      } // configuracion/{tenantId}
      return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
    });

    await service.loadConfig();
    expect(service.storeConfig()?.storeName).toBe('Tenant Legacy Store');
    expect(service.storeConfig()?.contactEmail).toBe('legacy@store.com');
  });

  it('should migrate from legacy settings and footer with missing/partial data using defaults', async () => {
    const mockSettingsSnap = {
      exists: () => true,
      data: () => ({
        // storeName is missing, tagline and logo are missing
        colors: {},
        payments: {},
        seo: {},
      }),
    } as unknown as DocumentSnapshot;

    const mockFooterSnap = {
      exists: () => true,
      data: () => ({
        // phone and email missing
        socials: {},
      }),
    } as unknown as DocumentSnapshot;

    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'setDocData').and.returnValue(Promise.resolve());

    let callCount = 0;
    spyOn(privSvc, 'getDocSnap').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      } // unified config
      if (callCount === 2) {
        return Promise.resolve(mockSettingsSnap);
      } // settings
      if (callCount === 3) {
        return Promise.resolve(mockFooterSnap);
      } // footer
      return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
    });

    await service.loadConfig();
    const config = service.storeConfig();
    expect(config?.storeName).toBe('Mi Tienda Online');
    expect(config?.colorPrimary).toBe('#ea580c');
    expect(config?.contactEmail).toBe('contacto@mitiendaonline.com');
  });

  it('should migrate from legacy settings and footer when snapshots are empty or null', async () => {
    const mockSettingsSnap = {
      exists: () => true,
      data: () => null,
    } as unknown as DocumentSnapshot;

    const mockFooterSnap = {
      exists: () => true,
      data: () => null,
    } as unknown as DocumentSnapshot;

    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'setDocData').and.returnValue(Promise.resolve());

    let callCount = 0;
    spyOn(privSvc, 'getDocSnap').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      if (callCount === 2) {
        return Promise.resolve(mockSettingsSnap);
      }
      if (callCount === 3) {
        return Promise.resolve(mockFooterSnap);
      }
      return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
    });

    await service.loadConfig();
    const config = service.storeConfig();
    expect(config?.storeName).toBe('Mi Tienda Online');
  });

  it('should migrate from legacy tenant snapshot with empty data using defaults', async () => {
    const mockLegacySnap = {
      exists: () => true,
      data: () => ({}),
    } as unknown as DocumentSnapshot;

    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'setDocData').and.returnValue(Promise.resolve());

    let callCount = 0;
    spyOn(privSvc, 'getDocSnap').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      if (callCount === 2) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      if (callCount === 3) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      if (callCount === 4) {
        return Promise.resolve(mockLegacySnap);
      }
      return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
    });

    await service.loadConfig();
    const config = service.storeConfig();
    expect(config?.storeName).toBe('Mi Tienda Online');
    expect(config?.colorPrimary).toBe('#ea580c');
    expect(config?.contactEmail).toBe('contacto@mitiendaonline.com');
  });

  it('should migrate from legacy tenant snapshot with fallback variables set', async () => {
    const mockLegacySnap = {
      exists: () => true,
      data: () => ({
        setupCompleted: false,
        colors: { primary: '#111111', accent: '#222222', background: '#333333' },
        payments: { mercadoPagoPublicKey: 'PM-KEY' },
        contact: {
          phone: '9999',
          email: 'c@c.com',
          whatsApp: 'wa',
          instagram: 'ig',
          facebook: 'fb',
        },
        seo: { metaDescription: 'desc' },
      }),
    } as unknown as DocumentSnapshot;

    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'setDocData').and.returnValue(Promise.resolve());

    let callCount = 0;
    spyOn(privSvc, 'getDocSnap').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      if (callCount === 2) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      if (callCount === 3) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      if (callCount === 4) {
        return Promise.resolve(mockLegacySnap);
      }
      return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
    });

    await service.loadConfig();
    const config = service.storeConfig();
    expect(config?.colorPrimary).toBe('#111111');
    expect(config?.contactEmail).toBe('c@c.com');
    expect(config?.whatsappNumber).toBe('wa');
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
      colorPrimary: '#111111',
      colorAccent: '#222222',
      colorBackground: '#333333',
    } as unknown as StoreConfig);

    TestBed.flushEffects();

    expect(root.style.setProperty).toHaveBeenCalledWith('--color-primary', '#111111');
    expect(root.style.setProperty).toHaveBeenCalledWith('--color-accent', '#222222');
    expect(root.style.setProperty).toHaveBeenCalledWith('--color-background', '#333333');
  });

  it('should reuse existing favicon link tag in Dom', () => {
    const existingLink = document.createElement('link');
    existingLink.rel = 'icon';
    existingLink.href = 'original.ico';
    document.head.appendChild(existingLink);

    const privateService = service as unknown as {
      _storeConfig: {
        set: (value: StoreConfig) => void;
      };
    };

    privateService._storeConfig.set({
      colorPrimary: '#111111',
      colorAccent: '#222222',
      colorBackground: '#333333',
      faviconUrl: 'new.ico',
    } as unknown as StoreConfig);

    TestBed.flushEffects();

    const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    expect(link).toBeTruthy();
    expect(link?.href).toContain('new.ico');

    if (existingLink.parentNode) {
      existingLink.parentNode.removeChild(existingLink);
    }
  });

  it('should continue loadConfig if partial snapshots reject', async () => {
    const privSvc = service as unknown as StoreConfigServiceWithPrivates;
    spyOn(privSvc, 'getDocRef').and.returnValue({} as unknown as DocumentReference);
    spyOn(privSvc, 'setDocData').and.returnValue(Promise.resolve());

    let callCount = 0;
    spyOn(privSvc, 'getDocSnap').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      if (callCount === 2) {
        return Promise.reject(new Error('Settings snap error'));
      }
      if (callCount === 3) {
        return Promise.reject(new Error('Footer snap error'));
      }
      if (callCount === 4) {
        return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
      }
      return Promise.resolve({ exists: () => false } as unknown as DocumentSnapshot);
    });

    await service.loadConfig();
    expect(service.storeConfig()).toBeNull();
  });
});
