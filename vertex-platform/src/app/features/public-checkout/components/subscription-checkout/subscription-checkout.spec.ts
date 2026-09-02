import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { SubscriptionCheckout } from './subscription-checkout';
import { PublicCheckoutService } from '../../services/public-checkout';

describe('SubscriptionCheckout Component', () => {
  let component: SubscriptionCheckout;
  let fixture: ComponentFixture<SubscriptionCheckout>;
  let checkoutServiceMock: {
    getPublicStoreInfo: ReturnType<typeof vi.fn>;
    createCheckoutLink: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    checkoutServiceMock = {
      getPublicStoreInfo: vi.fn().mockResolvedValue({
        storeId: 'store-123',
        name: 'Tienda Test',
        slug: 'tienda-test',
        logoUrl: null,
        defaultUrl: 'https://tienda-test.web.app',
        ownerEmail: 'cliente@test.com',
        status: 'active',
        subscriptionStatus: 'trial',
        trialDaysRemaining: 12,
        trialEndDate: '2026-09-14T00:00:00.000Z',
        currentPeriodEnd: '2026-09-14T00:00:00.000Z',
        monthlyPrice: 50000,
        annualPrice: 500000,
        baseMonthlyPrice: 50000,
        baseAnnualPrice: 500000,
        discountPercent: null,
      }),
      createCheckoutLink: vi.fn().mockResolvedValue({
        success: true,
        checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123',
        billingCycle: 'annual',
        amount: 500000,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [SubscriptionCheckout],
      providers: [
        provideRouter([]),
        { provide: PublicCheckoutService, useValue: checkoutServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'store-123' : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionCheckout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the checkout component', () => {
    expect(component).toBeTruthy();
  });

  it('should load store data and default to annual billing cycle', async () => {
    await component.loadStore('store-123');
    expect(component.storeInfo()?.name).toBe('Tienda Test');
    expect(component.billingCycle()).toBe('annual');
    expect(component.effectivePrice()).toBe(500000);
    expect(component.savingsAmount()).toBe(100000);
  });

  it('switching billing cycle should update effective price', async () => {
    await component.loadStore('store-123');
    component.selectCycle('monthly');
    expect(component.billingCycle()).toBe('monthly');
    expect(component.effectivePrice()).toBe(50000);
  });

  it('handles loadStore error gracefully', async () => {
    checkoutServiceMock.getPublicStoreInfo.mockRejectedValueOnce(new Error('Store not found'));
    await component.loadStore('unknown');
    expect(component.errorMessage()).toBe('Store not found');
  });

  it('proceedToPayment calls createCheckoutLink with correct params', async () => {
    await component.loadStore('store-123');
    component.payerEmail.set('custom@test.com');
    await component.proceedToPayment();
    expect(checkoutServiceMock.createCheckoutLink).toHaveBeenCalledWith({
      storeId: 'store-123',
      billingCycle: 'annual',
      payerEmail: 'custom@test.com',
    });
  });

  it('handles payment error gracefully', async () => {
    await component.loadStore('store-123');
    checkoutServiceMock.createCheckoutLink.mockRejectedValueOnce(
      new Error('Payment gateway error'),
    );
    await component.proceedToPayment();
    expect(component.paymentError()).toBe('Payment gateway error');
  });

  it('handles non-Error thrown in loadStore', async () => {
    checkoutServiceMock.getPublicStoreInfo.mockRejectedValueOnce('string error');
    await component.loadStore('unknown');
    expect(component.errorMessage()).toBe(
      'No se pudo encontrar la tienda o el enlace no es válido.',
    );
  });

  it('handles missing checkoutUrl, non-Error payment failure, and null storeInfo calculations', async () => {
    await component.loadStore('store-123');
    checkoutServiceMock.createCheckoutLink.mockResolvedValueOnce({
      success: false,
      checkoutUrl: '',
    });
    await component.proceedToPayment();
    expect(component.paymentError()).toBe('No se pudo generar el enlace de pago de Mercado Pago.');

    checkoutServiceMock.createCheckoutLink.mockRejectedValueOnce('network error');
    await component.proceedToPayment();
    expect(component.paymentError()).toBe(
      'Ocurrió un error al conectar con Mercado Pago. Intente nuevamente.',
    );

    component.storeInfo.set(null);
    expect(component.effectivePrice()).toBe(0);
    expect(component.savingsAmount()).toBe(0);
  });
});
