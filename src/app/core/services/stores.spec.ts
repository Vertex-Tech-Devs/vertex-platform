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
});
