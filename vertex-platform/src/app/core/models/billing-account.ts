export interface BillingAccount {
  id: string;
  name: string;
  maxProjects: number;
  active: boolean;
  addedAt: Date | null;
  usedProjects: number;
  /** Límite REAL de GCP: proyectos vinculables a esta billing account (default 5). */
  gcpProjectLimit: number;
  /** Proyectos realmente vinculados en GCP (fuente de verdad). */
  gcpUsedProjects: number;
  gcpRemaining: number;
  gcpUsageRatio: number;
}
