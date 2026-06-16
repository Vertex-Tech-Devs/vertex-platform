import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import type { DocumentReference, DocumentSnapshot } from '@angular/fire/firestore';
import type { StoreConfig } from '@core/models/store-config.model';
import { environment } from '../../../environments/environment';
import { z } from 'zod';
import { tenantPath } from '@core/utils/tenant';

export const StoreConfigSchema = z.object({
  tenantId: z.string().default('').catch(''),
  storeId: z.string().default('white-label-store').catch('white-label-store'),
  storeName: z.string().default('Mi Tienda').catch('Mi Tienda'),
  tagline: z.string().default('').catch(''),
  logoUrl: z.string().default('').catch(''),
  faviconUrl: z.string().default('').catch(''),
  colors: z
    .object({
      primary: z.string().default('#ea580c').catch('#ea580c'),
      accent: z.string().default('#ef4444').catch('#ef4444'),
      background: z.string().default('#ffffff').catch('#ffffff'),
    })
    .default({
      primary: '#ea580c',
      accent: '#ef4444',
      background: '#ffffff',
    }),
  payments: z
    .object({
      mercadoPagoPublicKey: z.string().default('').catch(''),
    })
    .default({
      mercadoPagoPublicKey: '',
    }),
  contact: z
    .object({
      phone: z.string().default('').catch(''),
      email: z.string().default('').catch(''),
      whatsApp: z.string().default('').catch(''),
      instagram: z.string().default('').catch(''),
      facebook: z.string().default('').catch(''),
    })
    .default({
      phone: '',
      email: '',
      whatsApp: '',
      instagram: '',
      facebook: '',
    }),
  seo: z
    .object({
      metaDescription: z.string().default('').catch(''),
    })
    .default({
      metaDescription: '',
    }),
  setupCompleted: z.boolean().default(true).catch(true),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  socialInstagramUrl: z.string().optional(),
  socialFacebookUrl: z.string().optional(),
  socialWhatsAppUrl: z.string().optional(),
  copyrightText: z.string().optional(),
});

@Injectable({ providedIn: 'root' })
export class StoreConfigService {
  private firestore = inject(Firestore);
  private titleService = inject(Title);
  private metaService = inject(Meta);

  private readonly _storeConfig = signal<StoreConfig | null>(null);
  readonly storeConfig = this._storeConfig.asReadonly();

  readonly storeName = computed(() => this.storeConfig()?.storeName ?? 'Mi Tienda');
  readonly logoUrl = computed(() => this.storeConfig()?.logoUrl ?? '');
  readonly isFirstRun = computed(() => !this.storeConfig()?.setupCompleted);

  constructor() {
    // Dynamic theme, title and favicon injection reactive effect
    effect(() => {
      const config = this.storeConfig();
      if (config) {
        // 1. Title reactivity
        if (config.storeName) {
          this.titleService.setTitle(config.storeName);
        }

        // 1b. SEO Meta Description reactivity
        if (config.seo?.metaDescription) {
          this.metaService.updateTag({ name: 'description', content: config.seo.metaDescription });
        }

        // 2. Favicon reactivity
        if (config.faviconUrl) {
          const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
          if (link) {
            link.href = config.faviconUrl;
          } else {
            const newLink = document.createElement('link');
            newLink.rel = 'icon';
            newLink.type = 'image/x-icon';
            newLink.href = config.faviconUrl;
            document.head.appendChild(newLink);
          }
        }

        // 3. Colors styling injection
        if (config.colors) {
          const root = document.documentElement;
          if (config.colors.primary) {
            root.style.setProperty('--color-primary', config.colors.primary);
          }
          if (config.colors.accent) {
            root.style.setProperty('--color-accent', config.colors.accent);
          }
          if (config.colors.background) {
            root.style.setProperty('--shop-bg', config.colors.background);
          }
        }
      }
    });
  }

  protected getDocRef(path: string, ...segments: string[]): DocumentReference {
    return doc(this.firestore, path, ...segments);
  }

  protected async getDocSnap(ref: DocumentReference): Promise<DocumentSnapshot> {
    return getDoc(ref);
  }

  protected async setDocData(ref: DocumentReference, data: Record<string, unknown>): Promise<void> {
    return setDoc(ref, data);
  }

