import type { StoreConfig } from '../app/core/models/store-config.model';

export const STORE_CONFIG: StoreConfig = {
  tenantId: 'store',
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
