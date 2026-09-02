import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Infrastructure } from './infrastructure';
import { BillingAccountsService } from '@core/services/billing-accounts';
import { StoresService } from '@core/services/stores';
import { signal, computed } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BillingAccount } from '@core/models/billing-account';
import type { ShardReadiness } from '@core/models/shard-capacity';

const mockAccount1: BillingAccount = {
  id: '016AC2-299E39-51C8BF',
  name: 'Vertex Prod 1',
  maxProjects: 5,
  active: true,
  addedAt: new Date(),
  usedProjects: 3,
  gcpProjectLimit: 5,
  gcpUsedProjects: 3,
  gcpRemaining: 2,
  gcpUsageRatio: 0.6,
};

const mockAccount2: BillingAccount = {
  id: '016AC2-299E39-51C8C0',
  name: 'Vertex Prod 2',
  maxProjects: 5,
  active: false,
  addedAt: new Date(),
  usedProjects: 5,
  gcpProjectLimit: 5,
  gcpUsedProjects: 5,
  gcpRemaining: 0,
  gcpUsageRatio: 1.0,
};

class MockBillingAccountsService {
  accounts = signal<BillingAccount[]>([mockAccount1, mockAccount2]);
  isLoading = signal(false);
  isSyncing = signal(false);
  error = signal<string | null>(null);
  toastMessage = signal<string | null>(null);

  activeAccountsCount = computed(() => this.accounts().filter((a) => a.active).length);
  totalGcpLimit = computed(() => this.accounts().reduce((sum, a) => sum + (a.gcpProjectLimit || 5), 0));
  totalGcpUsed = computed(() => this.accounts().reduce((sum, a) => sum + (a.gcpUsedProjects || 0), 0));
  totalGcpRemaining = computed(() => Math.max(0, this.totalGcpLimit() - this.totalGcpUsed()));
  usagePercent = computed(() =>
    this.totalGcpLimit() > 0 ? Math.round((this.totalGcpUsed() / this.totalGcpLimit()) * 100) : 0,
  );

  loadAccounts = vi.fn().mockResolvedValue(undefined);
  addAccount = vi.fn().mockResolvedValue(undefined);
  updateAccount = vi.fn().mockResolvedValue(undefined);
  removeAccount = vi.fn().mockResolvedValue(undefined);
}

class MockStoresService {
  getRuntimeCapacitySummary = vi.fn().mockResolvedValue({
    environment: 'production',
    sharedShardCount: 3,
    activeSharedShardCount: 2,
    availableSharedSlots: 50,
    recommendedRuntimeMode: 'shared-shard',
    shards: [
      {
        id: 'shard-prod-01',
        projectId: 'vtx-prod-01',
        siteId: 'default',
        region: 'us-central1',
        status: 'ACTIVE',
        currentStores: 10,
        reservedStores: 10,
        maxCapacity: 35,
        availableStores: 25,
        occupancyRatio: 0.28,
      },
      {
        id: 'shard-prod-02',
        projectId: 'vtx-prod-02',
        siteId: 'default',
        region: 'us-central1',
        status: 'WARMUP_READY',
        currentStores: 0,
        reservedStores: 0,
        maxCapacity: 35,
        availableStores: 35,
        occupancyRatio: 0,
      },
      {
        id: 'shard-prod-03',
        projectId: 'vtx-prod-03',
        siteId: 'default',
        region: 'us-central1',
        status: 'WARMUP_PENDING',
        currentStores: 0,
        reservedStores: 0,
        maxCapacity: 35,
        availableStores: 35,
        occupancyRatio: 0,
      },
    ],
  });

