export type StoreStatus = 'provisioning' | 'active' | 'suspended' | 'error';
export type StepStatus = 'pending' | 'running' | 'done' | 'error';
export type VersionUpdateStatus = 'idle' | 'updating' | 'failed';
export type StoreRuntimeMode = 'shared-shard' | 'dedicated-project';

export interface TemplateVersion {
  version: string;
  tag: string;
  publishedAt: string;
  isLatest: boolean;
  notes?: string;
  /** Esquema de datos que la versión requiere/produce (gate de compatibilidad). */
  schemaVersion?: number;
}

export interface ProvisioningStep {
  status: StepStatus;
  label: string;
  error?: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  tenantId?: string;
  runtimeMode?: StoreRuntimeMode;
  shardId?: string | null;
  runtimeProjectId?: string;
  runtimeSiteId?: string;
  firebaseProjectId: string;
  defaultUrl: string;
  customDomain?: string;
  status: StoreStatus;
  logoUrl?: string | null;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  lastDeployedAt?: Date;
  templateVersion?: string;
  appVersion?: string;
  targetChannel?: string;
  schemaVersion?: number;
  templateCommit?: string;
  versionUpdateStatus?: VersionUpdateStatus;
  versionUpdateTarget?: string;
  versionUpdateProgress?: {
    step?: string;
    pct?: number;
    updatedAt?: string;
  };
  redeployStatus?: 'idle' | 'deploying' | 'failed';
  redeployError?: string | null;
  redeployStartedAt?: Date | string | null;
  pendingMigration?: boolean;
  autoUpdate?: boolean;
  billingAccountId?: string;
  provisioningSteps?: Record<string, ProvisioningStep>;
  verticalId?: string;
  businessVertical?: BusinessVertical;
  provisioningMode?: ProvisioningMode;
}

export type ProvisioningMode = 'EMPTY' | 'CATALOG_ONLY' | 'FULL_DEMO';

export type BusinessVertical =
  | 'INDUMENTARIA_MODA'
  | 'GASTRONOMIA_CAFE'
  | 'TECNOLOGIA'
  | 'HOGAR_DECO';

export interface CreateStorePayload {
  name: string;
  slug: string;
  ownerEmail: string;
  logoUrl?: string | null;
  customDomain?: string;
  verticalId?: string;
  businessVertical?: BusinessVertical;
  provisioningMode?: ProvisioningMode;
  includeMockData?: boolean;
  dedicatedProject?: boolean;
}

export interface StoreShard {
  id: string;
  environment: 'development' | 'production';
  runtimeMode: 'shared-shard';
  projectId: string;
  siteId: string;
  region: string;
  status: 'ACTIVE' | 'FULL' | 'DRAINING' | 'MAINTENANCE' | 'WARMUP_READY' | 'WARMUP_PROVISIONING';
  maxCapacity: number;
  currentStores: number;
  reservedStores: number;
  currentTemplateVersion?: string;
  currentDataVersion?: string;
  createdAt: Date;
  updatedAt: Date;
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
  webhookUrl?: string;
  sandbox?: boolean;
  validationStatus?: 'pending' | 'valid' | 'invalid';
  validationMessage?: string;
  validatedAt?: string;
}

export interface StorePayments {
  mercadoPago: StoreMercadoPagoConfig;
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
  currency: string;
  currencySymbol: string;
  country: string;
}

export interface StaffMember {
  uid: string;
  email: string;
  role: 'owner' | 'admin' | 'warehouse' | 'fulfillment' | 'analyst';
  displayName?: string;
  joinedAt?: string;
  isOwner?: boolean;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}
