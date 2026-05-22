import type { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Ocurrió un error de red o del servidor.';
      
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Error de cliente: ${error.error.message}`;
      } else {
        // Backend error
        errorMessage = `Error de servidor (${error.status}): ${error.message}`;
      }
      
      console.error('[HTTP Error]', errorMessage, {
        url: req.url,
        method: req.method,
        status: error.status,
        statusText: error.statusText,
        error: error.error
      });
      
      return throwError(() => error);
    })
  );
};
