export type StoreStatus = 'provisioning' | 'active' | 'suspended' | 'error';
export type StorePlan = 'starter' | 'professional' | 'enterprise';
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
  plan: StorePlan;
  logoUrl?: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  lastDeployedAt?: Date;
  templateVersion?: string;
  templateCommit?: string;
  provisioningSteps?: Record<string, ProvisioningStep>;
}

export interface CreateStorePayload {
  name: string;
  slug: string;
  ownerEmail: string;
  plan: StorePlan;
  logoUrl?: string;
  customDomain?: string;
}
