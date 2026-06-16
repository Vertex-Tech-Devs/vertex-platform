import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule } from '@angular/router';

import type { HeroBanner } from '@core/models/home-content.model';
import type { Product } from '@core/models/product.model';
import { HomeContentService } from '@core/services/home-content.service';
import { ProductService } from '@core/services/product.service';
import { CarouselComponent } from '@shared/components/carousel/carousel.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe, CarouselComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  private homeContentService = inject(HomeContentService);
  private productService = inject(ProductService);

  // Signals: undefined = loading, null = no data, value = loaded
  readonly heroBanner = signal<HeroBanner | null | undefined>(undefined);
  readonly newArrivals = signal<Product[] | undefined>(undefined);

  readonly bannerLoading = computed(() => this.heroBanner() === undefined);
  readonly productsLoading = computed(() => this.newArrivals() === undefined);

  ngOnInit(): void {
    this.homeContentService.getHeroBanner().subscribe({
      next: (data) => this.heroBanner.set(data),
      error: () => this.heroBanner.set(null),
    });

    this.productService.getLatestProducts(10).subscribe({
      next: (data) => this.newArrivals.set(data),
      error: () => this.newArrivals.set([]),
    });
  }

  isCarousel(banner: HeroBanner | null | undefined): boolean {
    return banner?.heroImages ? banner.heroImages.length > 1 : false;
  }

  getStaticImage(banner: HeroBanner | null | undefined): string | undefined {
    return banner?.heroImages?.[0]?.imageUrl ?? banner?.imageUrl ?? undefined;
  }
}
