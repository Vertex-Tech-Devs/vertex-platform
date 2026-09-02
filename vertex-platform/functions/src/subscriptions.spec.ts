import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SUBSCRIPTION_PRICING,
  DAILY_OVERDUE_SURCHARGE_RATE,
  isMasterBillingAdmin,
  getEffectivePricing,
  calculateOverdueDetails,
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
    expect(isMasterBillingAdmin('JUAN.L.ESPECHE@GMAIL.COM')).toBe(true);

    expect(isMasterBillingAdmin('vertex.tech.dev@gmail.com')).toBe(false);
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

  it('validates simulation mode offsets for testing store expiration', () => {
    const now = Date.now();
    // Inminent: 1 hour ahead
    const imminent = new Date(now + 60 * 60 * 1000);
    expect(imminent.getTime()).toBeGreaterThan(now);

    // Grace period: 2 days overdue (within 5 days grace)
    const grace = new Date(now - 2 * 24 * 60 * 60 * 1000);
    expect(now - grace.getTime()).toBeLessThan(5 * 24 * 60 * 60 * 1000);

    // Expired & suspended: 7 days overdue (> 5 days grace)
    const expired = new Date(now - 7 * 24 * 60 * 60 * 1000);
    expect(now - expired.getTime()).toBeGreaterThan(5 * 24 * 60 * 60 * 1000);
  });

  describe('calculateOverdueDetails (2% daily late surcharge)', () => {
    it('should have DAILY_OVERDUE_SURCHARGE_RATE defined at 2% (0.02)', () => {
      expect(DAILY_OVERDUE_SURCHARGE_RATE).toBe(0.02);
    });

    it('returns no surcharge for active or non-overdue subscriptions', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const res = calculateOverdueDetails(
        { status: 'active', currentPeriodEnd: { toDate: () => futureDate } },
        50000,
      );
      expect(res.isOverdue).toBe(false);
      expect(res.overdueDays).toBe(0);
      expect(res.surchargePercent).toBe(0);
      expect(res.surchargeAmount).toBe(0);
      expect(res.totalAmount).toBe(50000);
    });

    it('returns no surcharge if subConfig is empty or status is trial without past_due', () => {
      const res = calculateOverdueDetails({}, 50000);
      expect(res.isOverdue).toBe(false);
      expect(res.totalAmount).toBe(50000);

      const trialRes = calculateOverdueDetails({ status: 'trial' }, 50000);
      expect(trialRes.isOverdue).toBe(false);
    });

    it('calculates 2% surcharge for 1 day overdue in past_due status', () => {
      const now = Date.now();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const res = calculateOverdueDetails(
        { status: 'past_due', currentPeriodEnd: { toDate: () => oneDayAgo } },
        50000,
        now,
      );

      expect(res.isOverdue).toBe(true);
      expect(res.overdueDays).toBe(1);
      expect(res.surchargePercent).toBe(2);
      expect(res.surchargeAmount).toBe(1000); // 50.000 * 2% = 1.000
      expect(res.totalAmount).toBe(51000);
    });

    it('calculates 6% surcharge for 3 days overdue in past_due status', () => {
      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
      const res = calculateOverdueDetails(
        { status: 'past_due', currentPeriodEnd: { toDate: () => threeDaysAgo } },
        500000,
        now,
      );

      expect(res.isOverdue).toBe(true);
      expect(res.overdueDays).toBe(3);
      expect(res.surchargePercent).toBe(6);
      expect(res.surchargeAmount).toBe(30000); // 500.000 * 6% = 30.000
      expect(res.totalAmount).toBe(530000);
    });

    it('caps overdue at 5 days (10% surcharge) when overdue by 7 days or more (suspended status)', () => {
      const now = Date.now();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const res = calculateOverdueDetails(
        { status: 'suspended', currentPeriodEnd: { toDate: () => sevenDaysAgo } },
        50000,
        now,
      );

      expect(res.isOverdue).toBe(true);
      expect(res.overdueDays).toBe(5);
      expect(res.surchargePercent).toBe(10);
      expect(res.surchargeAmount).toBe(5000); // 50.000 * 10% = 5.000
      expect(res.totalAmount).toBe(55000);
    });

    it('handles seconds timestamp objects correctly', () => {
      const nowSec = 1700000000;
      const nowMs = nowSec * 1000;
      const twoDaysAgoSec = nowSec - 2 * 24 * 60 * 60;
      const res = calculateOverdueDetails(
        { status: 'past_due', currentPeriodEnd: { seconds: twoDaysAgoSec } },
        50000,
        nowMs,
      );

      expect(res.isOverdue).toBe(true);
      expect(res.overdueDays).toBe(2);
      expect(res.surchargePercent).toBe(4);
      expect(res.surchargeAmount).toBe(2000);
      expect(res.totalAmount).toBe(52000);
    });
  });
});
