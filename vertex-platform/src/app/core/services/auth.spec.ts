import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AuthService, AUTH_FIREBASE_DEPS, AuthFirebaseDeps } from './auth';

describe('AuthService', () => {
  let service: AuthService;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockOnAuthStateChanged: ReturnType<typeof vi.fn>;
  let mockSignOut: ReturnType<typeof vi.fn>;
  let mockGetIdTokenResult: ReturnType<typeof vi.fn>;
  let mockSignInWithPopup: ReturnType<typeof vi.fn>;
  let mockGetFunctions: ReturnType<typeof vi.fn>;
  let mockHttpsCallable: ReturnType<typeof vi.fn>;
  let mockGetAuth: ReturnType<typeof vi.fn>;
  let capturedAuthCallback: ((user: unknown) => Promise<void>) | null = null;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockOnAuthStateChanged = vi.fn((_auth: unknown, cb: (user: unknown) => void) => {
      capturedAuthCallback = cb as (user: unknown) => Promise<void>;
      return mockUnsubscribe;
    });
    mockSignOut = vi.fn().mockResolvedValue(undefined);
    mockGetIdTokenResult = vi.fn();
    mockSignInWithPopup = vi.fn();
    mockGetFunctions = vi.fn(() => ({}));
    mockHttpsCallable = vi.fn(() => vi.fn().mockResolvedValue({ data: {} }));
    mockGetAuth = vi.fn(() => ({ currentUser: null }));
    capturedAuthCallback = null;

    const mockDeps: AuthFirebaseDeps = {
      getAuth: mockGetAuth as unknown as AuthFirebaseDeps['getAuth'],
      onAuthStateChanged: mockOnAuthStateChanged as unknown as AuthFirebaseDeps['onAuthStateChanged'],
      signInWithPopup: mockSignInWithPopup as unknown as AuthFirebaseDeps['signInWithPopup'],
      signOut: mockSignOut as unknown as AuthFirebaseDeps['signOut'],
      getIdTokenResult: mockGetIdTokenResult as unknown as AuthFirebaseDeps['getIdTokenResult'],
      getFunctions: mockGetFunctions as unknown as AuthFirebaseDeps['getFunctions'],
      httpsCallable: mockHttpsCallable as unknown as AuthFirebaseDeps['httpsCallable'],
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_FIREBASE_DEPS, useValue: mockDeps },
      ],
    });

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

  it('logout resetea el estado y desloguea', async () => {
    await service.logout();
    expect(mockSignOut).toHaveBeenCalled();
    expect(service.isSuperAdmin()).toBe(false);
  });

  it('intenta refrescar el claim platformAdmin en onAuthStateChanged cuando falta', async () => {
    const mockUser = { uid: 'abc', email: 'admin@test.com' };
    mockGetIdTokenResult
      .mockResolvedValueOnce({ claims: {} }) // primero sin claim
      .mockResolvedValueOnce({ claims: { platformAdmin: true } }); // despues de refrescar

    await capturedAuthCallback?.(mockUser);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'refreshMyPlatformAdminClaim');
    expect(service.user()).toBe(mockUser);
  });

  it('maneja excepcion en refreshMyPlatformAdminClaim durante onAuthStateChanged', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const mockUser = { uid: 'abc', email: 'admin@test.com' };
    mockGetIdTokenResult.mockResolvedValue({ claims: {} });
    mockHttpsCallable.mockImplementationOnce(() => vi.fn().mockRejectedValue(new Error('claim fail')));

    await capturedAuthCallback?.(mockUser);
    expect(mockSignOut).toHaveBeenCalled();
    expect(service.authError()).toBe('unauthorized');
    consoleSpy.mockRestore();
  });

  it('loginWithGoogle intenta refrescar el claim platformAdmin cuando falta', async () => {
    const mockUser = { uid: 'abc', email: 'admin@test.com' };
    mockSignInWithPopup.mockResolvedValue({ user: mockUser });
    mockGetIdTokenResult
      .mockResolvedValueOnce({ claims: {} })
      .mockResolvedValueOnce({ claims: { platformAdmin: true, superAdmin: false } });

    await service.loginWithGoogle();
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'refreshMyPlatformAdminClaim');
    expect(service.user()).toBe(mockUser);
  });

  it('loginWithGoogle captura error al refrescar claim', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const mockUser = { uid: 'abc', email: 'admin@test.com' };
    mockSignInWithPopup.mockResolvedValue({ user: mockUser });
    mockGetIdTokenResult.mockResolvedValue({ claims: {} });
    mockHttpsCallable.mockImplementationOnce(() => vi.fn().mockRejectedValue(new Error('refresh err')));

    await service.loginWithGoogle();
    expect(mockSignOut).toHaveBeenCalled();
    expect(service.authError()).toBe('unauthorized');
    consoleSpy.mockRestore();
  });

  it('loginWithGoogle soporta auth/popup-closed-by-user', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    await service.loginWithGoogle();
    expect(service.authError()).toBe('popup-blocked');
    consoleSpy.mockRestore();
  });
});
