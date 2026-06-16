import { Injectable } from '@angular/core';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Injector } from '@angular/core';
import type { ErrorHandler } from '@angular/core';
import { SweetAlertService } from '@core/services/sweet-alert.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: unknown): void {
    // Technical log for developer diagnostics
    console.error('[Global Error Intercepted]:', error);

    // Gracefully notify the user without crashing or locking the screen
    try {
      const sweetAlert = this.injector.get(SweetAlertService);
      sweetAlert.error(
        '¡Ups! Algo salió mal',
        'El sistema ha experimentado una anomalía inesperada. Nos hemos degradado de forma segura; puedes seguir utilizando la aplicación.'
      );
    } catch (err) {
      console.error('Failed to notify via SweetAlert:', err);
    }
  }
}
