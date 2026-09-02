export interface PublicStoreSubscriptionInfo {
  storeId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  defaultUrl: string;
  ownerEmail: string | null;
  status: 'active' | 'suspended' | 'provisioning' | 'error';
  subscriptionStatus: 'trial' | 'complimentary' | 'active' | 'past_due' | 'suspended';
  trialDaysRemaining: number;
  trialEndDate: string | null;
  currentPeriodEnd: string | null;
  monthlyPrice: number;
  annualPrice: number;
  baseMonthlyPrice: number;
  baseAnnualPrice: number;
  discountPercent: number | null;
  isOverdue?: boolean;
  overdueDays?: number;
  overdueSurchargePercent?: number;
  overdueMonthlySurchargeAmount?: number;
  overdueAnnualSurchargeAmount?: number;
}

export interface SubscriptionCheckoutResult {
  success: boolean;
  checkoutUrl: string;
  preferenceId?: string;
  preapprovalId?: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
}
