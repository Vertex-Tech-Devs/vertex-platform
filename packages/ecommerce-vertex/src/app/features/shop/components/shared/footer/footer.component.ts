import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreConfigService } from '@core/services/store-config.service';

@Component({
  selector: 'app-shop-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  currentYear = new Date().getFullYear();

  private storeConfig = inject(StoreConfigService);

  readonly storeName = this.storeConfig.storeName;

  readonly viewData = computed(() => {
    const config = this.storeConfig.storeConfig();
    const configuredStoreName = (config?.storeName ?? '').trim();

    return {
      contactPhone:
        config?.contactPhone ?? config?.contact?.phone ?? config?.contact?.whatsApp ?? '',
      contactEmail: config?.contactEmail ?? config?.contact?.email ?? '',
      socialInstagramUrl: config?.socialInstagramUrl ?? config?.contact?.instagram ?? '',
      socialFacebookUrl: config?.socialFacebookUrl ?? config?.contact?.facebook ?? '',
      socialWhatsAppUrl: config?.socialWhatsAppUrl ?? config?.contact?.whatsApp ?? '',
      copyrightText:
        config?.copyrightText ??
        (configuredStoreName
          ? `${configuredStoreName}. Todos los derechos reservados.`
          : 'Todos los derechos reservados.'),
    };
  });

  constructor() {}
}
