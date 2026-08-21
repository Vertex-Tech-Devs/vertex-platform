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

export function parseDateToMillis(dateVal: unknown): number {
  if (!dateVal) {
    return 0;
  }
  if (typeof dateVal === 'number') {
    return dateVal;
  }
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? 0 : dateVal.getTime();
  }
  if (typeof dateVal === 'string') {
    const matchTs = dateVal.match(/Timestamp\(seconds=(\d+),\s*nanoseconds=(\d+)\)/);
    if (matchTs) {
      return parseInt(matchTs[1], 10) * 1000;
    }
    const matchDmy = dateVal.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
    );
    if (matchDmy) {
      const day = parseInt(matchDmy[1], 10);
      const month = parseInt(matchDmy[2], 10) - 1;
      const year = parseInt(matchDmy[3], 10);
      const hour = matchDmy[4] ? parseInt(matchDmy[4], 10) : 0;
      const min = matchDmy[5] ? parseInt(matchDmy[5], 10) : 0;
      const sec = matchDmy[6] ? parseInt(matchDmy[6], 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.getTime();
    }
  }
  if (typeof dateVal === 'object') {
    const val = dateVal as Record<string, unknown>;
    if (typeof val['toDate'] === 'function') {
      const d = (val['toDate'] as () => Date)();
      return d && !isNaN(d.getTime()) ? d.getTime() : 0;
    }
    if (typeof val['seconds'] === 'number') {
      return (val['seconds'] as number) * 1000;
    }
    if (typeof val['_seconds'] === 'number') {
      return (val['_seconds'] as number) * 1000;
    }
  }
  return 0;
}

export function formatDateUtil(dateVal: unknown): Date | string | null {
  if (!dateVal) {
    return null;
  }
  const millis = parseDateToMillis(dateVal);
  return millis > 0 ? new Date(millis) : (dateVal as Date | string | null);
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
