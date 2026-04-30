import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp } from '@angular/fire/app';
import { initializeApp } from 'firebase/app';

import { environment } from '@environments/environment';
import { routes } from './app.routes';
import { AuthService } from '@core/services/auth.service';

// Initialize Firebase once — services use getAuth()/getFirestore() directly
export const firebaseApp = initializeApp(environment.firebaseConfig);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),

    provideFirebaseApp(() => firebaseApp),

    provideAppInitializer(() => { inject(AuthService); }),
  ],
};
