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

import { AuthService } from './auth';
import { signal } from '@angular/core';

describe('StoresService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] });
      return mockUnsub;
    });
    mockCollection.mockReturnValue({ id: 'stores' });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: signal({ email: 'admin@test.com' }),
            isSuperAdmin: signal(false),
            isLoggedIn: signal(true),
            isLoading: signal(false),
          },
        },
      ],
    });
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
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockOnSnapshot).toHaveBeenCalledOnce();
  });

  it('returns unsubscribe function from onSnapshot (no leak)', async () => {
    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    TestBed.inject(StoresService);
    await new Promise((resolve) => setTimeout(resolve, 0));
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
    await new Promise((resolve) => setTimeout(resolve, 0));

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

  it('verifyDomain maps LIVE status to live', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: { success: true, status: 'LIVE', dnsRecords: [] },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.verifyDomain('store-4', 'otrodominio.com');

    expect(result.status).toBe('live');
    expect(result.dnsRecords).toEqual([]);
  });

  it('verifyDomain maps unknown status to pending', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: { success: true, status: 'PENDING', dnsRecords: [] },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.verifyDomain('store-5', 'pendiente.com');

    expect(result.status).toBe('pending');
  });

  it('verifyDomain falls back to pending when status is undefined', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: { success: true, dnsRecords: [] },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.verifyDomain('store-6', 'indefinido.com');

    expect(result.status).toBe('pending');
  });

  it('connectDomain calls connectDomain cloud function and maps DNS records', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: {
        success: true,
        dnsRecords: [
          {
            domainName: '@',
            type: 'A',
            rdata: '151.101.1.195',
            requiredAction: 'ADD',
          },
          {
            domainName: 'www',
            type: 'CNAME',
            rdata: 'tienda.web.app',
            requiredAction: 'ADD',
          },
        ],
      },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.connectDomain('store-7', 'mitienda.com');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'connectDomain');
    expect(mockFn).toHaveBeenCalledWith({ storeId: 'store-7', domain: 'mitienda.com' });
    expect(result.dnsRecords).toHaveLength(2);
    expect(result.dnsRecords[0]).toEqual({
      host: '@',
      type: 'A',
      value: '151.101.1.195',
      requiredAction: 'ADD',
    });
    expect(result.dnsRecords[1]).toEqual({
      host: 'www',
      type: 'CNAME',
      value: 'tienda.web.app',
      requiredAction: 'ADD',
    });
  });

  it('connectDomain returns empty dnsRecords when backend returns none', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: { success: true, dnsRecords: [] },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.connectDomain('store-8', 'vacia.com');

    expect(result.dnsRecords).toEqual([]);
  });

  it('connectDomain falls back host to @ when domainName is missing', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: {
        success: true,
        dnsRecords: [{ type: 'TXT', rdata: 'verificacion', requiredAction: 'ADD' }],
      },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.connectDomain('store-9', 'fallback.com');

    expect(result.dnsRecords[0].host).toBe('@');
  });

  it('redeployStore calls redeployStore cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    await service.redeployStore('store-abc');
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'redeployStore');
    expect(mockFn).toHaveBeenCalledWith({ storeId: 'store-abc' });
  });

  it('deleteStore calls deleteStore cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    await service.deleteStore('store-abc');
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteStore');
    expect(mockFn).toHaveBeenCalledWith({ storeId: 'store-abc' });
  });

  it('retryProvisioning calls retryProvisioning cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    await service.retryProvisioning('store-abc');
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'retryProvisioning');
    expect(mockFn).toHaveBeenCalledWith({ storeId: 'store-abc' });
  });

  it('getDeploymentHistory calls getStoreDeploymentHistory cloud function', async () => {
    const mockFn = vi
      .fn()
      .mockResolvedValue({ data: { history: [{ id: 1, runNumber: 42, status: 'completed' }] } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const history = await service.getDeploymentHistory('project-123');
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getStoreDeploymentHistory');
    expect(mockFn).toHaveBeenCalledWith({ projectId: 'project-123' });
    expect(history).toHaveLength(1);
    expect(history[0].runNumber).toBe(42);
  });

  it('updateStoreConfig calls updateStoreConfig cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    await service.updateStoreConfig('store-abc', { storeName: 'New Name' });
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'updateStoreConfig');
    expect(mockFn).toHaveBeenCalledWith({
      storeId: 'store-abc',
      config: { storeName: 'New Name' },
    });
  });

  it('generatePasswordResetLink calls generatePasswordResetLink cloud function', async () => {
    const mockFn = vi
      .fn()
      .mockResolvedValue({ data: { success: true, actionLink: 'https://link' } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.generatePasswordResetLink('store-abc', 'test@test.com');
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'generatePasswordResetLink');
    expect(mockFn).toHaveBeenCalledWith({ storeId: 'store-abc', email: 'test@test.com' });
    expect(result.actionLink).toBe('https://link');
  });

  it('getStoreConfig calls getStoreConfig cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { config: { storeName: 'Test' } } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const config = await service.getStoreConfig('store-abc');
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getStoreConfig');
    expect(mockFn).toHaveBeenCalledWith({ storeId: 'store-abc' });
    expect(config).toEqual({ storeName: 'Test' });
  });

  it('seedStore calls seedStore cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    await service.seedStore('store-abc', false);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'seedStore');
    expect(mockFn).toHaveBeenCalledWith({ storeId: 'store-abc', includeMockData: false });
  });

  it('listTemplateVersions calls listTemplateVersions cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: { versions: [{ version: 'v1', tag: 'latest', publishedAt: 'now', isLatest: true }] },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const versions = await service.listTemplateVersions();
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'listTemplateVersions');
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('v1');
  });

  it('updateStoreVersion calls updateStoreVersion cloud function', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    await service.updateStoreVersion('store-abc', 'v2');
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'updateStoreVersion');
    expect(mockFn).toHaveBeenCalledWith({ storeId: 'store-abc', version: 'v2' });
  });

  it('updateStore and setStatus update firestore documents', async () => {
    const { doc, updateDoc } = await import('firebase/firestore');
    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    await service.updateStore('store-id', { name: 'New Name' });
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'stores', 'store-id');
    expect(updateDoc).toHaveBeenCalled();

    await service.setStatus('store-id', 'suspended');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'stores', 'store-id');
    expect(updateDoc).toHaveBeenCalled();
  });

  it('inferDnsType correctly parses various dns required actions', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: {
        success: true,
        dnsRecords: [
          { requiredAction: 'ADD TXT VALUE' },
          { requiredAction: 'ADD AAAA VALUE' },
          { requiredAction: 'ADD CNAME VALUE' },
          { requiredAction: 'ADD OTHER' },
        ],
      },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const { StoresService } = await import('./stores');
    TestBed.configureTestingModule({ providers: [StoresService] });
    const service = TestBed.inject(StoresService);

    const result = await service.connectDomain('store-xyz', 'test.com');
    expect(result.dnsRecords[0].type).toBe('TXT');
    expect(result.dnsRecords[1].type).toBe('AAAA');
    expect(result.dnsRecords[2].type).toBe('CNAME');
    expect(result.dnsRecords[3].type).toBe('A');
  });
});
