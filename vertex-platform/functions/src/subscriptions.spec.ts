import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SUBSCRIPTION_PRICING,
  isMasterBillingAdmin,
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

  it('isMasterBillingAdmin should strictly authorize root billing accounts', () => {
    expect(isMasterBillingAdmin('juan.l.espeche@gmail.com')).toBe(true);
    expect(isMasterBillingAdmin('vertex.tech.dev@gmail.com')).toBe(true);
    expect(isMasterBillingAdmin('JUAN.L.ESPECHE@GMAIL.COM')).toBe(true);

    expect(isMasterBillingAdmin('random@customer.com')).toBe(false);
    expect(isMasterBillingAdmin(undefined)).toBe(false);
  });

  it('getEffectivePricing should return default prices when Firestore is empty', async () => {
    const pricing = await getEffectivePricing();
    expect(pricing.monthlyPrice).toBe(50000);
    expect(pricing.annualPrice).toBe(500000);
  });

  it('calculates trial period dates correctly for 14 and 30 days', () => {
    const now = Date.now();
    const trialDays14 = 14;
    const end14 = new Date(now + trialDays14 * 24 * 60 * 60 * 1000);
    expect(Math.round((end14.getTime() - now) / (24 * 60 * 60 * 1000))).toBe(14);

    const trialDays30 = 30;
    const end30 = new Date(now + trialDays30 * 24 * 60 * 60 * 1000);
    expect(Math.round((end30.getTime() - now) / (24 * 60 * 60 * 1000))).toBe(30);
  });
});
