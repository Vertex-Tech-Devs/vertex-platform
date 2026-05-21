export interface ManageAdminPayload {
  email: string;
  action: 'add' | 'remove';
}

export interface AdminInfo {
  uid: string;
  email: string;
  displayName: string | undefined;
  photoURL: string | undefined;
}

export interface CreateStorePayload {
  name: string;
  slug: string;
  ownerEmail: string;
  plan: string;
  logoUrl?: string;
  customDomain?: string;
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
