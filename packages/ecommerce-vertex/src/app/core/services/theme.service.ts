import { inject, Injectable, effect } from '@angular/core';
import { StoreConfigService } from './store-config.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private configService = inject(StoreConfigService);

  constructor() {
    effect(() => {
      const config = this.configService.storeConfig();
      if (config) {
        const root = document.documentElement;
        const primaryColor = config.colorPrimary ?? '#ea580c';
        const secondaryColor = config.colorAccent ?? '#ef4444';
        const fontId = 'Inter'; // Default system font fallback

        root.style.setProperty('--color-primary', primaryColor);
        root.style.setProperty('--color-accent', secondaryColor);
        root.style.setProperty('--font-family', fontId);
      }
    });
  }
}
