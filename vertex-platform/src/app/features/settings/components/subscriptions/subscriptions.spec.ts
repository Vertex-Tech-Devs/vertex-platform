import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subscriptions } from './subscriptions';
import { StoresService } from '@core/services/stores';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Store } from '@core/models/store';

describe('Subscriptions Component', () => {
  let component: Subscriptions;
  let fixture: ComponentFixture<Subscriptions>;

  const mockStore1: Store = {
    id: 'store-1',
    name: 'Tienda Alpha',
    slug: 'alpha',
    ownerEmail: 'alpha@test.com',
    status: 'active',
    subscription: { status: 'active' },
  } as unknown as Store;

  const mockStore2: Store = {
    id: 'store-2',
    name: 'Tienda Beta',
    slug: 'beta',
    ownerEmail: 'beta@test.com',
    status: 'active',
    subscription: { status: 'trial' },
  } as unknown as Store;

  const mockStoresService = {
    stores: signal([
      mockStore1,
      mockStore2,
      { id: '3', name: 'Tienda 3', slug: 't3', ownerEmail: 't3@test.com', status: 'active', subscription: { status: 'complimentary' as const } } as unknown as Store,
      { id: '4', name: 'Tienda 4', slug: 't4', ownerEmail: 't4@test.com', status: 'suspended', subscription: { status: 'past_due' as const } } as unknown as Store,
      { id: '5', name: 'Tienda 5', slug: 't5', ownerEmail: 't5@test.com', status: 'suspended', subscription: { status: 'suspended' as const } } as unknown as Store,
    ]),
    getPlatformBillingConfig: vi.fn().mockResolvedValue({
      pricing: {
        monthlyPrice: 50000,
        annualPrice: 500000,
      },
      isMasterAdmin: true,
      platformMercadoPago: {
        maskedToken: 'APP_USR-****',
      },
    }),
    updatePlatformBillingConfig: vi.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [Subscriptions],
      providers: [
        provideRouter([]),
        { provide: StoresService, useValue: mockStoresService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Subscriptions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the subscriptions component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute breakdown of store subscriptions correctly', () => {
    expect(component.activeSubscriptionsCount()).toBe(1);
    expect(component.trialSubscriptionsCount()).toBe(1);
    expect(component.complimentaryCount()).toBe(1);
    expect(component.pastDueCount()).toBe(2);

    mockStoresService.stores.set([]);
    expect(component.activeSubscriptionsCount()).toBe(0);
    expect(component.trialSubscriptionsCount()).toBe(0);
    expect(component.complimentaryCount()).toBe(0);
    expect(component.pastDueCount()).toBe(0);
  });

  it('should filter stores based on search query', () => {
    mockStoresService.stores.set([mockStore1, mockStore2]);
    component.storeSearchQuery.set('alpha');
    expect(component.filteredStores().length).toBe(1);
    expect(component.filteredStores()[0].id).toBe('store-1');

    component.storeSearchQuery.set('non-existent');
    expect(component.filteredStores().length).toBe(0);

    component.storeSearchQuery.set('');
    expect(component.filteredStores().length).toBe(2);
  });

  it('should generate public checkout URL and WhatsApp share link', () => {
    const url = component.getPublicCheckoutUrl('store-1');
    expect(url).toContain('/pay/store-1');

    const waLink = component.getWhatsAppShareUrl(mockStore1);
    expect(waLink).toContain('https://wa.me/?text=');
    expect(waLink).toContain(encodeURIComponent('Tienda Alpha'));
  });

  it('should copy store payment link to clipboard', () => {
    component.copyStorePaymentLink('store-1');
    expect(component.copiedStoreId()).toBe('store-1');
  });

  it('should toggle master configuration drawer', () => {
    expect(component.showMasterConfig()).toBe(false);
    component.toggleMasterConfig();
    expect(component.showMasterConfig()).toBe(true);
    component.toggleMasterConfig();
    expect(component.showMasterConfig()).toBe(false);
  });

  it('should load platform billing config on init and handle config without pricing', async () => {
    mockStoresService.getPlatformBillingConfig.mockResolvedValueOnce({
      isMasterAdmin: false,
      platformMercadoPago: null,
    });
    await component.loadPlatformBillingConfig();
    expect(component.platformBillingConfig()?.isMasterAdmin).toBe(false);
  });

  it('should handle load error gracefully', async () => {
    mockStoresService.getPlatformBillingConfig.mockRejectedValueOnce(new Error('Network error'));
    await component.loadPlatformBillingConfig();
    expect(component.pricingSaveError()).toBe('Network error');
  });

  it('should save platform pricing with updated values', async () => {
    component.editMonthlyPrice.set(60000);
    component.editAnnualPrice.set(600000);
    component.editMpAccessToken.set('APP_USR-NEW-TOKEN');

    await component.savePlatformPricing();

    expect(mockStoresService.updatePlatformBillingConfig).toHaveBeenCalledWith({
      monthlyPrice: 60000,
      annualPrice: 600000,
      mpAccessToken: 'APP_USR-NEW-TOKEN',
    });
    expect(component.pricingSaveSuccess()).toContain('actualizadas con éxito');
  });

  it('should save platform pricing without token if empty', async () => {
    component.editMonthlyPrice.set(50000);
    component.editAnnualPrice.set(500000);
    component.editMpAccessToken.set('   ');

    await component.savePlatformPricing();

    expect(mockStoresService.updatePlatformBillingConfig).toHaveBeenCalledWith({
      monthlyPrice: 50000,
      annualPrice: 500000,
      mpAccessToken: undefined,
    });
  });

  it('should handle save error gracefully', async () => {
    mockStoresService.updatePlatformBillingConfig.mockRejectedValueOnce(new Error('Unauthorized'));
    await component.savePlatformPricing();
    expect(component.pricingSaveError()).toBe('Unauthorized');
  });
});
