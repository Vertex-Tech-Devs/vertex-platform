import { vi, describe, it, expect, beforeEach } from 'vitest';

let primarySnapshotCb: any = null;
let primaryErrorCb: any = null;
let fallbackSnapshotCb: any = null;
let fallbackErrorCb: any = null;

const mocks = vi.hoisted(() => ({
  mockGetFunctions: vi.fn(() => ({})),
  mockHttpsCallable: vi.fn(),
  mockGetFirestore: vi.fn(() => ({})),
  mockCollection: vi.fn((_db: unknown, name: string) => ({ name })),
  mockOnSnapshot: vi.fn((ref: { name: string }, onNext: any, onError?: any) => {
    if (ref.name === 'billing_accounts') {
      primarySnapshotCb = onNext;
      primaryErrorCb = onError;
    } else if (ref.name === 'billingAccounts') {
      fallbackSnapshotCb = onNext;
      fallbackErrorCb = onError;
    }
    return vi.fn();
  }),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: mocks.mockGetFunctions,
  httpsCallable: mocks.mockHttpsCallable,
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: mocks.mockGetFirestore,
  collection: mocks.mockCollection,
  onSnapshot: mocks.mockOnSnapshot,
}));

import { BillingAccountsService } from './billing-accounts';

function mockCallable(returns: unknown) {
  const fn = vi.fn().mockResolvedValue({ data: returns });
  mocks.mockHttpsCallable.mockReturnValue(fn);
  return fn;
}

