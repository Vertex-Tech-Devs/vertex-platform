import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_PLANS } from './subscriptions';

describe('Subscriptions SaaS Engine', () => {
  it('should have all 3 plans properly configured with monthly and annual pricing', () => {
    expect(SUBSCRIPTION_PLANS.starter).toBeDefined();
    expect(SUBSCRIPTION_PLANS.starter.monthlyPrice).toBe(15000);
    expect(SUBSCRIPTION_PLANS.starter.annualPrice).toBe(150000);

    expect(SUBSCRIPTION_PLANS.pro).toBeDefined();
    expect(SUBSCRIPTION_PLANS.pro.monthlyPrice).toBe(29000);
    expect(SUBSCRIPTION_PLANS.pro.annualPrice).toBe(290000);

    expect(SUBSCRIPTION_PLANS.enterprise).toBeDefined();
    expect(SUBSCRIPTION_PLANS.enterprise.monthlyPrice).toBe(59000);
    expect(SUBSCRIPTION_PLANS.enterprise.annualPrice).toBe(590000);
  });

  it('annual plan should offer a significant discount compared to 12 months', () => {
    for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
      const full12Months = plan.monthlyPrice * 12;
      expect(plan.annualPrice).toBeLessThan(full12Months);
      // Discount is ~2 months free (approx 15-20%)
      const savings = full12Months - plan.annualPrice;
      expect(savings).toBeGreaterThanOrEqual(plan.monthlyPrice);
    }
  });
});
