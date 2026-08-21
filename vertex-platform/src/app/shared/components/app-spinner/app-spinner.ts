import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Spinner reutilizable del panel — animación continua con anillos concéntricos.
 *
 * Uso:
 *   <app-spinner size="sm" label="Desplegando…" />
 *   <app-spinner size="md" />
 *   <app-spinner size="lg" label="Aprovisionando tienda…" />
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="app-spinner"
      [class]="'app-spinner--' + size()"
      role="status"
      aria-label="{{ label() || 'Cargando…' }}"
    >
      <span class="app-spinner__ring app-spinner__ring--outer"></span>
      <span class="app-spinner__ring app-spinner__ring--inner"></span>
      @if (size() === 'lg') {
        <span class="app-spinner__ring app-spinner__ring--core"></span>
      }
    </span>
    @if (label()) {
      <span class="app-spinner__label">{{ label() }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        vertical-align: middle;
      }
      .app-spinner {
        position: relative;
        display: inline-block;
        flex-shrink: 0;
      }
      .app-spinner__ring {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 2px solid transparent;
      }
      .app-spinner__ring--outer {
        border-top-color: currentColor;
        border-right-color: currentColor;
        animation: app-spin 0.9s linear infinite;
      }
      .app-spinner__ring--inner {
        inset: 22%;
        border-bottom-color: currentColor;
        border-left-color: currentColor;
        animation: app-spin 1.3s linear infinite reverse;
      }
      .app-spinner__ring--core {
        inset: 40%;
        background: currentColor;
        border-radius: 50%;
        opacity: 0.35;
        animation: app-pulse 1.3s ease-in-out infinite;
      }
      .app-spinner--sm {
        width: 0.9rem;
        height: 0.9rem;
      }
      .app-spinner--md {
        width: 1.35rem;
        height: 1.35rem;
      }
      .app-spinner--lg {
        width: 2.2rem;
        height: 2.2rem;
      }
      .app-spinner__label {
        font-size: 0.85rem;
        color: inherit;
        opacity: 0.85;
      }
      @keyframes app-spin {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes app-pulse {
        0%,
        100% {
          opacity: 0.25;
          transform: scale(0.85);
        }
        50% {
          opacity: 0.5;
          transform: scale(1.05);
        }
      }
    `,
  ],
})
export class AppSpinner {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly label = input<string>('');
}
