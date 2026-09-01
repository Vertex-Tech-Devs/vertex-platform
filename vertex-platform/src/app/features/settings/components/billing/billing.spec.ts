import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, computed } from '@angular/core';
import { Billing } from './billing';
import { BillingAccountsService } from '@core/services/billing-accounts';
import { StoresService } from '@core/services/stores';
import type { BillingAccount } from '@core/models/billing-account';

class MockBillingAccountsService {
  accounts = signal<BillingAccount[]>([]);
  isLoading = signal(false);
  isSyncing = signal(false);
  error = signal<string | null>(null);
  toastMessage = signal<string | null>(null);

  activeAccountsCount = computed(() => this.accounts().filter((a) => a.active).length);
  sortedAccounts = computed(() =>
    [...this.accounts()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
  );
  totalGcpLimit = computed(() =>
    this.accounts().reduce((sum, a) => sum + (a.gcpProjectLimit || 5), 0),
  );
  totalGcpUsed = computed(() =>
    this.accounts().reduce((sum, a) => sum + (a.gcpUsedProjects || 0), 0),
  );
  totalGcpRemaining = computed(() => Math.max(0, this.totalGcpLimit() - this.totalGcpUsed()));
  usagePercent = computed(() =>
    this.totalGcpLimit() > 0 ? Math.round((this.totalGcpUsed() / this.totalGcpLimit()) * 100) : 0,
  );

  loadAccounts = vi.fn().mockResolvedValue(undefined);
  addAccount = vi.fn().mockResolvedValue(undefined);
  updateAccount = vi.fn().mockResolvedValue(undefined);
  removeAccount = vi.fn().mockResolvedValue(undefined);
  showToast = vi.fn().mockImplementation((msg: string) => this.toastMessage.set(msg));
}

class MockStoresService {
  getRuntimeCapacitySummary = vi.fn().mockResolvedValue({
    environment: 'development',
    sharedShardCount: 2,
    activeSharedShardCount: 1,
    availableSharedSlots: 10,
    recommendedRuntimeMode: 'shared-shard',
    shards: [
      {
        id: 'shard-a',
        projectId: 'vtx-sd-aaaa',
        siteId: 'default',
        region: 'us-central1',
        status: 'WARMUP_READY',
        currentStores: 0,
        reservedStores: 0,
        maxCapacity: 35,
        availableStores: 35,
        occupancyRatio: 0,
      },
    ],
  });
  getShardReadiness = vi.fn().mockResolvedValue({
    environment: 'development',
    total: 1,
    readyCount: 1,
    checkedAt: new Date().toISOString(),
    shards: [
      {
        id: 'shard-a',
        projectId: 'vtx-sd-aaaa',
        status: 'WARMUP_READY',
        billingAccountId: '016AC2-299E39-51C8BF',
        redirectUri: 'https://vtx-sd-aaaa.firebaseapp.com/__/auth/handler',
        ready: true,
        missing: [],
        checkedAt: new Date().toISOString(),
      },
    ],
  });
}

function makeAccount(overrides: Partial<BillingAccount> = {}): BillingAccount {
  return {
    id: '01D2F4-C25DF1-489AE9',
    name: 'Vertex Dev Billing 1',
    maxProjects: 5,
    active: true,
    addedAt: new Date(),
    usedProjects: 5,
    gcpProjectLimit: 5,
    gcpUsedProjects: 5,
    gcpRemaining: 0,
    gcpUsageRatio: 1.0,
    ...overrides,
  };
}

describe('Billing', () => {
  let component: Billing;
  let fixture: ComponentFixture<Billing>;
  let billingSvc: MockBillingAccountsService;
  let storesSvc: MockStoresService;

  beforeEach(async () => {
    billingSvc = new MockBillingAccountsService();
    storesSvc = new MockStoresService();
    await TestBed.configureTestingModule({
      imports: [Billing],
      providers: [
        provideRouter([]),
        { provide: BillingAccountsService, useValue: billingSvc },
        { provide: StoresService, useValue: storesSvc },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Billing);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('crea el componente', () => {
    expect(component).toBeTruthy();
  });

  it('carga readiness y runtime summary al inicializar', () => {
    expect(storesSvc.getRuntimeCapacitySummary).toHaveBeenCalled();
    expect(storesSvc.getShardReadiness).toHaveBeenCalled();
    expect(component.readyRatio()).toBe(100);
  });

  it('readyRatio calcula el porcentaje de shards listos', () => {
    component.readiness.set({
      environment: 'development',
      total: 4,
      readyCount: 2,
      checkedAt: new Date().toISOString(),
      shards: [],
    });
    expect(component.readyRatio()).toBe(50);
    component.readiness.set(null);
    expect(component.readyRatio()).toBe(0);
    component.readiness.set({
      environment: 'development',
      total: 0,
      readyCount: 0,
      checkedAt: new Date().toISOString(),
      shards: [],
    });
    expect(component.readyRatio()).toBe(0);
  });

  it('gcpUsagePercent usa el límite real de GCP', () => {
    expect(component.gcpUsagePercent(makeAccount({ gcpUsedProjects: 3, gcpProjectLimit: 5 }))).toBe(
      60,
    );
    expect(component.gcpUsagePercent(makeAccount({ gcpUsedProjects: 5, gcpProjectLimit: 5 }))).toBe(
      100,
    );
  });

  it('gcpUsageClass marca crítico al 100%', () => {
    expect(component.gcpUsageClass(makeAccount({ gcpUsedProjects: 5, gcpProjectLimit: 5 }))).toBe(
      'usage--critical',
    );
    expect(component.gcpUsageClass(makeAccount({ gcpUsedProjects: 1, gcpProjectLimit: 5 }))).toBe(
      'usage--ok',
    );
  });

  it('totales GCP suman usado y límite', () => {
    billingSvc.accounts.set([
      makeAccount({ gcpUsedProjects: 5, gcpProjectLimit: 5 }),
      makeAccount({
        id: '016AC2-299E39-51C8BF',
        name: 'Vertex Dev Billing 2',
        gcpUsedProjects: 5,
        gcpProjectLimit: 5,
      }),
    ]);
    expect(component.totalGcpUsed()).toBe(10);
    expect(component.totalGcpLimit()).toBe(10);
  });

  it('syncAccounts llama a loadAccounts del servicio', async () => {
    await component.syncAccounts();
    expect(billingSvc.loadAccounts).toHaveBeenCalled();
  });

  it('copyAccountId escribe en clipboard y dispara toast', () => {
    const clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: clipboardSpy } });
    component.copyAccountId('01D2F4-C25DF1-489AE9');
    expect(clipboardSpy).toHaveBeenCalledWith('01D2F4-C25DF1-489AE9');
    expect(component.copiedId()).toBe('01D2F4-C25DF1-489AE9');
    expect(billingSvc.showToast).toHaveBeenCalledWith('ID de cuenta copiado: 01D2F4-C25DF1-489AE9');
  });

  it('checkShards refresca el readiness', async () => {
    component.readiness.set(null);
    await component.checkShards();
    expect(component.readiness()).not.toBeNull();
    expect(component.isCheckingShards()).toBe(false);
  });

  it('abre y cierra el modal de un shard', () => {
    const shard = component.readiness()!.shards[0];
    component.selectedShard.set(shard);
    fixture.detectChanges();
    expect(component.selectedShard()).toBe(shard);
    const modalEl = fixture.nativeElement.querySelector('app-shard-status-modal');
    expect(modalEl).toBeTruthy();
    component.selectedShard.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-shard-status-modal')).toBeNull();
  });

  it('startEdit carga los valores actuales incluyendo el límite GCP', () => {
    const account = makeAccount({ gcpProjectLimit: 12 });
    component.startEdit(account);
    expect(component.editingId()).toBe(account.id);
    expect(component.editGcpLimit()).toBe(12);
  });

  it('cancelEdit limpia el modo edición', () => {
    component.startEdit(makeAccount());
    component.cancelEdit();
    expect(component.editingId()).toBeNull();
  });

  it('saveEdit persiste los cambios y sale de edición', async () => {
    const account = makeAccount({ gcpProjectLimit: 5 });
    component.startEdit(account);
    component.editName.set('Nuevo nombre');
    component.editGcpLimit.set(25);
    await component.saveEdit(account.id);
    expect(billingSvc.updateAccount).toHaveBeenCalledWith({
      id: account.id,
      name: 'Nuevo nombre',
      gcpProjectLimit: 25,
    });
    expect(component.editingId()).toBeNull();
  });

  it('saveEdit establece saveError si falla el servicio', async () => {
    billingSvc.updateAccount.mockRejectedValueOnce(new Error('Fallo al actualizar'));
    const account = makeAccount();
    component.startEdit(account);
    await component.saveEdit(account.id);
    expect(component.saveError()).toBe('Fallo al actualizar');
    expect(component.isSaving()).toBe(false);
  });

  it('syncAccounts captura errores si falla loadAccounts', async () => {
    billingSvc.loadAccounts.mockRejectedValueOnce(new Error('Fallo sync'));
    await component.syncAccounts();
    expect(billingSvc.isSyncing()).toBe(false);
  });

  it('toggleActive alterna el estado activo', async () => {
    const account = makeAccount();
    await component.toggleActive(account);
    expect(billingSvc.updateAccount).toHaveBeenCalledWith({ id: account.id, active: false });
    expect(component.togglingId()).toBeNull();
  });

  it('remove elimina la cuenta y alerta en error', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    billingSvc.removeAccount.mockRejectedValue(new Error('tiene tiendas activas'));
    await component.remove(makeAccount());
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('tiene tiendas activas'));
    expect(component.removingId()).toBeNull();
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('renderiza el listado de cuentas con botón Abrir en GCP Console', async () => {
    billingSvc.accounts.set([makeAccount()]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Vertex Dev Billing 1');
    expect(text).toContain('5 / 5 proyectos');
    expect(text).toContain('Abrir en GCP Console');
  });

  it('renderiza una cuenta inactiva con badge Inactiva', () => {
    billingSvc.accounts.set([makeAccount({ active: false })]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Inactiva');
  });

  it('evalúa correctamente los estados de salud de capacidad (isCriticalGcp, isWarningShards, isOptimalCapacity)', () => {
    // Con 10 cupos libres (totalGcpRemaining > 2) y 5 shards listos (readyCount > 2)
    billingSvc.accounts.set([makeAccount({ gcpUsedProjects: 0, gcpProjectLimit: 10 })]);
    component.readiness.set({
      environment: 'development',
      total: 5,
      readyCount: 5,
      checkedAt: new Date().toISOString(),
      shards: [],
    });
    expect(component.isCriticalGcp()).toBe(false);
    expect(component.isWarningShards()).toBe(false);
    expect(component.isOptimalCapacity()).toBe(true);

    // Advertencia preventiva (totalGcpRemaining > 2 pero readyCount <= 2)
    component.readiness.set({
      environment: 'development',
      total: 5,
      readyCount: 1,
      checkedAt: new Date().toISOString(),
      shards: [],
    });
    expect(component.isWarningShards()).toBe(true);
    expect(component.isOptimalCapacity()).toBe(false);

    // Forzar totalGcpRemaining <= 1 (5 / 5 en uso)
    billingSvc.accounts.set([makeAccount({ gcpUsedProjects: 5, gcpProjectLimit: 5 })]);
    expect(component.isCriticalGcp()).toBe(true);
    expect(component.isWarningShards()).toBe(false);
    expect(component.isOptimalCapacity()).toBe(false);
  });

  it('ordena shards por prioridad de negocio en sortedShards', () => {
    component.readiness.set({
      environment: 'development',
      total: 3,
      readyCount: 2,
      checkedAt: new Date().toISOString(),
      shards: [
        {
          id: 'shard-incomplete',
          projectId: 'p3',
          status: 'STANDBY',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: false,
          missing: ['redirect_uri'],
          checkedAt: '',
        },
        {
          id: 'shard-ready-empty',
          projectId: 'p2',
          status: 'WARMUP_READY',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: true,
          missing: [],
          checkedAt: '',
        },
        {
          id: 'shard-active-stores',
          projectId: 'p1',
          status: 'ACTIVE',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: true,
          missing: [],
          checkedAt: '',
        },
      ],
    });
    component.runtimeSummary.set({
      environment: 'development',
      sharedShardCount: 3,
      activeSharedShardCount: 1,
      availableSharedSlots: 35,
      recommendedRuntimeMode: 'shared-shard',
      shards: [
        {
          id: 'shard-active-stores',
          projectId: 'p1',
          siteId: 'd',
          region: 'us',
          status: 'ACTIVE',
          currentStores: 5,
          reservedStores: 0,
          maxCapacity: 35,
          availableStores: 30,
          occupancyRatio: 0.14,
        },
        {
          id: 'shard-ready-empty',
          projectId: 'p2',
          siteId: 'd',
          region: 'us',
          status: 'WARMUP_READY',
          currentStores: 0,
          reservedStores: 0,
          maxCapacity: 35,
          availableStores: 35,
          occupancyRatio: 0,
        },
        {
          id: 'shard-incomplete',
          projectId: 'p3',
          siteId: 'd',
          region: 'us',
          status: 'WARMUP_PROVISIONING',
          currentStores: 0,
          reservedStores: 0,
          maxCapacity: 35,
          availableStores: 35,
          occupancyRatio: 0,
        },
      ],
    });

    const sorted = component.sortedShards();
    expect(sorted[0].id).toBe('shard-active-stores');
    expect(sorted[1].id).toBe('shard-ready-empty');
    expect(sorted[2].id).toBe('shard-incomplete');
  });

  it('toggleCapacityGuide conmuta la visibilidad del acordeón', () => {
    expect(component.showCapacityGuide()).toBe(false);
    component.toggleCapacityGuide();
    expect(component.showCapacityGuide()).toBe(true);
    component.toggleCapacityGuide();
    expect(component.showCapacityGuide()).toBe(false);
  });

  it('scrollToShards llama a scrollIntoView', () => {
    const scrollSpy = vi.fn();
    const dummyEl = document.createElement('div');
    dummyEl.id = 'shards-section';
    dummyEl.scrollIntoView = scrollSpy;
    document.body.appendChild(dummyEl);

    component.scrollToShards();
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    document.body.removeChild(dummyEl);
  });

  it('cubre ramas vacías de sortedShards e isWarningShards', () => {
    component.readiness.set(null);
    expect(component.sortedShards()).toEqual([]);
    expect(component.isWarningShards()).toBe(false);

    component.readiness.set({
      environment: 'development',
      total: 2,
      readyCount: 1,
      checkedAt: new Date().toISOString(),
      shards: [
        {
          id: 's2',
          projectId: 'p2',
          status: 'ACTIVE',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: true,
          missing: [],
          checkedAt: '',
        },
        {
          id: 's1',
          projectId: 'p1',
          status: 'ACTIVE',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: true,
          missing: [],
          checkedAt: '',
        },
      ],
    });
    component.runtimeSummary.set({
      environment: 'development',
      sharedShardCount: 2,
      activeSharedShardCount: 2,
      availableSharedSlots: 70,
      recommendedRuntimeMode: 'shared-shard',
      shards: [
        {
          id: 's2',
          projectId: 'p2',
          siteId: 'd',
          region: 'us',
          status: 'ACTIVE',
          currentStores: 10,
          reservedStores: 0,
          maxCapacity: 35,
          availableStores: 25,
          occupancyRatio: 0.28,
        },
        {
          id: 's1',
          projectId: 'p1',
          siteId: 'd',
          region: 'us',
          status: 'ACTIVE',
          currentStores: 20,
          reservedStores: 0,
          maxCapacity: 35,
          availableStores: 15,
          occupancyRatio: 0.57,
        },
      ],
    });

    const sorted = component.sortedShards();
    expect(sorted[0].id).toBe('s1');
    expect(sorted[1].id).toBe('s2');
  });

  it('cubre ramas del tie-breaker por ID cuando currentStores son iguales', () => {
    component.readiness.set({
      environment: 'development',
      total: 2,
      readyCount: 2,
      checkedAt: new Date().toISOString(),
      shards: [
        {
          id: 'shard-b',
          projectId: 'pb',
          status: 'ACTIVE',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: true,
          missing: [],
          checkedAt: '',
        },
        {
          id: 'shard-a',
          projectId: 'pa',
          status: 'ACTIVE',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: true,
          missing: [],
          checkedAt: '',
        },
      ],
    });
    component.runtimeSummary.set({
      environment: 'development',
      sharedShardCount: 2,
      activeSharedShardCount: 2,
      availableSharedSlots: 70,
      recommendedRuntimeMode: 'shared-shard',
      shards: [
        {
          id: 'shard-b',
          projectId: 'pb',
          siteId: 'd',
          region: 'us',
          status: 'ACTIVE',
          currentStores: 5,
          reservedStores: 0,
          maxCapacity: 35,
          availableStores: 30,
          occupancyRatio: 0.14,
        },
        {
          id: 'shard-a',
          projectId: 'pa',
          siteId: 'd',
          region: 'us',
          status: 'ACTIVE',
          currentStores: 5,
          reservedStores: 0,
          maxCapacity: 35,
          availableStores: 30,
          occupancyRatio: 0.14,
        },
      ],
    });

    const sorted = component.sortedShards();
    expect(sorted[0].id).toBe('shard-a');
    expect(sorted[1].id).toBe('shard-b');
  });

  it('gestiona el formulario de vincular cuenta de facturación', async () => {
    component.openAddAccount();
    expect(component.isAddingAccount()).toBe(true);
    expect(component.newAccountId()).toBe('');
    expect(component.newAccountName()).toBe('');

    component.cancelAddAccount();
    expect(component.isAddingAccount()).toBe(false);

    // Validación de campos vacíos
    component.openAddAccount();
    await component.addAccount();
    expect(component.addAccountError()).toContain('Por favor completa el ID y el Nombre');

    // Éxito al agregar
    component.newAccountId.set('01D60F-09A9BD-8F5BC4');
    component.newAccountName.set('Vertex Prod Billing 5');
    component.newAccountLimit.set(5);

    await component.addAccount();
    expect(billingSvc.addAccount).toHaveBeenCalledWith({
      id: '01D60F-09A9BD-8F5BC4',
      name: 'Vertex Prod Billing 5',
      gcpProjectLimit: 5,
    });
    expect(component.isAddingAccount()).toBe(false);
  });

  it('filtra shards por búsqueda', () => {
    component.readiness.set({
      environment: 'development',
      total: 2,
      readyCount: 2,
      checkedAt: '',
      shards: [
        {
          id: 'shard-alpha',
          projectId: 'vtx-sd-alpha',
          status: 'ACTIVE',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: true,
          missing: [],
          checkedAt: '',
        },
        {
          id: 'shard-beta',
          projectId: 'vtx-sd-beta',
          status: 'ACTIVE',
          billingAccountId: 'b1',
          redirectUri: '',
          ready: true,
          missing: [],
          checkedAt: '',
        },
      ],
    });

    component.shardSearchQuery.set('beta');
    expect(component.filteredShards().length).toBe(1);
    expect(component.filteredShards()[0].id).toBe('shard-beta');

    component.shardSearchQuery.set('');
    expect(component.filteredShards().length).toBe(2);
  });

  it('captura error si falla el servicio al agregar cuenta', async () => {
    billingSvc.addAccount.mockRejectedValueOnce(new Error('Quota exceeded'));
    component.openAddAccount();
    component.newAccountId.set('01D60F-09A9BD-8F5BC4');
    component.newAccountName.set('Vertex Prod Billing 5');

    await component.addAccount();
    expect(component.addAccountError()).toContain('Quota exceeded');
    expect(component.isAdding()).toBe(false);
  });
});

