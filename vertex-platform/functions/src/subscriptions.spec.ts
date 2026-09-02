import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SUBSCRIPTION_PRICING,
  isJuanMasterAdmin,
  getEffectivePricing,
} from './subscriptions';

describe('Single SaaS Subscription Engine & Access Control', () => {
  it('should have correct default pricing: $50.000/mo and $500.000/yr', () => {
    expect(DEFAULT_SUBSCRIPTION_PRICING.monthlyPrice).toBe(50000);
    expect(DEFAULT_SUBSCRIPTION_PRICING.annualPrice).toBe(500000);
  });

  it('annual plan should offer 2 months free ($100.000 discount)', () => {
    const full12Months = DEFAULT_SUBSCRIPTION_PRICING.monthlyPrice * 12; // 600.000
    const annualSavings = full12Months - DEFAULT_SUBSCRIPTION_PRICING.annualPrice; // 100.000
    expect(annualSavings).toBe(100000);
    expect(annualSavings).toBe(DEFAULT_SUBSCRIPTION_PRICING.monthlyPrice * 2);
  });

  it('isJuanMasterAdmin should only authorize Juan emails', () => {
    expect(isJuanMasterAdmin('juan.l.espeche@gmail.com')).toBe(true);
    expect(isJuanMasterAdmin('vertex.tech.dev@gmail.com')).toBe(true);
    expect(isJuanMasterAdmin('JUAN.L.ESPECHE@GMAIL.COM')).toBe(true);

    expect(isJuanMasterAdmin('leivalihue@gmail.com')).toBe(false);
    expect(isJuanMasterAdmin('random@customer.com')).toBe(false);
    expect(isJuanMasterAdmin(undefined)).toBe(false);
  });

  it('getEffectivePricing should return default prices when Firestore is empty', async () => {
    const pricing = await getEffectivePricing();
    expect(pricing.monthlyPrice).toBe(50000);
    expect(pricing.annualPrice).toBe(500000);
  });
});
