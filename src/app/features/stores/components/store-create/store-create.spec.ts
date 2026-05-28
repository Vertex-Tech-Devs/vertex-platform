import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { StoreCreate } from './store-create';
import type { RuntimeCapacitySummary } from '@core/services/stores';
import { StoresService } from '@core/services/stores';

const runtimeSummary: RuntimeCapacitySummary = {
  environment: 'production',
  sharedShardCount: 1,
  activeSharedShardCount: 1,
  availableSharedSlots: 63,
  recommendedRuntimeMode: 'shared-shard',
  shards: [],
};

describe('StoreCreate', () => {
  const storesService = {
    createStore: vi.fn().mockResolvedValue('store-123'),
    getRuntimeCapacitySummary: vi.fn().mockResolvedValue(runtimeSummary),
  };

  beforeEach(async () => {
    storesService.createStore.mockReset();
    storesService.getRuntimeCapacitySummary.mockReset();
    storesService.getRuntimeCapacitySummary.mockResolvedValue(runtimeSummary);

    await TestBed.configureTestingModule({
      imports: [StoreCreate],
      providers: [provideRouter([]), { provide: StoresService, useValue: storesService }],
    }).compileComponents();
  });

  it('auto-generates the slug from the store name', () => {
    const fixture = TestBed.createComponent(StoreCreate);
    const component = fixture.componentInstance;

    component.form.patchValue({ name: 'Ropa Maria 2026' });
    component.autoSlug();

    expect(component.form.get('slug')?.value).toBe('ropa-maria-2026');
  });

  it('renders the runtime capacity summary when available', async () => {
    const fixture = TestBed.createComponent(StoreCreate);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const summary = fixture.debugElement.query(By.css('[data-testid="runtime-summary"]'));
    expect(summary).not.toBeNull();
    expect(summary.nativeElement.textContent).toContain('63 lugares libres');
  });

  it('shows an error when runtime capacity lookup fails', async () => {
    storesService.getRuntimeCapacitySummary.mockRejectedValue(new Error('failed'));
    const fixture = TestBed.createComponent(StoreCreate);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo cargar la capacidad actual de shared-shards.',
    );
  });

  it('normalizes unicode characters/accents in slug', () => {
    const fixture = TestBed.createComponent(StoreCreate);
    const component = fixture.componentInstance;

    component.form.patchValue({ name: 'Tienda de Café y Ñandúes' });
    component.autoSlug();

    expect(component.form.get('slug')?.value).toBe('tienda-de-cafe-y-nandues');
  });

  it('validates customDomain using robust regex pattern', () => {
    const fixture = TestBed.createComponent(StoreCreate);
    const component = fixture.componentInstance;
    const customDomain = component.form.get('customDomain');

    customDomain?.setValue('mi-tienda.com');
    expect(customDomain?.valid).toBe(true);

    customDomain?.setValue('mi..tienda.com');
    expect(customDomain?.valid).toBe(false);

    customDomain?.setValue('mi-tienda.com.');
    expect(customDomain?.valid).toBe(false);
  });

  it('parses errors correctly on createStore failure', async () => {
    storesService.createStore.mockRejectedValue(new Error('Firebase error description'));
    const fixture = TestBed.createComponent(StoreCreate);
    const component = fixture.componentInstance;

    component.form.patchValue({
      name: 'Test Store',
      slug: 'test-store',
      ownerEmail: 'owner@test.com',
      verticalId: 'indumentaria',
    });

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Firebase error description');
    expect(component.isSubmitting()).toBe(false);
  });

  it('marks all touched on submit with invalid form', async () => {
    const fixture = TestBed.createComponent(StoreCreate);
    const component = fixture.componentInstance;

    component.form.patchValue({ name: '' }); // Invalid
    await component.onSubmit();

    expect(component.form.touched).toBe(true);
  });

  it('handles selectVertical and custom vertical changes correctly', () => {
    const fixture = TestBed.createComponent(StoreCreate);
    const component = fixture.componentInstance;

    // Default select
    component.selectVertical('gastronomia');
    expect(component.selectedVerticalType()).toBe('gastronomia');
    expect(component.form.get('verticalId')?.value).toBe('gastronomia');

    // Custom vertical select
    component.onCustomVerticalChange('Mi Rubro Custom');
    expect(component.customVerticalName()).toBe('Mi Rubro Custom');

    component.selectVertical('custom');
    expect(component.selectedVerticalType()).toBe('custom');
    expect(component.form.get('verticalId')?.value).toBe('Mi Rubro Custom');

    // Changing custom vertical updates the form field
    component.onCustomVerticalChange('Otro Rubro');
    expect(component.form.get('verticalId')?.value).toBe('Otro Rubro');
  });
});
