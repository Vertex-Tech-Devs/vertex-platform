import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

const mocks = vi.hoisted(() => ({
  mockGetFunctions: vi.fn(() => ({})),
  mockHttpsCallable: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: mocks.mockGetFunctions,
  httpsCallable: mocks.mockHttpsCallable,
}));

import { PublicCheckoutService } from './public-checkout';

describe('PublicCheckoutService', () => {
  let service: PublicCheckoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [PublicCheckoutService],
    });
    service = TestBed.inject(PublicCheckoutService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call getPublicStoreSubscriptionInfo on getPublicStoreInfo', async () => {
    const mockCallable = vi.fn().mockResolvedValue({
      data: {
        storeId: 'store-1',
        name: 'Tienda Mock',
        slug: 'tienda-mock',
        monthlyPrice: 50000,
        annualPrice: 500000,
      },
    });
    mocks.mockHttpsCallable.mockReturnValue(mockCallable);

    const result = await service.getPublicStoreInfo('tienda-mock');
    expect(mocks.mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getPublicStoreSubscriptionInfo');
    expect(mockCallable).toHaveBeenCalledWith({ storeIdOrSlug: 'tienda-mock' });
    expect(result.name).toBe('Tienda Mock');
  });

  it('should call createStoreSubscriptionLink on createCheckoutLink', async () => {
    const mockCallable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        checkoutUrl: 'https://mp.com/checkout',
        billingCycle: 'annual',
        amount: 500000,
      },
    });
    mocks.mockHttpsCallable.mockReturnValue(mockCallable);

    const result = await service.createCheckoutLink({
      storeId: 'store-1',
      billingCycle: 'annual',
      payerEmail: 'test@example.com',
    });

    expect(mocks.mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'createStoreSubscriptionLink');
    expect(mockCallable).toHaveBeenCalledWith({
      storeId: 'store-1',
      billingCycle: 'annual',
      payerEmail: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });
});
