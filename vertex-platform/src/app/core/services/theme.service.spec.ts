import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ThemeService (tema dual)', () => {
  let prefersDark = true;

  beforeEach(() => {
    window.localStorage.clear();
    prefersDark = true;
    const listeners: Array<() => void> = [];
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        get matches() {
          return query.includes('dark') ? prefersDark : !prefersDark;
        },
        media: query,
        addEventListener: (_t: string, cb: () => void) => listeners.push(cb),
        addListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      })),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('por defecto sigue al sistema (dark) y aplica data-theme', async () => {
    const { ThemeService } = await import('./theme.service');
    const svc = new ThemeService();
    expect(svc.mode()).toBe('system');
    expect(svc.resolved()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sigue al sistema en modo claro cuando el SO no prefiere dark', async () => {
    prefersDark = false;
    const { ThemeService } = await import('./theme.service');
    const svc = new ThemeService();
    expect(svc.mode()).toBe('system');
    expect(svc.resolved()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggle alterna claro/oscuro, persiste y aplica en <html>', async () => {
    const { ThemeService } = await import('./theme.service');
    const svc = new ThemeService();
    svc.toggle();
    expect(svc.mode()).toBe('light');
    expect(svc.resolved()).toBe('light');
    expect(window.localStorage.getItem('vertex-platform.theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    svc.setMode('dark');
    expect(svc.resolved()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('recupera la preferencia persistida al instanciar y permite volver a system', async () => {
    window.localStorage.setItem('vertex-platform.theme', 'light');
    const { ThemeService } = await import('./theme.service');
    const svc = new ThemeService();
    expect(svc.mode()).toBe('light');
    expect(svc.resolved()).toBe('light');

    svc.setMode('system');
    expect(svc.mode()).toBe('system');
    expect(window.localStorage.getItem('vertex-platform.theme')).toBe('system');
    expect(svc.resolved()).toBe('dark');
  });

  it('trata valores de storage inválidos como system (sin romper)', async () => {
    window.localStorage.setItem('vertex-platform.theme', 'blue');
    const { ThemeService } = await import('./theme.service');
    const svc = new ThemeService();
    expect(svc.mode()).toBe('system');
    expect(['light', 'dark']).toContain(svc.resolved());
  });
});
