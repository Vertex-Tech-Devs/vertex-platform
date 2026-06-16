export interface BillingAccount {
  id: string;
  name: string;
  maxProjects: number;
  active: boolean;
  addedAt: Date | null;
  usedProjects: number;
}
