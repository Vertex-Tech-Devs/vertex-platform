import type { ApplicationConfig } from '@angular/core';
import {
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideFirebaseApp } from '@angular/fire/app';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

import { environment } from '@environments/environment';
import { routes } from './app.routes';
import { AuthService } from '@core/services/auth';
import { GlobalErrorHandler } from '@core/services/error-reporter';

export const firebaseApp = initializeApp(environment.firebaseConfig);
const db = initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true });

const isLocal = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if (isLocal) {
  const auth = getAuth(firebaseApp);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  const fns = getFunctions(firebaseApp);
  connectFunctionsEmulator(fns, 'localhost', 5001);
}

if (!environment.production) {
  (
    self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string }
  ).FIREBASE_APPCHECK_DEBUG_TOKEN = environment.appCheckDebugToken;
} else if (environment.appCheckSiteKey) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(environment.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),

    provideFirebaseApp(() => firebaseApp),

    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(() => {
      inject(AuthService);
    }),
  ],
};
