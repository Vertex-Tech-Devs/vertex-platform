import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy } from '@angular/router';
import type { RouterStateSnapshot } from '@angular/router';

import { StoreConfigService } from '@core/services/store-config.service';

@Injectable()
export class StoreTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly storeConfig = inject(StoreConfigService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    const storeName = this.storeConfig.storeName();
    if (routeTitle) {
      this.title.setTitle(storeName ? `${routeTitle} | ${storeName}` : routeTitle);
    } else if (storeName) {
      this.title.setTitle(storeName);
    }
  }
}
