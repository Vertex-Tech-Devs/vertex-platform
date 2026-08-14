import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetFunctions: vi.fn(() => ({})),
  mockHttpsCallable: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: mocks.mockGetFunctions,
  httpsCallable: mocks.mockHttpsCallable,
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
    svc = new BillingAccountsService();
  });

  it('carga cuentas y mapea addedAt + campos GCP', async () => {
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
  });

  it('setea error cuando falla la carga', async () => {
    mocks.mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('boom')));
    await svc.loadAccounts();
    expect(svc.error()).toContain('boom');
    expect(svc.accounts().length).toBe(0);
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
