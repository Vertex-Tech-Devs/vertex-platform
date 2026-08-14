import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ShardStatusModal } from './shard-status-modal';
import type { ShardReadiness } from '@core/services/stores';

function makeShard(overrides: Partial<ShardReadiness> = {}): ShardReadiness {
  return {
    id: 'shard-development-abc',
    projectId: 'vtx-sd-abc12345',
    status: 'WARMUP_READY',
    billingAccountId: '016AC2-299E39-51C8BF',
    redirectUri: 'https://vtx-sd-abc12345.firebaseapp.com/__/auth/handler',
    ready: true,
    missing: [],
    checkedAt: new Date().toISOString(),
    ...overrides,
  };
}

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

  it('muestra "Shard listo" y "Todo configurado" para un shard ready', () => {
    fixture.componentRef.setInput('shard', makeShard());
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Shard listo');
    expect(text).toContain('Todo configurado');
  });

  it('no renderiza contenido cuando no hay shard', () => {
    fixture.componentRef.setInput('shard', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.modal-card')).toBeNull();
  });

  it('lista el paso a paso del redirect URI para un shard incompleto', () => {
    fixture.componentRef.setInput('shard', makeShard({ ready: false, missing: ['redirect_uri'] }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('Shard incompleto');
    expect(text).toContain('Redirect URI sin registrar');
    expect(text).toContain('redirect_uri_mismatch');
    expect(text).toContain('https://vtx-sd-abc12345.firebaseapp.com/__/auth/handler');
    expect(text).toContain('ecommerce-vertex-dev');
    // los enlaces están en href (no en textContent)
    const consoleLink = el.querySelector('a[href*="console.cloud.google.com/apis/credentials"]');
    expect(consoleLink).toBeTruthy();
  });

  it('lista el paso a paso de billing para un shard sin billing', () => {
    fixture.componentRef.setInput(
      'shard',
      makeShard({ ready: false, missing: ['billing'], billingAccountId: '' }),
    );
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('Billing no vinculado');
    expect(text).toContain('gcloud billing projects link');
    const supportLink = el.querySelector('a[href*="billing_quota_increase"]');
    expect(supportLink).toBeTruthy();
  });

  it('lista el paso a paso de estado para WARMUP_PROVISIONING', () => {
    fixture.componentRef.setInput(
      'shard',
      makeShard({ ready: false, missing: ['status'], status: 'WARMUP_PROVISIONING' }),
    );
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Estado no utilizable');
    expect(text).toContain('WARMUP_PROVISIONING');
  });

  it('explica que un shard FULL vuelve a ACTIVE al liberar cupo', () => {
    fixture.componentRef.setInput(
      'shard',
      makeShard({ ready: false, missing: ['status'], status: 'FULL' }),
    );
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('FULL');
    expect(text).toContain('vuelve a ACTIVE');
  });

  it('usar prod cambia el proyecto master a ecommerce-vertex', () => {
    fixture.componentRef.setInput('shard', makeShard({ ready: false, missing: ['redirect_uri'] }));
    fixture.componentRef.setInput('environment', 'production');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ecommerce-vertex');
    expect(text).not.toContain('ecommerce-vertex-dev');
  });

  it('copia el redirect URI al clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await component.copy('https://vtx-sd-abc12345.firebaseapp.com/__/auth/handler');
    expect(writeText).toHaveBeenCalledWith(
      'https://vtx-sd-abc12345.firebaseapp.com/__/auth/handler',
    );
    expect(component.copied()).toBe(true);
  });

  it('emite closed al hacer click en el backdrop', () => {
    const closedSpy = vi.fn();
    const sub = component.closed.subscribe(closedSpy);
    fixture.componentRef.setInput('shard', makeShard());
    fixture.detectChanges();
    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
    backdrop.dispatchEvent(new Event('click'));
    expect(closedSpy).toHaveBeenCalled();
    sub.unsubscribe();
  });

  it('emite closed con el botón Cerrar del footer', () => {
    const closedSpy = vi.fn();
    const sub = component.closed.subscribe(closedSpy);
    fixture.componentRef.setInput('shard', makeShard());
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const close = [...buttons].find((b: Element) => (b.textContent ?? '').includes('Cerrar'));
    (close as HTMLButtonElement).click();
    expect(closedSpy).toHaveBeenCalled();
    sub.unsubscribe();
  });

  it('title devuelve etiquetas para cada razón', () => {
    expect(component.title('redirect_uri')).toContain('Redirect URI');
    expect(component.title('billing')).toContain('Billing');
    expect(component.title('status')).toContain('Estado');
    expect(component.title('unknown' as never)).toBe('unknown');
  });

  it('masterProject/envShort/consoleUrl dependen del entorno', () => {
    expect(component.masterProject()).toBe('ecommerce-vertex-dev');
    expect(component.envShort()).toBe('dev');
    expect(component.consoleUrl()).toContain('ecommerce-vertex-dev');
    fixture.componentRef.setInput('environment', 'production');
    expect(component.masterProject()).toBe('ecommerce-vertex');
    expect(component.envShort()).toBe('prod');
  });

  it('copy no falla si el clipboard no está disponible', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
      configurable: true,
    });
    await component.copy('https://x.firebaseapp.com/__/auth/handler');
    expect(component.copied()).toBe(false);
  });
});
