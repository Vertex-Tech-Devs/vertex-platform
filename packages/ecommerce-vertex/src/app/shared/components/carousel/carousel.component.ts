import type { OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';
import type { HeroImage } from '@core/models/home-content.model';

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideAnimation', [
      state('in', style({ opacity: 1, transform: 'translateX(0)' })),
      transition('* => *', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate('500ms ease-in-out'),
      ]),
    ]),
  ],
})
export class CarouselComponent implements OnInit, OnDestroy {
  @Input()
  images: HeroImage[] = [];
  @Input()
  interval: number = 4000;
  @Input()
  showIndicators: boolean = true;
  @Input()
  showArrows: boolean = true;
  @Input()
  set aspectRatio(value: string) {
    this._aspectRatio = value;
  }
  get aspectRatio(): string {
    return this._aspectRatio;
  }
  private _aspectRatio: string = '16 / 9';

  @HostBinding('style.--carousel-aspect-ratio')
  get carouselAspectRatio(): string {
    return this._aspectRatio;
  }

  currentIndex: number = 0;
  isAutoplayActive: boolean = true;
  private cdr = inject(ChangeDetectorRef);
  private autoplayInterval: ReturnType<typeof setInterval> | null = null;
  private touchStartX: number = 0;
  private touchEndX: number = 0;

  ngOnInit(): void {
    if (this.images.length > 1) {
      this.startAutoplay();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  private startAutoplay(): void {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
    }
    this.isAutoplayActive = true;
    this.autoplayInterval = setInterval(() => {
      this.nextSlide();
    }, this.interval);
  }

  private stopAutoplay(): void {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
    }
    this.isAutoplayActive = false;
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.images.length > 1) {
      this.stopAutoplay();
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (this.images.length > 1) {
      this.startAutoplay();
    }
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    if (this.images.length > 1) {
      this.stopAutoplay();
    }
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].clientX;
    this.handleSwipe();
    if (this.images.length > 1) {
      this.startAutoplay();
    }
  }

  private handleSwipe(): void {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        this.nextSlide();
      } else {
        this.prevSlide();
      }
    }
  }

  nextSlide(): void {
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    this.cdr.markForCheck();
  }

  prevSlide(): void {
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
    this.cdr.markForCheck();
  }

  goToSlide(index: number): void {
    this.currentIndex = index;
    this.cdr.markForCheck();
    if (this.images.length > 1) {
      this.stopAutoplay();
      this.startAutoplay();
    }
  }

  get currentImage(): HeroImage | null {
    return this.images[this.currentIndex] || null;
  }

  get slideProgress(): number {
    return ((this.currentIndex + 1) / this.images.length) * 100;
  }

  getRoute(image: HeroImage | null): string[] | null {
    if (!image) {
      return null;
    }
    if (image.linkType === 'product' && image.linkId) {
      return ['/shop/product', image.linkId];
    }
    if (image.linkType === 'category' && image.linkId) {
      return ['/shop/catalog'];
    }
    return null;
  }

  getQueryParams(image: HeroImage | null): Record<string, string> | null {
    if (!image) {
      return null;
    }
    if (image.linkType === 'category' && image.linkId) {
      return { category: image.linkId };
    }
    return null;
  }
}
