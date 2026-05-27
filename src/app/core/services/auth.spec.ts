import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { AuthService as AuthServiceType } from './auth';

const {
  mockUnsubscribe,
  mockOnAuthStateChanged,
  mockSignOut,
  mockGetIdTokenResult,
  mockSignInWithRedirect,
  mockGetRedirectResult,
} = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
  mockOnAuthStateChanged: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockGetIdTokenResult: vi.fn(),
  mockSignInWithRedirect: vi.fn(),
  mockGetRedirectResult: vi.fn().mockResolvedValue(null),
}));

let capturedAuthCallback: ((user: unknown) => Promise<void>) | null = null;

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  onAuthStateChanged: mockOnAuthStateChanged,
  GoogleAuthProvider: vi.fn(),
  signInWithRedirect: mockSignInWithRedirect,
  getRedirectResult: mockGetRedirectResult,
  signOut: mockSignOut,
  getIdTokenResult: mockGetIdTokenResult,
}));

import { AuthService } from './auth';

describe('AuthService', () => {
  let service: AuthServiceType;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedAuthCallback = null;

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      capturedAuthCallback = cb as (user: unknown) => Promise<void>;
      return mockUnsubscribe;
    });
    mockSignOut.mockResolvedValue(undefined);

    TestBed.configureTestingModule({ providers: [AuthService] });
    service = TestBed.inject(AuthService);
  });

  it('starts with loading state while auth resolves', () => {
    expect(service.user()).toBeUndefined();
    expect(service.isLoading()).toBe(true);
    expect(service.isLoggedIn()).toBe(false);
  });

  it('sets user to null when signed out', async () => {
    await capturedAuthCallback?.(null);
    expect(service.user()).toBeNull();
    expect(service.isLoading()).toBe(false);
    expect(service.isLoggedIn()).toBe(false);
  });

  it('sets user when platformAdmin claim is present', async () => {
    const mockUser = { uid: 'abc', email: 'admin@test.com' };
    mockGetIdTokenResult.mockResolvedValue({ claims: { platformAdmin: true } });
    await capturedAuthCallback?.(mockUser);
    expect(service.user()).toBe(mockUser);
    expect(service.authError()).toBeNull();
  });

  it('signs out and sets unauthorized when non-admin authenticates', async () => {
    const mockUser = { uid: 'xyz', email: 'nonadmin@test.com' };
    mockGetIdTokenResult.mockResolvedValue({ claims: {} });
    await capturedAuthCallback?.(mockUser);
    expect(mockSignOut).toHaveBeenCalled();
    expect(service.authError()).toBe('unauthorized');
  });

  it('loginWithGoogle starts redirect flow', async () => {
    mockSignInWithRedirect.mockResolvedValue(undefined);
    await service.loginWithGoogle();
    expect(mockSignInWithRedirect).toHaveBeenCalled();
    expect(service.authError()).toBeNull();
  });

  it('loginWithGoogle sets unknown error on redirect exception', async () => {
    mockSignInWithRedirect.mockRejectedValue(new Error('redirect-failed'));
    await service.loginWithGoogle();
    expect(service.authError()).toBe('unknown');
  });

  it('sets unknown error when getRedirectResult rejects', async () => {
    mockGetRedirectResult.mockRejectedValue({ code: 'auth/invalid-credential' });
    TestBed.resetTestingModule();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      capturedAuthCallback = cb as (user: unknown) => Promise<void>;
      return mockUnsubscribe;
    });
    TestBed.configureTestingModule({ providers: [AuthService] });
    const svc = TestBed.inject(AuthService);
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.authError()).toBe('unknown');
    expect(svc.authErrorCode()).toBe('auth/invalid-credential');
  });
});
