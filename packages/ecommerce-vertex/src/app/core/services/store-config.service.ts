import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import type { DocumentReference, DocumentSnapshot } from '@angular/fire/firestore';
import { StoreConfigSchema } from '@vertex/contracts';
import type { StoreConfig } from '@vertex/contracts';
import { environment } from '../../../environments/environment';
import { tenantPath } from '@core/utils/tenant';

@Injectable({ providedIn: 'root' })
export class StoreConfigService {
  private firestore = inject(Firestore);
  private titleService = inject(Title);
  private metaService = inject(Meta);

  private readonly _storeConfig = signal<StoreConfig | null>(null);
  readonly storeConfig = this._storeConfig.asReadonly();

  readonly storeName = computed(() => this.storeConfig()?.storeName ?? 'Mi Tienda Online');
  readonly logoUrl = computed(() => this.storeConfig()?.logoUrl ?? '');
  readonly isFirstRun = computed(() => !this.storeConfig()?.setupCompleted);

  constructor() {
    effect(() => {
      const config = this.storeConfig();
      if (config) {
        this.applyConfigToDom(config);
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
      // 1. Intentar cargar configuracion/store unificado
      const snap = await Promise.race([
        this.getDocSnap(this.getDocRef(tenantPath('configuracion'), 'store')).catch(() => null),
        timeout,
      ]);

      if (snap?.exists()) {
        const validatedData = StoreConfigSchema.parse(snap.data());
        this._storeConfig.set(validatedData);
        return;
      }

      // 2. Rutina de migración transparente de configuracion/footer y configuracion/settings
      const settingsSnap = await Promise.race([
        this.getDocSnap(this.getDocRef(tenantPath('settings'), 'storeConfig')).catch(() => null),
        timeout,
      ]);
      const footerSnap = await Promise.race([
        this.getDocSnap(this.getDocRef(tenantPath('configuracion'), 'footer')).catch(() => null),
        timeout,
      ]);

      if (settingsSnap?.exists() || footerSnap?.exists()) {
        const validated = await this.migrateFromLegacySettings(settingsSnap, footerSnap);
        if (validated) {
          this._storeConfig.set(validated);
          return;
        }
      }

      // 3. Intento de legado por ruta plana del inquilino (configuracion/{tenantId})
      const legacySnap = await Promise.race([
        this.getDocSnap(this.getDocRef('configuracion', environment.tenantId)).catch(() => null),
        timeout,
      ]);

      if (legacySnap?.exists()) {
        const validated = await this.migrateFromTenantLegacy(legacySnap);
        if (validated) {
          this._storeConfig.set(validated);
          return;
        }
      }

      this._storeConfig.set(null);
    } catch (err) {
      console.error('Error al cargar la configuración de la tienda:', err);
      this._storeConfig.set(null);
    }
  }

  private async migrateFromLegacySettings(
    settingsSnap: DocumentSnapshot | null,
    footerSnap: DocumentSnapshot | null
  ): Promise<StoreConfig | null> {
    const settingsData = settingsSnap?.exists() ? settingsSnap.data() : {};
    const footerData = footerSnap?.exists() ? footerSnap.data() : {};

    const migrated = this.mapLegacySettings(settingsData, footerData);
    const validated = StoreConfigSchema.parse(migrated);
    await this.saveConfig(validated);
    return validated;
  }

  private mapLegacySettings(
    settingsData: Record<string, unknown> | null | undefined,
    footerData: Record<string, unknown> | null | undefined
  ): StoreConfig {
    return {
      setupCompleted: true,
      storeName: (settingsData?.['storeName'] as string) ?? 'Mi Tienda Online',
      tagline: (settingsData?.['tagline'] as string) ?? '',
      logoUrl: (settingsData?.['logoUrl'] as string) ?? '',
      faviconUrl: (settingsData?.['faviconUrl'] as string) ?? '',
      ...this.mapColorsAndBranding(settingsData),
      ...this.mapContactAndSeo(settingsData, footerData),
    };
  }

  private mapColorsAndBranding(
    settingsData: Record<string, unknown> | null | undefined
  ): Pick<
    StoreConfig,
    'colorPrimary' | 'colorAccent' | 'colorBackground' | 'mercadoPagoPublicKey'
  > {
    const colors = settingsData?.['colors'] as Record<string, string> | undefined;
    return {
      colorPrimary: colors?.['primary'] ?? '#ea580c',
      colorAccent: colors?.['accent'] ?? '#ef4444',
      colorBackground: colors?.['background'] ?? '#1a1a2e',
      mercadoPagoPublicKey:
        (settingsData?.['payments'] as Record<string, Record<string, string>> | undefined)?.[
          'mercadoPago'
        ]?.['publicKey'] ?? '',
    };
  }

  private mapContactAndSeo(
    settingsData: Record<string, unknown> | null | undefined,
    footerData: Record<string, unknown> | null | undefined
  ): Pick<
    StoreConfig,
    | 'contactPhone'
    | 'contactEmail'
    | 'whatsappNumber'
    | 'instagramUrl'
    | 'facebookUrl'
    | 'metaDescription'
  > {
    const contact = settingsData?.['contact'] as Record<string, string> | undefined;
    const seo = settingsData?.['seo'] as Record<string, string> | undefined;
    return {
      contactPhone: (footerData?.['phone'] as string) ?? contact?.['phone'] ?? '',
      contactEmail:
        (footerData?.['email'] as string) ?? contact?.['email'] ?? 'contacto@mitiendaonline.com',
      whatsappNumber:
        (footerData?.['socials'] as Record<string, string> | undefined)?.['whatsApp'] ??
        contact?.['whatsapp'] ??
        '',
      instagramUrl:
        (footerData?.['socials'] as Record<string, string> | undefined)?.['instagram'] ?? '',
      facebookUrl:
        (footerData?.['socials'] as Record<string, string> | undefined)?.['facebook'] ?? '',
      metaDescription: seo?.['metaDescription'] ?? '',
    };
  }

  private async migrateFromTenantLegacy(
    legacySnap: DocumentSnapshot | null
  ): Promise<StoreConfig | null> {
    const raw = legacySnap?.data() as Record<string, unknown>;
    const colors = raw['colors'] as Record<string, string> | undefined;
    const payments = raw['payments'] as Record<string, string> | undefined;
    const contact = raw['contact'] as Record<string, string> | undefined;
    const seo = raw['seo'] as Record<string, string> | undefined;

    const migrated: StoreConfig = {
      setupCompleted: (raw['setupCompleted'] as boolean) ?? true,
      storeName: (raw['storeName'] as string) ?? 'Mi Tienda Online',
      tagline: (raw['tagline'] as string) ?? '',
      logoUrl: (raw['logoUrl'] as string) ?? '',
      faviconUrl: (raw['faviconUrl'] as string) ?? '',
      colorPrimary: colors?.['primary'] ?? '#ea580c',
      colorAccent: colors?.['accent'] ?? '#ef4444',
      colorBackground: colors?.['background'] ?? '#1a1a2e',
      mercadoPagoPublicKey:
        (raw['mercadoPagoPublicKey'] as string) ?? payments?.['mercadoPagoPublicKey'] ?? '',
      contactPhone: (raw['contactPhone'] as string) ?? contact?.['phone'] ?? '',
      contactEmail:
        (raw['contactEmail'] as string) ?? contact?.['email'] ?? 'contacto@mitiendaonline.com',
      whatsappNumber: (raw['socialWhatsAppUrl'] as string) ?? contact?.['whatsApp'] ?? '',
      instagramUrl: (raw['socialInstagramUrl'] as string) ?? contact?.['instagram'] ?? '',
      facebookUrl: (raw['socialFacebookUrl'] as string) ?? contact?.['facebook'] ?? '',
      metaDescription: (raw['metaDescription'] as string) ?? seo?.['metaDescription'] ?? '',
    };

    const validated = StoreConfigSchema.parse(migrated);
    await this.saveConfig(validated);
    return validated;
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
    if (config.metaDescription) {
      this.metaService.updateTag({ name: 'description', content: config.metaDescription });
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
    const root = document.documentElement;
    root.style.setProperty('--color-primary', config.colorPrimary);
    root.style.setProperty('--color-accent', config.colorAccent);
    root.style.setProperty('--color-background', config.colorBackground);
  }
}
