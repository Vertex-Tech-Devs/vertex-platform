import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type {
  PublicStoreSubscriptionInfo,
  SubscriptionCheckoutResult,
} from '../models/public-subscription';

@Injectable({
  providedIn: 'root',
})
export class PublicCheckoutService {
  private functions = getFunctions();

  async getPublicStoreInfo(storeIdOrSlug: string): Promise<PublicStoreSubscriptionInfo> {
    const fn = httpsCallable<{ storeIdOrSlug: string }, PublicStoreSubscriptionInfo>(
      this.functions,
      'getPublicStoreSubscriptionInfo',
    );
    const result = await fn({ storeIdOrSlug });
    return result.data;
  }

  async createCheckoutLink(params: {
    storeId: string;
    billingCycle: 'monthly' | 'annual';
    payerEmail?: string;
  }): Promise<SubscriptionCheckoutResult> {
    const fn = httpsCallable<
      { storeId: string; billingCycle: 'monthly' | 'annual'; payerEmail?: string },
      SubscriptionCheckoutResult
    >(this.functions, 'createStoreSubscriptionLink');
    const result = await fn(params);
    return result.data;
  }
}
