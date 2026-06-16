import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { AuthService as AuthServiceType } from './auth';

const {
  mockUnsubscribe,
  mockOnAuthStateChanged,
  mockSignOut,
  mockGetIdTokenResult,
  mockSignInWithPopup,
} = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
  mockOnAuthStateChanged: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockGetIdTokenResult: vi.fn(),
  mockSignInWithPopup: vi.fn(),
}));

let capturedAuthCallback: ((user: unknown) => Promise<void>) | null = null;

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  onAuthStateChanged: mockOnAuthStateChanged,
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: mockSignInWithPopup,
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

  it('loginWithGoogle signs in with popup when platformAdmin claim is present', async () => {
    const mockUser = { uid: 'abc', email: 'admin@test.com' };
    mockSignInWithPopup.mockResolvedValue({ user: mockUser });
    mockGetIdTokenResult.mockResolvedValue({ claims: { platformAdmin: true, superAdmin: true } });
    await service.loginWithGoogle();
    expect(mockSignInWithPopup).toHaveBeenCalled();
    expect(service.authError()).toBeNull();
    expect(service.isSuperAdmin()).toBe(true);
  });

  it('loginWithGoogle signs out and sets unauthorized when claim is absent', async () => {
    const mockUser = { uid: 'abc', email: 'noadmin@test.com' };
    mockSignInWithPopup.mockResolvedValue({ user: mockUser });
    mockGetIdTokenResult.mockResolvedValue({ claims: {} });
    await service.loginWithGoogle();
    expect(mockSignOut).toHaveBeenCalled();
    expect(service.authError()).toBe('unauthorized');
  });

  it('loginWithGoogle sets popup-blocked error when popup is blocked', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    await service.loginWithGoogle();
    expect(service.authError()).toBe('popup-blocked');
  });

  it('loginWithGoogle sets unknown error on unexpected exception', async () => {
    mockSignInWithPopup.mockRejectedValue(new Error('unexpected'));
    await service.loginWithGoogle();
    expect(service.authError()).toBe('unknown');
  });
});
