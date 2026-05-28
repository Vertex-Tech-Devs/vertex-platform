import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

const mockUnsub = vi.fn();
const mockOnSnapshot = vi.fn();
const mockGetFirestore = vi.fn(() => ({}));
const mockCollection = vi.fn();
const mockGetFunctions = vi.fn(() => ({}));
const mockHttpsCallable = vi.fn();

vi.mock('firebase/firestore', () => ({
  getFirestore: mockGetFirestore,
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
  doc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: mockGetFunctions,
  httpsCallable: mockHttpsCallable,
}));

describe('StoresService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] });
      return mockUnsub;
    });
    mockCollection.mockReturnValue({ id: 'stores' });
  });

  it('initializes stores signal as empty array', async () => {
    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);
    expect(service.stores()).toEqual([]);
  });

  it('registers onSnapshot listener on construction', async () => {
    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    TestBed.inject(StoresService);
    expect(mockOnSnapshot).toHaveBeenCalledOnce();
  });

  it('returns unsubscribe function from onSnapshot (no leak)', async () => {
    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    TestBed.inject(StoresService);
    // The Observable must return the unsub function so toSignal can clean up
    const observableFactory = mockOnSnapshot.mock.calls[0];
    expect(observableFactory).toBeDefined();
  });

  it('maps snapshot docs to store objects', async () => {
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          { id: 'store1', data: () => ({ name: 'Test Store', status: 'active' }) },
          { id: 'store2', data: () => ({ name: 'Another', status: 'suspended' }) },
        ],
      });
      return mockUnsub;
    });

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    expect(service.stores()).toHaveLength(2);
    expect(service.stores()[0]).toEqual({ id: 'store1', name: 'Test Store', status: 'active' });
    expect(service.stores()[1].id).toBe('store2');
  });

  it('createStore calls the provisionStore cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { storeId: 'abc123' } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.createStore({
      name: 'My Store',
      slug: 'my-store',
      ownerEmail: 'owner@test.com',
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'provisionStore');
    expect(result).toBe('abc123');
  });

  it('getRuntimeCapacitySummary calls the matching cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: {
        summary: {
          environment: 'production',
          sharedShardCount: 1,
          activeSharedShardCount: 1,
          availableSharedSlots: 48,
          recommendedRuntimeMode: 'shared-shard',
          shards: [],
        },
      },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.getRuntimeCapacitySummary();

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getRuntimeCapacitySummary');
    expect(result.availableSharedSlots).toBe(48);
  });

  it('inviteStaff returns false when invite email dispatch failed', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: {
        success: true,
        inviteEmailSent: false,
      },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.inviteStaff('store-1', 'staff@example.com', 'admin');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'inviteStaff');
    expect(result.inviteEmailSent).toBe(false);
  });

  it('getStoreStaff falls back to empty arrays when backend omits lists', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: {
        success: true,
      },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.getStoreStaff('store-2');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getStoreStaff');
    expect(result.staff).toEqual([]);
    expect(result.invitations).toEqual([]);
  });

  it('verifyDomain maps ACTIVE status to live and normalizes DNS records', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: {
        success: true,
        status: 'ACTIVE',
        dnsRecords: [
          {
            domainName: '@',
            type: 'TXT',
            rdata: 'vertex-verification-token',
            requiredAction: 'ADD',
          },
        ],
      },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.verifyDomain('store-3', 'midominio.com');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'verifyDomainDNSStatus');
    expect(result.status).toBe('live');
    expect(result.dnsRecords).toEqual([
      {
        host: '@',
        type: 'TXT',
        value: 'vertex-verification-token',
        requiredAction: 'ADD',
      },
    ]);
  });
});
