import type { ApplicationConfig } from '@angular/core';
import { importProvidersFrom, ErrorHandler, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withComponentInputBinding, TitleStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { FirebaseOptions } from 'firebase/app';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';
import { provideFunctions } from '@angular/fire/functions';
import { provideStorage } from '@angular/fire/storage';

import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import type { Firestore } from 'firebase/firestore';

import { ModalModule } from 'ngx-bootstrap/modal';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { StoreConfigService } from './core/services/store-config.service';
import { SeoService } from './core/services/seo.service';
import { StoreTitleStrategy } from './core/strategies/store-title.strategy';
import { GlobalErrorHandler } from './core/handlers/global-error.handler';
import { routes } from './app.routes';

export function createAppConfig(firebaseConfig: FirebaseOptions): ApplicationConfig {
  const createFirestore = (): Firestore => {
    const app = getApp();
    const isCypress =
      typeof window !== 'undefined' && (window as unknown as { Cypress?: unknown }).Cypress;
    try {
      if (isCypress) {
        return getFirestore(app);
      }
      return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    } catch {
      return getFirestore(app);
    }
  };

  return {
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withInterceptors([loadingInterceptor, httpErrorInterceptor])),

      provideFirebaseApp(() => initializeApp(firebaseConfig)),
      provideAuth(() => getAuth()),
      provideFirestore(() => createFirestore()),
      provideFunctions(() => getFunctions()),
      provideStorage(() => getStorage()),

      importProvidersFrom(ModalModule.forRoot()),

      {
        provide: APP_INITIALIZER,
        useFactory: (configService: StoreConfigService) => (): Promise<void> =>
          configService.loadConfig(),
        deps: [StoreConfigService],
        multi: true,
      },
      {
        provide: APP_INITIALIZER,
        useFactory: (_seoService: SeoService) => (): void => {},
        deps: [SeoService],
        multi: true,
      },
      { provide: TitleStrategy, useClass: StoreTitleStrategy },
      { provide: ErrorHandler, useClass: GlobalErrorHandler },
    ],
  };
}
