import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, getDocs, deleteDoc, doc } from '@angular/fire/firestore';
import { SweetAlertService } from './sweet-alert.service';
import { SeedContentService } from './seed-content.service';
import { SeedProductsService } from './seed-products.service';
import { SeedOrdersService } from './seed-orders.service';
import { tenantPath } from '@core/utils/tenant';

@Injectable({ providedIn: 'root' })
export class SeedDataService {
  private firestore = inject(Firestore);
  private sweetAlert = inject(SweetAlertService);
  private injector = inject(EnvironmentInjector);

  private contentService = inject(SeedContentService);
  private productsService = inject(SeedProductsService);
  private ordersService = inject(SeedOrdersService);

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  async seedAllData(): Promise<void> {
    this.sweetAlert.loading('Regenerando datos…');
    try {
      await this.clearAll();
      await this.contentService.seedAttributes();
      const cats = await this.contentService.seedCategories();
      const prods = await this.productsService.seedProducts(cats);
      const clients = await this.ordersService.seedClients();
      await this.ordersService.seedOrders(prods, clients);
      await this.contentService.seedHeroBanner(cats);
      await this.contentService.seedAboutUs();
      await this.contentService.seedFooter();

      this.sweetAlert.close();
      this.sweetAlert.success('¡Listo!', 'Base de datos regenerada con todos los datos de prueba.');
    } catch (err) {
      console.error('Seed error:', err);
      this.sweetAlert.error('Error', 'Revisá la consola para más detalles.');
    }
  }

  private async clearAll(): Promise<void> {
    const cols = ['products', 'categories', 'clients', 'orders', 'attributes'];
    for (const col of cols) {
      const snap = await this.run(() => getDocs(collection(this.firestore, tenantPath(col))));
      for (const d of snap.docs) {
        await this.run(() => deleteDoc(d.ref));
      }
    }
    for (const [c, d] of [
      ['siteContent', 'homePage'],
      ['pages', 'aboutUs'],
    ] as const) {
      await this.run(() => deleteDoc(doc(this.firestore, tenantPath(c), d)));
    }
  }
}
