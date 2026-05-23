export type StoreStatus = 'provisioning' | 'active' | 'suspended' | 'error';
export type StepStatus = 'pending' | 'running' | 'done' | 'error';
export type VersionUpdateStatus = 'idle' | 'updating' | 'failed';

export interface TemplateVersion {
  version: string;
  tag: string;
  publishedAt: string;
  isLatest: boolean;
  notes?: string;
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
  schemaVersion?: number;
  templateCommit?: string;
  versionUpdateStatus?: VersionUpdateStatus;
  versionUpdateTarget?: string;
  billingAccountId?: string;
  provisioningSteps?: Record<string, ProvisioningStep>;
  verticalId?: string;
}

export interface CreateStorePayload {
  name: string;
  slug: string;
  ownerEmail: string;
  logoUrl?: string | null;
  customDomain?: string;
  verticalId?: string;
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

export interface StoreConfig {
  storeName: string;
  strapline: string;
  logoUrl: string;
  faviconUrl?: string;
  contact: StoreContact;
  seo: StoreSeo;
  features: StoreFeatureFlags;
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
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}

