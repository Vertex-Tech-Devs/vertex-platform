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
});
