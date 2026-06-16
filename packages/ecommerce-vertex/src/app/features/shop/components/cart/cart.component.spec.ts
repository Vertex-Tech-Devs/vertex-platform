import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { CartComponent } from './cart.component';
import { CartService } from '@core/services/cart.service';
import type { Cart, CartItem } from '@core/models/cart.model';

const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: 'var-1',
  productId: 'prod-1',
  variantId: 'var-1',
  name: 'Test Product (Color: Red)',
  price: 100,
  quantity: 2,
  image: 'https://example.com/img.jpg',
  attributes: { color: 'Red' },
  stock: 10,
  ...overrides,
});

describe('CartComponent', () => {
  let component: CartComponent;
  let fixture: ComponentFixture<CartComponent>;
  let cartServiceSpy: jasmine.SpyObj<CartService>;
  let router: Router;

  let cartSignal: ReturnType<typeof signal<Cart>>;

  beforeEach(async () => {
    cartSignal = signal<Cart>({ items: [], total: 0 });

    cartServiceSpy = jasmine.createSpyObj('CartService', ['updateQuantity', 'removeItem'], {
      cart: cartSignal,
    });

    await TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [provideRouter([]), { provide: CartService, useValue: cartServiceSpy }],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    fixture = TestBed.createComponent(CartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reflect an empty cart initially', () => {
    expect(component.cart().items).toEqual([]);
    expect(component.cart().total).toBe(0);
  });

  it('should render cart items from the signal', () => {
    cartSignal.set({ items: [makeCartItem()], total: 200 });
    fixture.detectChanges();

    expect(component.cart().items.length).toBe(1);
    expect(component.cart().items[0].name).toBe('Test Product (Color: Red)');
  });

  it('goToCheckout() should navigate to /shop/checkout', () => {
    component.goToCheckout();
    expect(router.navigate).toHaveBeenCalledWith(['/shop/checkout']);
  });

  it('onRemoveItem() should call cartService.removeItem with the correct id', () => {
    component.onRemoveItem('var-1');
    expect(cartServiceSpy.removeItem).toHaveBeenCalledWith('var-1');
  });

  it('onUpdateQuantity() should call cartService.updateQuantity with parsed value', () => {
    const item = makeCartItem();
    const fakeEvent = { target: { value: '5' } } as unknown as Event;

    component.onUpdateQuantity(item, fakeEvent);

    expect(cartServiceSpy.updateQuantity).toHaveBeenCalledWith('var-1', 5);
  });

  it('onUpdateQuantity() should default to 1 for non-numeric input', () => {
    const item = makeCartItem();
    const fakeEvent = { target: { value: 'abc' } } as unknown as Event;

    component.onUpdateQuantity(item, fakeEvent);

    expect(cartServiceSpy.updateQuantity).toHaveBeenCalledWith('var-1', 1);
  });

  it('onUpdateQuantity() should cap at item.stock and update input value', () => {
    const item = makeCartItem({ stock: 3 });
    const inputEl = { value: '10' };
    const fakeEvent = { target: inputEl } as unknown as Event;

    component.onUpdateQuantity(item, fakeEvent);

    expect(cartServiceSpy.updateQuantity).toHaveBeenCalledWith('var-1', 3);
    expect(inputEl.value).toBe('3');
  });

  it('onUpdateQuantity() should enforce minimum of 1', () => {
    const item = makeCartItem();
    const inputEl = { value: '0' };
    const fakeEvent = { target: inputEl } as unknown as Event;

    component.onUpdateQuantity(item, fakeEvent);

    expect(cartServiceSpy.updateQuantity).toHaveBeenCalledWith('var-1', 1);
    expect(inputEl.value).toBe('1');
  });
});
