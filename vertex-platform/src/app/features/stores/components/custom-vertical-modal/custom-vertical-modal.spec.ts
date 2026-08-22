import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomVerticalModal } from './custom-vertical-modal';
import { StoresService } from '@core/services/stores';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('CustomVerticalModal', () => {
  let component: CustomVerticalModal;
  let fixture: ComponentFixture<CustomVerticalModal>;

  const mockStoresService = {
    createCustomVertical: vi.fn().mockResolvedValue({
      success: true,
      vertical: {
        id: 'TEST_VERTICAL',
        name: 'Test Vertical',
        icon: '🏷️',
        description: 'A test vertical description',
        isCustom: true,
      },
    }),
  };

  beforeEach(async () => {
    mockStoresService.createCustomVertical.mockReset();
    mockStoresService.createCustomVertical.mockResolvedValue({
      success: true,
      vertical: {
        id: 'TEST_VERTICAL',
        name: 'Test Vertical',
        icon: '🏷️',
        description: 'A test vertical description',
        isCustom: true,
      },
    });

    await TestBed.configureTestingModule({
      imports: [CustomVerticalModal],
      providers: [{ provide: StoresService, useValue: mockStoresService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomVerticalModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add a category to the list and ignore empty input', () => {
    component.form.patchValue({ categoryInput: '   ' });
    component.addCategory();
    expect(component.categoriesList().length).toBe(3); // Default 3 categories

    component.form.patchValue({ categoryInput: 'Cervezas IPAs' });
    component.addCategory();
    expect(component.categoriesList()).toContain('Cervezas IPAs');
  });

  it('should handle enter key on category input', () => {
    component.form.patchValue({ categoryInput: 'Growlers' });
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    const preventSpy = vi.spyOn(enterEvent, 'preventDefault');

    component.onKeyDownCategory(enterEvent);
    expect(preventSpy).toHaveBeenCalled();
    expect(component.categoriesList()).toContain('Growlers');

    const otherEvent = new KeyboardEvent('keydown', { key: 'a' });
    component.onKeyDownCategory(otherEvent);
  });

  it('should remove a category from the list', () => {
    const initialLen = component.categoriesList().length;
    component.removeCategory(0);
    expect(component.categoriesList().length).toBe(initialLen - 1);
  });

  it('should select an emoji', () => {
    component.selectEmoji('🍺');
    expect(component.form.get('icon')?.value).toBe('🍺');
  });

  it('should emit close on onCancel when not submitting', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    component.onCancel();
    expect(closed).toBe(true);
  });

  it('should do nothing on submit if form is invalid', async () => {
    component.form.patchValue({ name: '' });
    await component.onSubmit();
    expect(mockStoresService.createCustomVertical).not.toHaveBeenCalled();
  });

  it('should handle error during submission', async () => {
    mockStoresService.createCustomVertical.mockRejectedValue(new Error('Network error'));

    component.form.patchValue({
      name: 'Cervecería Artesanal',
      icon: '🍺',
      description: 'Venta de cervezas tiradas y botellones artesanales',
    });

    await component.onSubmit();
    expect(component.errorMessage()).toBe('Network error');
  });

  it('should submit valid form and emit created event', async () => {
    let createdVertical: { id: string; name?: string } | undefined;
    component.created.subscribe((v) => {
      createdVertical = v as { id: string; name?: string };
    });

    component.form.patchValue({
      name: 'Cervecería Artesanal',
      icon: '🍺',
      description: 'Venta de cervezas tiradas y botellones artesanales',
    });

    await component.onSubmit();

    expect(mockStoresService.createCustomVertical).toHaveBeenCalled();
    expect(createdVertical).toBeDefined();
    expect(createdVertical!.id).toBe('TEST_VERTICAL');
  });

  it('should close when escape key is pressed', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));
    component.onEscapeKeyDown();
    expect(closed).toBe(true);
  });
});
