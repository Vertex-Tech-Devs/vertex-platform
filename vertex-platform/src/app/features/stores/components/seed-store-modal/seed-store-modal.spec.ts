import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeedStoreModal } from './seed-store-modal';

describe('SeedStoreModal', () => {
  let component: SeedStoreModal;
  let fixture: ComponentFixture<SeedStoreModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeedStoreModal],
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

  it('should filter verticals according to searchTerm', () => {
    component.searchTerm.set('electro');
    const filtered = component.filteredVerticals();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((v) => v.id === 'TECNOLOGIA_ELECTRONICA')).toBe(true);
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
});
