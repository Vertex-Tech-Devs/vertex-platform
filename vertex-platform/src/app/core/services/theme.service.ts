import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'vertex-platform.theme';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/**
 * Tema dual (Material 3): 'light' | 'dark' | 'system'.
 * Aplica el tema resuelto como `data-theme` en <html> y persiste la elección.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(readStoredMode());

  readonly resolved = computed<ResolvedTheme>(() => {
    if (this.mode() === 'light') {
      return 'light';
    }
    if (this.mode() === 'dark') {
      return 'dark';
    }
    return systemPrefersDark() ? 'dark' : 'light';
  });

  private media: MediaQueryList | null = null;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.media = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (this.mode() === 'system') {
          this.apply();
        }
      };
      if (typeof this.media.addEventListener === 'function') {
        this.media.addEventListener('change', onChange);
      } else if (typeof this.media.addListener === 'function') {
        (this.media as unknown as { addListener(fn: () => void): void }).addListener(onChange);
      }
    }
    this.apply();
  }

  setMode(next: ThemeMode): void {
    this.mode.set(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* almacenamiento no disponible */
      }
    }
    this.apply();
  }

  toggle(): void {
    this.setMode(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private apply(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    root.setAttribute('data-theme', this.resolved());
    // Micro-frame para que la transición no parpadee en el primer paint.
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 320);
  }
}
