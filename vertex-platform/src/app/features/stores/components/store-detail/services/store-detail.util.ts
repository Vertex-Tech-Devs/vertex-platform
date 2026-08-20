import type { ProvisioningStep } from '@core/models/store';

export const STEP_ORDER = [
  'createProject', 'linkBilling', 'addFirebase', 'enableApis', 'createWebApp',
  'initFirestore', 'configureEmail', 'initAdmin', 'grantAccess', 'triggerDeploy',
];

export interface ActionProgressState {
  status: 'idle' | 'running' | 'success' | 'error';
  progress: number;
  message: string;
}

export const IDLE_STATE: ActionProgressState = { status: 'idle', progress: 0, message: '' };

export interface DeploymentHistoryItem {
  id?: string;
  timestamp?: { toDate?: () => Date };
  success?: boolean;
  version?: string;
  ref?: string;
  commitSha?: string;
  commitMessage?: string;
}

export function formatDateUtil(dateVal: unknown): Date | string | null {
  if (!dateVal) {
    return null;
  }
  if (typeof dateVal === 'string') {
    const match = dateVal.match(/Timestamp\(seconds=(\d+),\s*nanoseconds=(\d+)\)/);
    if (match) {
      return new Date(parseInt(match[1], 10) * 1000);
    }
  }
  const val = dateVal as Record<string, unknown>;
  if (typeof val['toDate'] === 'function') {
    return (val['toDate'] as () => Date)();
  }
  if (typeof val['seconds'] === 'number') {
    return new Date((val['seconds'] as number) * 1000);
  }
  return dateVal as Date | string | null;
}

export function statusLabelUtil(status: string): string {
  const labels: Record<string, string> = {
    provisioning: 'Aprovisionando',
    active: 'Activa',
    suspended: 'Suspendida',
    error: 'Error',
  };
  return labels[status] ?? status;
}

export function stepIconUtil(status: ProvisioningStep['status']): string {
  return { pending: '○', running: '…', done: '✓', error: '✗' }[status] ?? '○';
}

export function formatDeployHistoryUtil(
  history: DeploymentHistoryItem[],
  storeVer?: string,
): DeploymentHistoryItem[] {
  return history.map((item) => {
    const ver = String(item.version || '');
    if ((!ver || ver === '0.1.0') && storeVer) {
      return { ...item, version: storeVer.replace(/^v/, '') };
    }
    return item;
  });
}
