import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeedStoreModal } from './seed-store-modal';
import { StoresService } from '@core/services/stores';
import { signal } from '@angular/core';
import {
  PLATFORM_BUSINESS_VERTICALS,
  type VerticalOption,
} from '@core/constants/business-verticals.constants';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('SeedStoreModal', () => {
  let component: SeedStoreModal;
  let fixture: ComponentFixture<SeedStoreModal>;

  const mockStoresService = {
    allVerticals: signal(PLATFORM_BUSINESS_VERTICALS),
    createCustomVertical: vi.fn().mockResolvedValue({
      success: true,
      vertical: { id: 'TEST', name: 'Test', icon: '🏷️', description: 'Desc' },
    }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeedStoreModal],
      providers: [{ provide: StoresService, useValue: mockStoresService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SeedStoreModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('storeId', 'store-123');
    fixture.componentRef.setInput('storeName', 'Mi Tienda Test');
    fixture.componentRef.setInput('currentVerticalId', 'TECNOLOGIA_ELECTRONICA');
    fixture.detectChanges();
  });

  it('should create and initialize default values', () => {
    expect(component).toBeTruthy();
    expect(component.selectedVerticalId()).toBe('TECNOLOGIA_ELECTRONICA');
    expect(component.selectedMode()).toBe('FULL_DEMO');
    expect(component.purgeConfirmed()).toBe(true);
  });

  it('should select vertical and mode correctly', () => {
    component.selectVertical('GASTRONOMIA_RESTAURANTE');
    expect(component.selectedVerticalId()).toBe('GASTRONOMIA_RESTAURANTE');

    component.selectMode('CATALOG_ONLY');
    expect(component.selectedMode()).toBe('CATALOG_ONLY');
  });

  it('should emit seedConfirmed onConfirm when purge is confirmed', () => {
    let emittedPayload: unknown = null;
    component.seedConfirmed.subscribe((payload) => {
      emittedPayload = payload;
    });

    component.selectVertical('INDUMENTARIA_CALZADO');
    component.selectMode('FULL_DEMO');
    component.onConfirm();

    expect(emittedPayload).toEqual({
      verticalId: 'INDUMENTARIA_CALZADO',
      provisioningMode: 'FULL_DEMO',
      includeMockData: true,
    });
  });

  it('should emit close onCancel when not seeding', () => {
    let closed = false;
    component.close.subscribe(() => {
      closed = true;
    });

    component.onCancel();
    expect(closed).toBe(true);
  });

  it('should handle onCustomVerticalCreated and null vertical', () => {
    component.onCustomVerticalCreated({
      id: 'CERVECERIA',
      name: 'Cervecería',
      icon: '🍺',
      description: 'Cervezas artesanales',
    });

    expect(component.selectedVerticalId()).toBe('CERVECERIA');
    expect(component.showCustomVerticalModal()).toBe(false);

    component.onCustomVerticalCreated(null as unknown as VerticalOption);
    expect(component.showCustomVerticalModal()).toBe(false);
  });

  it('does not emit onConfirm if purgeConfirmed is false', () => {
    component.purgeConfirmed.set(false);
    let emitted = false;
    component.seedConfirmed.subscribe(() => (emitted = true));
    component.onConfirm();
    expect(emitted).toBe(false);
  });

  it('does not emit onCancel if isSeeding is true', () => {
    fixture.componentRef.setInput('isSeeding', true);
    let closed = false;
    component.close.subscribe(() => (closed = true));
    component.onCancel();
    expect(closed).toBe(false);
  });

  it('emits with includeMockData false for CATALOG_ONLY and EMPTY', () => {
    let emittedPayload: unknown = null;
    component.seedConfirmed.subscribe((p) => (emittedPayload = p));

    component.selectMode('EMPTY');
    component.onConfirm();

    expect(emittedPayload).toEqual({
      verticalId: 'TECNOLOGIA_ELECTRONICA',
      provisioningMode: 'EMPTY',
      includeMockData: false,
    });
  });
});
