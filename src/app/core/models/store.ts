export type StoreStatus = 'provisioning' | 'active' | 'suspended' | 'error';
export type StepStatus = 'pending' | 'running' | 'done' | 'error';

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
  logoUrl?: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  lastDeployedAt?: Date;
  templateVersion?: string;
  templateCommit?: string;
  billingAccountId?: string;
  provisioningSteps?: Record<string, ProvisioningStep>;
  verticalId?: string;
}

export interface CreateStorePayload {
  name: string;
  slug: string;
  ownerEmail: string;
  logoUrl?: string;
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
  theme?: StoreTheme;
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

