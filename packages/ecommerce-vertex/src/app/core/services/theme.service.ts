import { inject, Injectable, effect } from '@angular/core';
import { StoreConfigService } from './store-config.service';

interface ConfigWithTheme {
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontId?: string;
  };
  colors?: {
    primary?: string;
    accent?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private configService = inject(StoreConfigService);

  constructor() {
    effect(() => {
      const config = this.configService.storeConfig() as unknown as ConfigWithTheme | null;
      if (config) {
        const root = document.documentElement;

        // Extract primary, secondary colors and font safely with default Vertex fallbacks using ??
        const primaryColor = config.theme?.primaryColor ?? config.colors?.primary ?? '#ea580c';
        const secondaryColor = config.theme?.secondaryColor ?? config.colors?.accent ?? '#ef4444';
        const fontId = config.theme?.fontId ?? 'Inter';

        root.style.setProperty('--color-primary', primaryColor);
        root.style.setProperty('--color-accent', secondaryColor);
        root.style.setProperty('--font-family', fontId);
      }
    });
  }
}
