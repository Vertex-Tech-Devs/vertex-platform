import { DOCUMENT } from '@angular/common';
import { Injectable, inject, effect } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Title } from '@angular/platform-browser';

import { StoreConfigService } from './store-config.service';
import type { StoreConfig } from '@core/models/store-config.model';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta = inject(Meta);
  private title = inject(Title);
  private document = inject(DOCUMENT);
  private storeConfig = inject(StoreConfigService);

  constructor() {
    effect(() => {
      const cfg = this.storeConfig.storeConfig();
      if (cfg) {
        this.applyMeta(cfg);
      }
    });
  }

  private applyMeta(cfg: StoreConfig): void {
    const title = cfg.storeName;
    const description = cfg.seo.metaDescription?.trim() || cfg.tagline || cfg.storeName;

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:site_name', content: cfg.storeName });
    if (cfg.logoUrl) {
      this.meta.updateTag({ property: 'og:image', content: cfg.logoUrl });
    }

    this.updateFavicon(cfg.faviconUrl);
  }

  private updateFavicon(faviconUrl?: string): void {
    if (!faviconUrl) {
      return;
    }

    let link = this.document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'icon';
      this.document.head.appendChild(link);
    }

    link.href = faviconUrl;
  }
}
