import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

let _activeRequests = 0;

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  _activeRequests++;
  if (_activeRequests === 1) {
    loadingService.show();
  }

  return next(req).pipe(
    finalize(() => {
      _activeRequests--;
      if (_activeRequests === 0) {
        loadingService.hide();
      }
    })
  );
};
