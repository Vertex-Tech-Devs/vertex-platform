import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShardStatusModal } from './shard-status-modal';
import type { ShardReadiness } from '@core/models/shard-capacity';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ShardStatusModal', () => {
  let fixture: ComponentFixture<ShardStatusModal>;
  let component: ShardStatusModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShardStatusModal],
    }).compileComponents();

    fixture = TestBed.createComponent(ShardStatusModal);
    component = fixture.componentInstance;
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('calcula URLs, short env y project maestro según environment prod/dev', () => {
    fixture.componentRef.setInput('environment', 'production');
    expect(component.masterProject()).toBe('ecommerce-vertex');
    expect(component.masterClientId()).toContain('488126647984');
    expect(component.envShort()).toBe('prod');
    expect(component.consoleUrl()).toContain('project=ecommerce-vertex');

    fixture.componentRef.setInput('environment', 'development');
    expect(component.masterProject()).toBe('ecommerce-vertex-dev');
    expect(component.masterClientId()).toContain('988454979046');
    expect(component.envShort()).toBe('dev');
    expect(component.consoleUrl()).toContain('project=ecommerce-vertex-dev');
  });

  it('devuelve títulos descriptivos para cada tipo de razón faltante', () => {
    expect(component.title('redirect_uri')).toContain('Redirect URI');
    expect(component.title('billing')).toContain('Billing');
    expect(component.title('status')).toContain('Estado');
  });

  it('copia el texto al portapapeles y maneja valor vacío', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    component.copy('');
    expect(component.copied()).toBe(false);

    component.copy('https://vtx-test.firebaseapp.com');
    expect(component.copied()).toBe(true);
  });

  it('emite closed al hacer click en el botón de cerrar', () => {
    const readyShard: ShardReadiness = {
      id: 'shard-test',
      projectId: 'vtx-test',
      billingAccountId: '016AC2-299E39-51C8BF',
      redirectUri: 'https://vtx-test.firebaseapp.com/__/auth/handler',
      status: 'ACTIVE',
      ready: true,
      missing: [],
      checkedAt: new Date().toISOString(),
    };
    fixture.componentRef.setInput('shard', readyShard);
    fixture.detectChanges();

    const spy = vi.fn();
    component.closed.subscribe(spy);

    const closeBtn = fixture.nativeElement.querySelector('.modal-card__close') as HTMLButtonElement;
    closeBtn.click();

    expect(spy).toHaveBeenCalled();
  });
});
