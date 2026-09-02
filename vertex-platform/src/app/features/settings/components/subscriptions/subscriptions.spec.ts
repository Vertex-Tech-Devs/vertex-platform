import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subscriptions } from './subscriptions';
import { StoresService } from '@core/services/stores';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Subscriptions Component', () => {
  let component: Subscriptions;
  let fixture: ComponentFixture<Subscriptions>;

  const mockStoresService = {
    stores: signal([
      { id: '1', name: 'Tienda 1', subscription: { status: 'active' as const } },
      { id: '2', name: 'Tienda 2', subscription: { status: 'trial' as const } },
      { id: '3', name: 'Tienda 3', subscription: { status: 'complimentary' as const } },
      { id: '4', name: 'Tienda 4', subscription: { status: 'past_due' as const } },
      { id: '5', name: 'Tienda 5', subscription: { status: 'suspended' as const } },
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