  async loadConfig(): Promise<void> {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    try {
      const snap = await Promise.race([
        this.getDocSnap(this.getDocRef(tenantPath('configuracion'), 'store')).catch(() => null),
        timeout,
      ]);
      if (snap?.exists()) {
        const validatedData = StoreConfigSchema.parse(snap.data());
        this._storeConfig.set(validatedData as StoreConfig);
        this.applyConfigToDom(validatedData as StoreConfig);
        return;
      }

      const fallbackSnap = await Promise.race([
        this.getDocSnap(this.getDocRef(tenantPath('settings'), 'storeConfig')).catch(() => null),
        timeout,
      ]);
      if (fallbackSnap?.exists()) {
        const validatedData = StoreConfigSchema.parse(
          this.parseSettingsRaw(fallbackSnap.data() as Record<string, unknown>)
        );
        this._storeConfig.set(validatedData as StoreConfig);
        this.applyConfigToDom(validatedData as StoreConfig);
        return;
      }

      // Legacy flat path: configuracion/{tenantId} (provisioned before tenant namespace)
      const legacySnap = await Promise.race([
        this.getDocSnap(this.getDocRef('configuracion', environment.tenantId)).catch(() => null),
        timeout,
      ]);
      if (legacySnap?.exists()) {
        const validatedData = StoreConfigSchema.parse(
          this.parseLegacyConfigRaw(legacySnap.data() as Record<string, unknown>)
        );
        this._storeConfig.set(validatedData as StoreConfig);
        this.applyConfigToDom(validatedData as StoreConfig);
      } else {
        this._storeConfig.set(null);
      }
    } catch (err) {
      console.error('Error al cargar la configuración de la tienda:', err);
      this._storeConfig.set(null);
    }
  }

  private parseSettingsRaw(raw: Record<string, unknown>): Record<string, unknown> {
    const payments = raw['payments'] as Record<string, unknown> | undefined;
    const mpKey = payments?.['mercadoPago']
      ? ((payments as Record<string, Record<string, string>>)['mercadoPago']['publicKey'] ?? '')
      : '';
    const contact = raw['contact'] as Record<string, string> | undefined;
    return {
      tenantId: environment.tenantId,
      storeId: 'white-label-store',
      storeName: (raw['storeName'] as string) ?? 'Mi Tienda',
      tagline: (raw['tagline'] as string) ?? (raw['strapline'] as string) ?? '',
      logoUrl: (raw['logoUrl'] as string) ?? '',
      faviconUrl: (raw['faviconUrl'] as string) ?? '',
      colors: raw['colors'] ?? { primary: '#ea580c', accent: '#ef4444', background: '#ffffff' },
      payments: { mercadoPagoPublicKey: mpKey },
      contact: {
        phone: contact?.['phone'] ?? '',
        email: contact?.['email'] ?? '',
        whatsApp: contact?.['whatsapp'] ?? '',
        instagram: '',
        facebook: '',
      },
      seo: {
        metaDescription:
          (raw['seo'] as Record<string, string>)?.['metaDescription'] ?? 'Bienvenido',
      },
      setupCompleted: true,
    };
  }

  private parseLegacyConfigRaw(raw: Record<string, unknown>): Record<string, unknown> {
    const payments = raw['payments'] as Record<string, string> | undefined;
    return {
      tenantId: environment.tenantId,
      storeId: (raw['storeId'] as string) ?? 'white-label-store',
      storeName: (raw['storeName'] as string) ?? 'Mi Tienda',
      tagline: (raw['tagline'] as string) ?? '',
      logoUrl: (raw['logoUrl'] as string) ?? '',
      faviconUrl: (raw['faviconUrl'] as string) ?? '',
      colors: (raw['colors'] as Record<string, string>) ?? {
        primary: '#ea580c',
        accent: '#ef4444',
        background: '#ffffff',
      },
      payments: {
        mercadoPagoPublicKey:
          (raw['mercadoPagoPublicKey'] as string) ?? payments?.['mercadoPagoPublicKey'] ?? '',
      },
      contact: {
        phone: (raw['contactPhone'] as string) ?? '',
        email: (raw['contactEmail'] as string) ?? '',
        whatsApp: (raw['socialWhatsAppUrl'] as string) ?? '',
        instagram: (raw['socialInstagramUrl'] as string) ?? '',
        facebook: (raw['socialFacebookUrl'] as string) ?? '',
      },
      seo: { metaDescription: (raw['metaDescription'] as string) ?? '' },
      setupCompleted: (raw['setupCompleted'] as boolean) ?? true,
    };
  }

  async saveConfig(data: StoreConfig): Promise<void> {
    const docRef = this.getDocRef(tenantPath('configuracion'), 'store');
    await this.setDocData(docRef, {
      ...(data as unknown as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    });
    this._storeConfig.set(data);
  }

  private applyConfigToDom(config: StoreConfig): void {
    if (config.storeName) {
      this.titleService.setTitle(config.storeName);
    }
    if (config.seo?.metaDescription) {
      this.metaService.updateTag({ name: 'description', content: config.seo.metaDescription });
    }
    if (config.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/x-icon';
        document.head.appendChild(link);
      }
      link.href = config.faviconUrl;
    }
    if (config.colors) {
      const root = document.documentElement;
      if (config.colors.primary) {
        root.style.setProperty('--color-primary', config.colors.primary);
      }
      if (config.colors.accent) {
        root.style.setProperty('--color-accent', config.colors.accent);
      }
      if (config.colors.background) {
        root.style.setProperty('--shop-bg', config.colors.background);
      }
    }
  }
}
