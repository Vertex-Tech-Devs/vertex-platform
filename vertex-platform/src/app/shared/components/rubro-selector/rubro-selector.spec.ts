import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RubroSelector } from './rubro-selector';
import { StoresService } from '@core/services/stores';
import { signal } from '@angular/core';
import { PLATFORM_BUSINESS_VERTICALS } from '@core/constants/business-verticals.constants';
import { describe, it, expect, beforeEach } from 'vitest';

describe('RubroSelector', () => {
  let component: RubroSelector;
  let fixture: ComponentFixture<RubroSelector>;

  const mockStoresService = {
    allVerticals: signal(PLATFORM_BUSINESS_VERTICALS),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RubroSelector],
      providers: [{ provide: StoresService, useValue: mockStoresService }],
    }).compileComponents();

    fixture = TestBed.createComponent(RubroSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list all built-in verticals by default', () => {
    expect(component.allAvailableVerticals().length).toBe(PLATFORM_BUSINESS_VERTICALS.length);
  });

  it('should use customList input when provided', () => {
    const custom = [
      {
        id: 'CUSTOM_1',
        name: 'Custom One',
        icon: '⭐',
        description: 'Desc One',
        categories: ['Cat1'],
      },
      {
        id: 'CUSTOM_2',
        name: 'Custom Two',
        icon: '🚀',
        description: 'Desc Two',
        categories: ['Cat2'],
      },
    ];
    fixture.componentRef.setInput('verticals', custom);
    fixture.detectChanges();

    expect(component.allAvailableVerticals().length).toBe(2);
    expect(component.allAvailableVerticals()[0].id).toBe('CUSTOM_1');
  });

  it('should paginate items according to pageSize', () => {
    fixture.componentRef.setInput('pageSize', 4);
    fixture.detectChanges();

    expect(component.paginatedVerticals().length).toBe(4);
    expect(component.totalPages()).toBe(Math.ceil(PLATFORM_BUSINESS_VERTICALS.length / 4));
    expect(component.pagesList().length).toBe(component.totalPages());
  });

  it('should filter items by search term on name, description, id and categories', () => {
    component.searchTerm.set('tecnologia');
    fixture.detectChanges();
    expect(component.filteredVerticals().length).toBeGreaterThan(0);
    expect(component.filteredVerticals()[0].id).toBe('TECNOLOGIA_ELECTRONICA');

    // Search by category
    const withCategories = [
      {
        id: 'TEST_CAT',
        name: 'Almacén',
        icon: '🥫',
        description: 'Almacén de barrio',
        categories: ['Aceites', 'Fideos'],
      },
    ];
    fixture.componentRef.setInput('verticals', withCategories);
    fixture.detectChanges();

    component.searchTerm.set('fideos');
    fixture.detectChanges();
    expect(component.filteredVerticals().length).toBe(1);
    expect(component.filteredVerticals()[0].id).toBe('TEST_CAT');
  });

  it('should format paginationSummary correctly', () => {
    fixture.componentRef.setInput('pageSize', 6);
    fixture.detectChanges();
    expect(component.paginationSummary()).toBe(`1-6 de ${PLATFORM_BUSINESS_VERTICALS.length}`);

    // Empty state summary
    component.searchTerm.set('non-existent-xyz-12345');
    fixture.detectChanges();
    expect(component.paginationSummary()).toBe('0 rubros');
  });

  it('should emit selectedVerticalChange when a vertical card is clicked', () => {
    let selectedId = '';
    component.selectedVerticalChange.subscribe((id) => (selectedId = id));

    component.selectVertical('INDUMENTARIA_CALZADO');
    expect(selectedId).toBe('INDUMENTARIA_CALZADO');
  });

  it('should handle keyboard enter on a vertical card', () => {
    let selectedId = '';
    component.selectedVerticalChange.subscribe((id) => (selectedId = id));

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    component.onKeyDownCard(enterEvent, 'MERCERIA_COSTURA');
    expect(selectedId).toBe('MERCERIA_COSTURA');

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
    component.onKeyDownCard(spaceEvent, 'FARMACIA_PERFUMERIA');
    expect(selectedId).toBe('FARMACIA_PERFUMERIA');

    const otherEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    component.onKeyDownCard(otherEvent, 'OTHER');
    expect(selectedId).toBe('FARMACIA_PERFUMERIA'); // Should not change
  });

  it('should emit createRequested on requestCreate', () => {
    let requested = false;
    component.createRequested.subscribe(() => (requested = true));

    component.requestCreate();
    expect(requested).toBe(true);
  });

  it('should navigate between pages with next, prev and setPage clamping', () => {
    fixture.componentRef.setInput('pageSize', 4);
    fixture.detectChanges();

    expect(component.currentPage()).toBe(1);
    component.prevPage(); // Boundary at page 1
    expect(component.currentPage()).toBe(1);

    component.nextPage();
    expect(component.currentPage()).toBe(2);

    component.setPage(999); // Clamps to max page
    expect(component.currentPage()).toBe(component.totalPages());

    component.nextPage(); // Boundary at last page
    expect(component.currentPage()).toBe(component.totalPages());

    component.setPage(-5); // Clamps to 1
    expect(component.currentPage()).toBe(1);
  });

  it('should clear search and reset page on clearSearch', () => {
    component.searchTerm.set('moda');
    component.currentPage.set(2);
    component.clearSearch();

    expect(component.searchTerm()).toBe('');
    expect(component.currentPage()).toBe(1);
  });
});
