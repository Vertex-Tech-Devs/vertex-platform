import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Billing } from './billing';
import { BillingAccountsService } from '@core/services/billing-accounts';
import { StoresService } from '@core/services/stores';
import type { BillingAccount } from '@core/models/billing-account';

class MockBillingAccountsService {
  accounts = signal<BillingAccount[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  loadAccounts = vi.fn().mockResolvedValue(undefined);
  addAccount = vi.fn().mockResolvedValue(undefined);
  updateAccount = vi.fn().mockResolvedValue(undefined);
  removeAccount = vi.fn().mockResolvedValue(undefined);
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
    id: 'acc-1',
    name: 'Vertex Billing One',
    maxProjects: 15,
    active: true,
    addedAt: new Date(),
    usedProjects: 2,
    gcpProjectLimit: 5,
    gcpUsedProjects: 3,
    gcpRemaining: 2,
    gcpUsageRatio: 0.6,
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
    expect(component.gcpUsagePercent(makeAccount())).toBe(60);
    expect(component.gcpUsagePercent(makeAccount({ gcpUsedProjects: 5 }))).toBe(100);
  });

  it('gcpUsageClass marca crítico al 100%', () => {
    expect(component.gcpUsageClass(makeAccount({ gcpUsedProjects: 5 }))).toBe('usage--critical');
    expect(component.gcpUsageClass(makeAccount({ gcpUsedProjects: 1 }))).toBe('usage--ok');
  });

  it('totales GCP suman usado y límite', () => {
    billingSvc.accounts.set([
      makeAccount(),
      makeAccount({ gcpUsedProjects: 4, gcpProjectLimit: 10 }),
    ]);
    expect(component.totalGcpUsed()).toBe(7);
    expect(component.totalGcpLimit()).toBe(15);
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

  it('renderiza badge "Listo" para un shard listo', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Listo');
    expect(text).toContain('1/1 listos (100%)');
  });

  it('nextAccountName genera nombres correlativos', () => {
    billingSvc.accounts.set([makeAccount()]);
    expect(component.nextAccountName()).toBe('Billing Account Two');
    billingSvc.accounts.set([]);
    expect(component.nextAccountName()).toBe('Billing Account One');
  });

  it('normalizeBillingId quita el prefijo billingAccounts/', () => {
    expect(component.normalizeBillingId('billingAccounts/0123-4567')).toBe('0123-4567');
    expect(component.normalizeBillingId('  0123-4567  ')).toBe('0123-4567');
  });

  it('startAdd resetea el form con límite GCP default 5', () => {
    component.startAdd();
    expect(component.addName()).toBe('Billing Account One');
    expect(component.addGcpLimit()).toBe(5);
  });

  it('addAccount valida id y nombre', async () => {
    component.addId.set('');
    component.addName.set('');
    await component.addAccount();
    expect(component.addError()).toContain('ID y nombre son requeridos');
    expect(billingSvc.addAccount).not.toHaveBeenCalled();
  });

  it('addAccount agrega la cuenta y limpia el form', async () => {
    component.addId.set('billingAccounts/0123-4567');
    component.addName.set('Vertex Billing Two');
    component.addGcpLimit.set(10);
    await component.addAccount();
    expect(billingSvc.addAccount).toHaveBeenCalledWith({
      id: '0123-4567',
      name: 'Vertex Billing Two',
      gcpProjectLimit: 10,
    });
    expect(component.addId()).toBe('');
  });

  it('addAccount setea error cuando el backend falla', async () => {
    billingSvc.addAccount.mockRejectedValue(new Error('verificación falló'));
    component.addId.set('acc-x');
    component.addName.set('X');
    await component.addAccount();
    expect(component.addError()).toContain('verificación falló');
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

  it('toggleActive alterna el estado activo', async () => {
    const account = makeAccount();
    await component.toggleActive(account);
    expect(billingSvc.updateAccount).toHaveBeenCalledWith({ id: account.id, active: false });
    expect(component.togglingId()).toBeNull();
  });

  it('remove elimina la cuenta y alerta en error', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    billingSvc.removeAccount.mockRejectedValue(new Error('tiene tiendas activas'));
    await component.remove(makeAccount());
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('tiene tiendas activas'));
    expect(component.removingId()).toBeNull();
    alertSpy.mockRestore();
  });

  it('gcpUsageClass maneja límite 0 y valores intermedios', () => {
    expect(component.gcpUsageClass(makeAccount({ gcpProjectLimit: 0 }))).toBe('usage--ok');
    expect(component.gcpUsageClass(makeAccount({ gcpUsedProjects: 4, gcpProjectLimit: 5 }))).toBe(
      'usage--warning',
    );
  });

  it('renderiza el listado de cuentas con uso real de GCP', async () => {
    billingSvc.accounts.set([makeAccount()]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Vertex Billing One');
    expect(text).toContain('3 / 5 proyectos en GCP');
    expect(text).toContain('60%');
  });

  it('renderiza una cuenta inactiva con badge Inactiva', () => {
    billingSvc.accounts.set([makeAccount({ active: false })]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Inactiva');
  });

  it('renderiza el modo edición al editar una cuenta', () => {
    billingSvc.accounts.set([makeAccount()]);
    fixture.detectChanges();
    component.startEdit(makeAccount({ gcpProjectLimit: 12 }));
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('input.form-control--sm');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Límite aprobado por Google');
  });

  it('muestra el error de agregar cuenta en el template', async () => {
    component.addId.set('acc-x');
    component.addName.set('X');
    billingSvc.addAccount.mockRejectedValue(new Error('fallo'));
    await component.addAccount();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('fallo');
  });
});