  getShardReadiness = vi.fn().mockResolvedValue({
    environment: 'production',
    checkedAt: '2026-09-02T00:00:00.000Z',
    allReady: true,
    readyCount: 3,
    total: 3,
    shards: [
      {
        id: 'shard-prod-01',
        projectId: 'vtx-prod-01',
        status: 'ACTIVE',
        billingAccountId: '016AC2-299E39-51C8BF',
        redirectUri: 'https://vtx-prod-01.firebaseapp.com/__/auth/handler',
        ready: true,
        missing: [],
        checkedAt: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'shard-prod-02',
        projectId: 'vtx-prod-02',
        status: 'WARMUP_READY',
        billingAccountId: '016AC2-299E39-51C8BF',
        redirectUri: 'https://vtx-prod-02.firebaseapp.com/__/auth/handler',
        ready: true,
        missing: [],
        checkedAt: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'shard-prod-03',
        projectId: 'vtx-prod-03',
        status: 'WARMUP_PENDING',
        billingAccountId: '016AC2-299E39-51C8BF',
        redirectUri: 'https://vtx-prod-03.firebaseapp.com/__/auth/handler',
        ready: false,
        missing: ['status'],
        checkedAt: '2026-09-02T00:00:00.000Z',
      },
    ],
  });
}