describe('BillingAccountsService', () => {
  let svc: BillingAccountsService;

  beforeEach(() => {
    vi.clearAllMocks();
    primarySnapshotCb = null;
    primaryErrorCb = null;
    fallbackSnapshotCb = null;
    fallbackErrorCb = null;
    svc = new BillingAccountsService();
  });

  it('inicializa listeners de Firestore y procesa snapshot primario no vacío', () => {
    expect(mocks.mockOnSnapshot).toHaveBeenCalled();
    primarySnapshotCb({
      empty: false,
      docs: [
        {
          id: 'acc-primary-1',
          data: () => ({
            accountId: 'acc-primary-1',
            name: 'Primary Account',
            status: 'ACTIVE',
            currentProjects: 2,
            maxProjects: 5,
            createdAt: { toDate: () => new Date('2026-01-01T00:00:00.000Z') },
          }),
        },
      ],
    });

    expect(svc.accounts().length).toBe(1);
    const acc = svc.accounts()[0];
    expect(acc.name).toBe('Primary Account');
    expect(acc.active).toBe(true);
    expect(acc.gcpUsedProjects).toBe(2);
    expect(acc.gcpProjectLimit).toBe(5);
    expect(acc.gcpRemaining).toBe(3);
    expect(svc.isLoading()).toBe(false);
  });

  it('procesa snapshot vacio y utiliza fallback a billingAccounts', () => {
    primarySnapshotCb({ empty: true, docs: [] });
    expect(fallbackSnapshotCb).toBeDefined();

    fallbackSnapshotCb({
      empty: false,
      docs: [
        {
          id: 'acc-fb-1',
          data: () => ({
            name: 'Fallback Account',
            active: false,
            usedProjects: 4,
            maxProjects: 0,
          }),
        },
      ],
    });

    expect(svc.accounts().length).toBe(1);
    const acc = svc.accounts()[0];
    expect(acc.name).toBe('Fallback Account');
    expect(acc.active).toBe(false);
    expect(acc.addedAt).toBeNull();
    expect(acc.gcpUsageRatio).toBe(0);
  });

  it('cubre ramas opcionales en mapDocToBillingAccount', () => {
    primarySnapshotCb({
      empty: false,
      docs: [
        {
          id: 'acc-opt-1',
          data: () => ({
            active: true,
            maxProjects: 10,
            usedProjects: 2,
            addedAt: '2026-03-01T00:00:00.000Z',
          }),
        },
      ],
    });
    const acc = svc.accounts()[0];
    expect(acc.id).toBe('acc-opt-1');
    expect(acc.name).toBe('acc-opt-1');
    expect(acc.addedAt).toBeInstanceOf(Date);
  });

  it('maneja errores en snapshot primario y fallback', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    primaryErrorCb(new Error('primary fail'));
    expect(svc.isLoading()).toBe(false);

    primarySnapshotCb({ empty: true, docs: [] });
    fallbackErrorCb(new Error('fallback fail'));
    expect(svc.isLoading()).toBe(false);
    consoleSpy.mockRestore();
  });

  it('calcula correctamente los signals computados', () => {
    expect(svc.usagePercent()).toBe(0);

    primarySnapshotCb({
      empty: false,
      docs: [
        {
          id: 'a1',
          data: () => ({ name: 'A1', status: 'ACTIVE', currentProjects: 3, maxProjects: 5 }),
        },
        {
          id: 'a2',
          data: () => ({ name: 'A2', status: 'INACTIVE', currentProjects: 1, maxProjects: 5 }),
        },
      ],
    });

    expect(svc.activeAccountsCount()).toBe(1);
    expect(svc.totalGcpLimit()).toBe(10);
    expect(svc.totalGcpUsed()).toBe(4);
    expect(svc.totalGcpRemaining()).toBe(6);
    expect(svc.usagePercent()).toBe(40);
  });

  it('carga cuentas via callable function y muestra toast', async () => {
    mockCallable({
      accounts: [
        {
          id: 'acc-1',
          name: 'Vertex Billing One',
          maxProjects: 15,
          active: true,
          addedAt: '2026-01-01T00:00:00.000Z',
          usedProjects: 2,
          gcpProjectLimit: 5,
          gcpUsedProjects: 3,
          gcpRemaining: 2,
          gcpUsageRatio: 0.6,
        },
      ],
    });
    await svc.loadAccounts();
    const account = svc.accounts()[0];
    expect(account.addedAt).toBeInstanceOf(Date);
    expect(account.gcpProjectLimit).toBe(5);
    expect(account.gcpUsedProjects).toBe(3);
    expect(svc.isLoading()).toBe(false);
    expect(svc.toastMessage()).toContain('sincronizadas correctamente');
  });

  it('showToast temporiza la limpieza del mensaje y respeta cambio de mensaje', () => {
    vi.useFakeTimers();
    svc.showToast('First Toast');
    expect(svc.toastMessage()).toBe('First Toast');
    svc.showToast('Second Toast');
    vi.advanceTimersByTime(3600);
    expect(svc.toastMessage()).toBeNull();
    vi.useRealTimers();
  });

  it('maneja errores en loadAccounts cuando accounts() no está vacío', async () => {
    svc.accounts.set([
      {
        id: 'a1',
        name: 'A1',
        maxProjects: 5,
        active: true,
        addedAt: null,
        usedProjects: 1,
        gcpProjectLimit: 5,
        gcpUsedProjects: 1,
        gcpRemaining: 4,
        gcpUsageRatio: 0.2,
      },
    ]);
    mocks.mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('api fail')));
    await svc.loadAccounts();
    expect(svc.toastMessage()).toBe('Cuentas cargadas desde Firestore.');
  });

  it('setea error cuando falla la carga y accounts() está vacío', async () => {
    svc.accounts.set([]);
    mocks.mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('boom')));
    await svc.loadAccounts();
    expect(svc.error()).toContain('boom');
  });

  it('addAccount envía gcpProjectLimit y recarga', async () => {
    const fn = mockCallable({ accounts: [] });
    await svc.addAccount({ id: 'acc-2', name: 'B', maxProjects: 10, gcpProjectLimit: 8 });
    expect(mocks.mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'addBillingAccount');
    expect(fn).toHaveBeenCalledWith({
      id: 'acc-2',
      name: 'B',
      maxProjects: 10,
      gcpProjectLimit: 8,
    });
  });

  it('updateAccount envía gcpProjectLimit y active', async () => {
    mockCallable({ accounts: [] });
    await svc.updateAccount({ id: 'acc-1', active: false, gcpProjectLimit: 20 });
    const fn = mocks.mockHttpsCallable.mock.results[0].value;
    expect(fn).toHaveBeenCalledWith({ id: 'acc-1', active: false, gcpProjectLimit: 20 });
  });

  it('removeAccount llama con el id', async () => {
    mockCallable({ accounts: [] });
    await svc.removeAccount('acc-1');
    const fn = mocks.mockHttpsCallable.mock.results[0].value;
    expect(fn).toHaveBeenCalledWith({ id: 'acc-1' });
  });
});
