import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firebase mocks (must come before importing the module under test) ─────────

const {
  mockSetCustomUserClaims,
  mockGetUserByEmail,
  mockDocGet,
  mockCollectionDoc,
  capturedCallableRef,
} = vi.hoisted(() => {
  const mockSetCustomUserClaims = vi.fn();
  const mockGetUserByEmail = vi.fn();
  const mockDocGet = vi.fn();
  const mockCollectionDoc = vi.fn(() => ({ get: mockDocGet }));
  const capturedCallableRef: { current: ((request: any) => Promise<any>) | null } = {
    current: null,
  };
  return { mockSetCustomUserClaims, mockGetUserByEmail, mockDocGet, mockCollectionDoc, capturedCallableRef };
});

vi.mock('firebase-admin', () => ({
  auth: () => ({
    setCustomUserClaims: mockSetCustomUserClaims,
    getUserByEmail: mockGetUserByEmail,
  }),
  firestore: Object.assign(
    () => ({
      collection: vi.fn(() => ({ doc: mockCollectionDoc })),
    }),
    { FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') } },
  ),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({ doc: mockCollectionDoc })),
  })),
}));

vi.mock('firebase-functions/v1', () => ({
  auth: { user: () => ({ onCreate: vi.fn((fn) => fn) }) },
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: vi.fn((_path: any, handler: any) => handler),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((optsOrHandler: any, handler?: any) => {
    const fn = typeof optsOrHandler === 'function' ? optsOrHandler : handler;
    capturedCallableRef.current = fn;
    return fn;
  }),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import './role.functions';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('refreshMyAdminClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectionDoc.mockImplementation(() => ({ get: mockDocGet }));
  });

  const callable = () => capturedCallableRef.current!;

  it('throws unauthenticated if no auth context', async () => {
    expect(callable()).toBeTruthy();
    await expect(callable()({ auth: null })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('throws invalid-argument if user has no email', async () => {
    await expect(
      callable()({ auth: { uid: 'uid-1', token: {} } }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('grants admin claim when email exists in admin_roles with admin role', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'admin' }),
    });
    mockSetCustomUserClaims.mockResolvedValueOnce(undefined);

    const result = await callable()({
      auth: { uid: 'uid-1', token: { email: 'admin@example.com' } },
    });

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-1', { admin: true, role: 'admin', tenantId: 'store' });
    expect(result).toEqual({ granted: true });
  });

  it('returns granted:false when email is not in admin_roles', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

    const result = await callable()({
      auth: { uid: 'uid-2', token: { email: 'stranger@example.com' } },
    });

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(result).toEqual({ granted: false });
  });

  it('returns granted:false when role is not admin', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'editor' }),
    });

    const result = await callable()({
      auth: { uid: 'uid-3', token: { email: 'editor@example.com' } },
    });

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(result).toEqual({ granted: false });
  });

  it('trims and lowercases the email before lookup', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

    await callable()({
      auth: { uid: 'uid-4', token: { email: '  ADMIN@Example.COM  ' } },
    });

    expect(mockCollectionDoc).toHaveBeenCalledWith('store_admin@example.com');
  });
});