describe('Infrastructure Component', () => {
  let component: Infrastructure;
  let fixture: ComponentFixture<Infrastructure>;
  let mockBillingSvc: MockBillingAccountsService;
  let mockStoresSvc: MockStoresService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockBillingSvc = new MockBillingAccountsService();
    mockStoresSvc = new MockStoresService();

    await TestBed.configureTestingModule({
      imports: [Infrastructure],
      providers: [
        provideRouter([]),
        { provide: BillingAccountsService, useValue: mockBillingSvc },
        { provide: StoresService, useValue: mockStoresSvc },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Infrastructure);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the infrastructure component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute shard metrics and available stores accurately', async () => {
    await component.refreshData();
    expect(component.activeShardsCount()).toBe(1);
    expect(component.pendingShardsCount()).toBe(1);
    expect(component.sortedShards().length).toBe(3);
    expect(component.activeAvailableStores()).toBe(25);
    expect(component.standbyAvailableStores()).toBe(35);
    expect(component.totalAvailableStores()).toBe(95);
    expect(component.isCriticalGcp()).toBe(false);
    expect(component.isWarningShards()).toBe(true);
  });

  it('handles empty readiness report fallback gracefully', () => {
    component.readiness.set(null);
    expect(component.sortedShards()).toEqual([]);
    expect(component.totalAvailableStores()).toBe(150);
    expect(component.activeAvailableStores()).toBe(120);
    expect(component.standbyAvailableStores()).toBe(30);
    expect(component.activeShardsCount()).toBe(4);
  });

  it('should filter shards based on search query', async () => {
    await component.refreshData();
    component.shardSearchQuery.set('shard-prod-01');
    expect(component.filteredShards().length).toBe(1);
    expect(component.filteredShards()[0].id).toBe('shard-prod-01');

    component.shardSearchQuery.set('non-existent');
    expect(component.filteredShards().length).toBe(0);
  });

  it('should open and close shard modal', () => {
    const mockShard: ShardReadiness = {
      id: 'shard-prod-01',
      projectId: 'vtx-prod-01',
      status: 'ACTIVE',
      billingAccountId: '016AC2-299E39-51C8BF',
      redirectUri: 'https://vtx-prod-01.firebaseapp.com/__/auth/handler',
      ready: true,
      missing: [],
      checkedAt: '2026-09-02T00:00:00.000Z',
    };

    component.openShardModal(mockShard);
    expect(component.selectedShard()).toEqual(mockShard);

    component.closeShardModal();
    expect(component.selectedShard()).toBeNull();
  });

  it('should toggle account status between active and inactive', async () => {
    await component.toggleAccountStatus(mockAccount1);
    expect(mockBillingSvc.updateAccount).toHaveBeenCalledWith({
      id: '016AC2-299E39-51C8BF',
      active: false,
    });
  });

  it('should handle toggle account error gracefully', async () => {
    mockBillingSvc.updateAccount.mockRejectedValueOnce(new Error('Update failed'));
    await component.toggleAccountStatus(mockAccount1);
    expect(mockBillingSvc.error()).toBe('Update failed');
  });

  it('should open and cancel add account dialog', () => {
    component.openAddAccount();
    expect(component.isAddingAccount()).toBe(true);

    component.cancelAddAccount();
    expect(component.isAddingAccount()).toBe(false);
    expect(component.newAccountId()).toBe('');
    expect(component.newAccountName()).toBe('');
  });

  it('should validate add account form fields', async () => {
    component.openAddAccount();
    component.newAccountId.set('');
    component.newAccountName.set('');

    await component.addAccount();

    expect(component.addAccountError()).toContain('completa el ID');
  });

  it('should add account when form is valid', async () => {
    component.openAddAccount();
    component.newAccountId.set('016AC2-299E39-51C8B9');
    component.newAccountName.set('Vertex Prod 3');
    component.newAccountLimit.set(5);

    await component.addAccount();

    expect(mockBillingSvc.addAccount).toHaveBeenCalledWith({
      id: '016AC2-299E39-51C8B9',
      name: 'Vertex Prod 3',
      gcpProjectLimit: 5,
    });
    expect(component.isAddingAccount()).toBe(false);
  });

  it('should handle add account error gracefully', async () => {
    component.openAddAccount();
    component.newAccountId.set('016AC2-299E39-51C8B9');
    component.newAccountName.set('Vertex Prod 3');
    mockBillingSvc.addAccount.mockRejectedValueOnce(new Error('GCP Error'));

    await component.addAccount();

    expect(component.addAccountError()).toBe('GCP Error');
  });

  it('should sync accounts and refresh data', async () => {
    await component.syncAccounts();
    expect(mockBillingSvc.loadAccounts).toHaveBeenCalled();
    expect(mockStoresSvc.getShardReadiness).toHaveBeenCalled();
  });

  it('should update account limit with valid value', async () => {
    const event = { target: { value: '8' } } as unknown as Event;
    await component.updateAccountLimit(mockAccount1, event);
    expect(mockBillingSvc.updateAccount).toHaveBeenCalledWith({
      id: '016AC2-299E39-51C8BF',
      gcpProjectLimit: 8,
    });
  });

  it('should ignore invalid account limit input', async () => {
    const event = { target: { value: 'invalid' } } as unknown as Event;
    await component.updateAccountLimit(mockAccount1, event);
    expect(mockBillingSvc.updateAccount).not.toHaveBeenCalled();
  });

  it('should handle update limit error gracefully', async () => {
    const event = { target: { value: '10' } } as unknown as Event;
    mockBillingSvc.updateAccount.mockRejectedValueOnce(new Error('Limit error'));
    await component.updateAccountLimit(mockAccount1, event);
    expect(mockBillingSvc.error()).toBe('Limit error');
  });

  it('should copy shard ID to clipboard', () => {
    component.copyToClipboard('shard-prod-01');
    expect(component.copiedId()).toBe('shard-prod-01');
  });

  it('toggleAccountStatus toggles status and handles error', async () => {
    await component.toggleAccountStatus(mockAccount1);
    expect(mockBillingSvc.updateAccount).toHaveBeenCalledWith({
      id: '016AC2-299E39-51C8BF',
      active: false,
    });

    mockBillingSvc.updateAccount.mockRejectedValueOnce(new Error('Toggle fail'));
    await component.toggleAccountStatus(mockAccount1);
    expect(mockBillingSvc.error()).toBe('Toggle fail');
  });

  it('computes fallbacks and warning states when shards list is empty', () => {
    mockStoresSvc.getRuntimeCapacitySummary.mockResolvedValueOnce({
      environment: 'production',
      sharedShardCount: 0,
      activeSharedShardCount: 0,
      availableSharedSlots: 0,
      recommendedRuntimeMode: 'shared-shard',
      shards: [],
    });
    component.runtimeSummary.set(null);
    component.readiness.set(null);

    expect(component.totalAvailableStores()).toBe(150);
    expect(component.activeAvailableStores()).toBe(120);
    expect(component.standbyAvailableStores()).toBe(30);
    expect(component.activeShardsCount()).toBe(4);
    expect(component.pendingShardsCount()).toBe(0);
  });
});
