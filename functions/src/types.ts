export interface ManageAdminPayload {
  email: string;
  action: 'add' | 'remove';
  role?: 'superAdmin' | 'platformAdmin';
}

export interface AdminInfo {
  uid: string;
  email: string;
  displayName: string | undefined;
  photoURL: string | undefined;
  role?: 'superAdmin' | 'platformAdmin';
}

export interface CreateStorePayload {
  name: string;
  slug: string;
  ownerEmail: string;
  logoUrl?: string;
  customDomain?: string;
  verticalId?: string;
  includeMockData?: boolean;
  dedicatedProject?: boolean;
}

export type StoreRuntimeMode = 'shared-shard' | 'dedicated-project';

export interface StoreShard {
  id: string;
  environment: 'development' | 'production';
  runtimeMode: 'shared-shard';
  projectId: string;
  siteId: string;
  region: string;
  status: 'active' | 'draining' | 'maintenance';
  maxStores: number;
  activeStores: number;
  reservedStores: number;
  currentTemplateVersion?: string;
  currentDataVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type StepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ProvisioningStep {
  status: StepStatus;
  label: string;
  error?: string;
}

export interface AddBillingAccountPayload {
  id: string;
  name: string;
  maxProjects?: number;
}

export interface UpdateBillingAccountPayload {
  id: string;
  name?: string;
  maxProjects?: number;
  active?: boolean;
}

export interface StoreContact {
  email: string;
  phone: string;
  whatsapp: string;
  address?: string;
  instagram?: string;
  facebook?: string;
}

export interface StoreSeo {
  metaTitle: string;
  metaDescription: string;
}

export interface StoreFeatureFlags {
  reviewsEnabled: boolean;
  wishlistEnabled: boolean;
  blogEnabled: boolean;
}

export interface StoreMercadoPagoConfig {
  publicKey: string;
  accessToken?: string;
  accessTokenSecret?: string;
  accessTokenMasked?: string;
  accountEmail?: string;
  accountUserId?: string;
  webhookUrl: string;
  validationStatus?: 'pending' | 'valid' | 'invalid';
  validationMessage?: string;
  validatedAt?: string;
}

export interface StorePayments {
  mercadoPago: StoreMercadoPagoConfig;
}

export interface StoreTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  fontFamily: 'Inter' | 'Roboto' | 'Outfit' | 'Playfair Display';
}

export interface StoreConfig {
  storeName: string;
  strapline: string;
  logoUrl: string;
  faviconUrl?: string;
  contact: StoreContact;
  seo: StoreSeo;
  features: StoreFeatureFlags;
  payments?: StorePayments;
  theme?: StoreTheme;
  currency: string;
  currencySymbol: string;
  country: string;
}

export interface UpdateStoreConfigPayload {
  storeId: string;
  config: Partial<StoreConfig>;
}

export interface InviteStaffPayload {
  storeId: string;
  email: string;
  role: 'admin' | 'warehouse' | 'fulfillment' | 'analyst';
}

