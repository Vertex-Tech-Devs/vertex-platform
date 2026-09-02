import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { SubscriptionSuccess } from './subscription-success';
import { PublicCheckoutService } from '../../services/public-checkout';

describe('SubscriptionSuccess Component', () => {
  let component: SubscriptionSuccess;
  let fixture: ComponentFixture<SubscriptionSuccess>;
  let checkoutServiceMock: {
    getPublicStoreInfo: ReturnType<typeof vi.fn>;
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
        subscriptionStatus: 'active',
        trialDaysRemaining: 0,
        trialEndDate: null,
        currentPeriodEnd: '2027-09-02T00:00:00.000Z',
        monthlyPrice: 50000,
        annualPrice: 500000,
        baseMonthlyPrice: 50000,
        baseAnnualPrice: 500000,
        discountPercent: null,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [SubscriptionSuccess],
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

    fixture = TestBed.createComponent(SubscriptionSuccess);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the success component', () => {
    expect(component).toBeTruthy();
  });

  it('should load and display store info on success', async () => {
    await component.loadStore('store-123');
    expect(component.storeInfo()?.name).toBe('Tienda Test');
    expect(component.storeInfo()?.status).toBe('active');
  });
});
