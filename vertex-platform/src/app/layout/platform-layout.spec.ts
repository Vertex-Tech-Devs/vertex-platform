import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PlatformLayout } from './platform-layout';
import { AuthService } from '@core/services/auth';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('PlatformLayout', () => {
  let fixture: ComponentFixture<PlatformLayout>;
  let component: PlatformLayout;
  let router: Router;

  const mockAuthService = {
    user: signal<{ email: string } | null>({ email: 'admin@vertex.com' }),
    isSuperAdmin: signal(true),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [PlatformLayout],
      providers: [provideRouter([]), { provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PlatformLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create layout component', () => {
    expect(component).toBeTruthy();
  });

  it('computes user initial from email', () => {
    expect(component.userInitial()).toBe('A');

    mockAuthService.user.set(null);
    expect(component.userInitial()).toBe('?');
  });

  it('toggles and closes sidebar', () => {
    expect(component.isSidebarOpen()).toBe(false);

    component.toggleSidebar();
    expect(component.isSidebarOpen()).toBe(true);

    component.closeSidebar();
    expect(component.isSidebarOpen()).toBe(false);
  });

  it('handles logout and navigates to login', async () => {
    await component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('closes sidebar on resize when window is large and keeps open when small', () => {
    component.isSidebarOpen.set(true);
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
    component.onResize();
    expect(component.isSidebarOpen()).toBe(false);

    component.isSidebarOpen.set(true);
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    component.onResize();
    expect(component.isSidebarOpen()).toBe(true);
  });

  it('handles closeSidebar when already closed and empty email in userInitial', () => {
    component.isSidebarOpen.set(false);
    component.closeSidebar();
    expect(component.isSidebarOpen()).toBe(false);

    mockAuthService.user.set({ email: '' });
    expect(component.userInitial()).toBe('?');
  });
});
