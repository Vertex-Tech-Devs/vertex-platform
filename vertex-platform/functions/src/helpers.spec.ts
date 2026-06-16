import { describe, it, expect, vi } from 'vitest';
import { pickBillingAccount, retry } from './helpers';
import type { Firestore } from 'firebase-admin/firestore';

// ─── retry ───────────────────────────────────────────────────────────────────

describe('retry', () => {
  it('returns immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retry(fn, 3, 0);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries on failure and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('success');
    const result = await retry(fn, 3, 0);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws last error when all attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(retry(fn, 3, 0)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ─── pickBillingAccount ───────────────────────────────────────────────────────

function makeDb(
  accounts: Array<{ id: string; maxProjects: number }>,
  storeUsage: Array<{ billingAccountId: string }>,
): Firestore {
  const accountsDocs = accounts.map((a) => ({
    id: a.id,
    data: () => ({ active: true, maxProjects: a.maxProjects }),
  }));
  const storesDocs = storeUsage.map((s, i) => ({
    id: `store-${i}`,
    data: () => ({ billingAccountId: s.billingAccountId }),
  }));

  return {
    collection: vi.fn((name: string) => ({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: name === 'billingAccounts' ? accountsDocs.length === 0 : false,
        docs: name === 'billingAccounts' ? accountsDocs : storesDocs,
      }),
    })),
  } as unknown as Firestore;
}

describe('pickBillingAccount', () => {
  it('throws when no billing accounts exist', async () => {
    const db = makeDb([], []);
    await expect(pickBillingAccount(db)).rejects.toThrow('No active billing accounts');
  });

  it('returns the single account if it has capacity', async () => {
    const db = makeDb([{ id: 'acc-1', maxProjects: 10 }], []);
    const result = await pickBillingAccount(db);
    expect(result).toBe('acc-1');
  });

  it('throws when the only account is at full capacity', async () => {
    const db = makeDb(
      [{ id: 'acc-1', maxProjects: 2 }],
      [{ billingAccountId: 'acc-1' }, { billingAccountId: 'acc-1' }],
    );
    await expect(pickBillingAccount(db)).rejects.toThrow('at capacity');
  });

  it('picks the account with most remaining capacity', async () => {
    const db = makeDb(
      [
        { id: 'acc-1', maxProjects: 10 },
        { id: 'acc-2', maxProjects: 10 },
      ],
      [
        { billingAccountId: 'acc-1' },
        { billingAccountId: 'acc-1' },
        { billingAccountId: 'acc-1' },
        { billingAccountId: 'acc-2' },
      ],
    );
    // acc-1 has 7 remaining, acc-2 has 9 remaining → should pick acc-2
    const result = await pickBillingAccount(db);
    expect(result).toBe('acc-2');
  });

  it('handles account with no usage yet', async () => {
    const db = makeDb(
      [
        { id: 'acc-full', maxProjects: 1 },
        { id: 'acc-empty', maxProjects: 5 },
      ],
      [{ billingAccountId: 'acc-full' }],
    );
    // acc-full: 0 remaining, acc-empty: 5 remaining
    const result = await pickBillingAccount(db);
    expect(result).toBe('acc-empty');
  });
});
