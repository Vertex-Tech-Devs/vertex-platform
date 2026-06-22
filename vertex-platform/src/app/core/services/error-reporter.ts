import { type ErrorHandler, Injectable, isDevMode } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));

    // Always log to console with full stack trace
    console.error('[Error]', err.message, err.stack);

    if (!isDevMode()) {
      this.report(err).catch(() => {});
    }
  }

  private async report(error: Error): Promise<void> {
    if (!environment.errorReportingUrl) {
      return;
    }

    const body = JSON.stringify({
      message: error.message,
      stack: error.stack ?? '',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // sendBeacon works even during page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(environment.errorReportingUrl, blob);
    } else {
      await fetch(environment.errorReportingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  }
}
