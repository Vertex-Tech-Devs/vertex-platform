import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { HeaderComponent } from './header.component';
import { CartService } from '@core/services/cart.service';
import { StoreConfigService } from '@core/services/store-config.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  const mockCartService = { itemCount: signal(0) };
  const mockStoreConfigService = {
    storeName: signal('Mi Tienda'),
    logoUrl: signal(''),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: CartService, useValue: mockCartService },
        { provide: StoreConfigService, useValue: mockStoreConfigService },
      ],
    }).compileComponents();

    mockCartService.itemCount.set(0);
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have menu closed', () => {
      expect(component.isMenuOpen()).toBeFalse();
    });

    it('should not be in scrolled state', () => {
      expect(component.isScrolled()).toBeFalse();
    });

    it('should reflect cart count from service', () => {
      expect(component.cartItemCount()).toBe(0);
    });
  });

  describe('menu toggle', () => {
    it('toggleMenu() should open the menu', () => {
      component.toggleMenu();
      expect(component.isMenuOpen()).toBeTrue();
    });

    it('toggleMenu() called twice should close the menu', () => {
      component.toggleMenu();
      component.toggleMenu();
      expect(component.isMenuOpen()).toBeFalse();
    });

    it('closeMenu() should close the menu', () => {
      component.toggleMenu();
      component.closeMenu();
      expect(component.isMenuOpen()).toBeFalse();
    });
  });

  describe('scroll detection', () => {
    it('should set isScrolled when scroll offset > 20', () => {
      spyOnProperty(window, 'pageYOffset', 'get').and.returnValue(30);
      component.onWindowScroll();
      expect(component.isScrolled()).toBeTrue();
    });

    it('should clear isScrolled when scroll offset <= 20', () => {
      const spy = spyOnProperty(window, 'pageYOffset', 'get').and.returnValue(30);
      component.onWindowScroll();
      spy.and.returnValue(10);
      component.onWindowScroll();
      expect(component.isScrolled()).toBeFalse();
    });

    it('should use documentElement.scrollTop when pageYOffset is 0', () => {
      spyOnProperty(window, 'pageYOffset', 'get').and.returnValue(0);
      spyOnProperty(document.documentElement, 'scrollTop', 'get').and.returnValue(50);
      component.onWindowScroll();
      expect(component.isScrolled()).toBeTrue();
    });

    it('should remain not scrolled when both pageYOffset and scrollTop are 0', () => {
      spyOnProperty(window, 'pageYOffset', 'get').and.returnValue(0);
      spyOnProperty(document.documentElement, 'scrollTop', 'get').and.returnValue(0);
      component.onWindowScroll();
      expect(component.isScrolled()).toBeFalse();
    });
  });

  describe('template', () => {
    it('should not show cart badge when count is 0', () => {
      fixture.detectChanges();
      const badge = fixture.debugElement.query(By.css('.header__cart-badge'));
      expect(badge).toBeNull();
    });

    it('should show cart badge when count > 0', () => {
      mockCartService.itemCount.set(3);
      fixture.detectChanges();
      const badge = fixture.debugElement.query(By.css('.header__cart-badge'));
      expect(badge).not.toBeNull();
      expect(badge.nativeElement.textContent.trim()).toBe('3');
    });

    it('should apply header--scrolled class when scrolled', () => {
      component.isScrolled.set(true);
      fixture.detectChanges();
      const header = fixture.debugElement.query(By.css('.header'));
      expect(header.classes['header--scrolled']).toBeTrue();
    });

    it('should apply header__nav--open class when menu is open', () => {
      component.toggleMenu();
      fixture.detectChanges();
      const nav = fixture.debugElement.query(By.css('.header__nav'));
      expect(nav.classes['header__nav--open']).toBeTrue();
    });
  });
});
