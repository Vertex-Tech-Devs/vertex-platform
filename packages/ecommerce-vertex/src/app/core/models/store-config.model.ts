export interface StoreConfig {
  readonly tenantId: string;
  storeId: string;
  storeName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  colors: {
    primary: string;
    accent: string;
    background: string;
  };
  payments: {
    mercadoPagoPublicKey: string;
  };
  contact: {
    phone: string;
    email: string;
    whatsApp: string;
    instagram: string;
    facebook: string;
  };
  seo: {
    metaDescription: string;
  };
  setupCompleted: boolean;

  // Legacy compatibility fields
  contactPhone?: string;
  contactEmail?: string;
  socialInstagramUrl?: string;
  socialFacebookUrl?: string;
  socialWhatsAppUrl?: string;
  copyrightText?: string;
}

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  tenantId: 'white-label-store',
  storeId: 'white-label-store',
  storeName: 'Mi Tienda Online',
  tagline: 'Tu tienda de moda de marca blanca',
  logoUrl: '',
  faviconUrl: '',
  colors: {
    primary: '#ea580c',
    accent: '#ef4444',
    background: '#ffffff',
  },
  payments: {
    mercadoPagoPublicKey: '',
  },
  contact: {
    phone: '',
    email: '',
    whatsApp: '',
    instagram: '',
    facebook: '',
  },
  seo: {
    metaDescription: 'Bienvenido a nuestra tienda online.',
  },
  setupCompleted: false,
};
