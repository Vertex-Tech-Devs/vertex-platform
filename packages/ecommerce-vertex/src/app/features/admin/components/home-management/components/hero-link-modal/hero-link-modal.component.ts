import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { HeroImage } from '@core/models/home-content.model';
import type { Category } from '@core/models/category.model';
import type { Product } from '@core/models/product.model';

@Component({
  selector: 'app-hero-link-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'hero-link-modal.component.html',
  styleUrls: ['hero-link-modal.component.scss'],
})
export class HeroLinkModalComponent {
  @Input() isVisible = false;
  @Input() heroImage!: HeroImage;
  @Input() heroIndex = -1;
  @Input() categories: Category[] = [];
  @Input() filteredProducts: Product[] = [];
  @Input() productSearchTerm = '';

  @Output() close = new EventEmitter<void>();
  @Output() updateType = new EventEmitter<'product' | 'category' | 'none'>();
  @Output() updateId = new EventEmitter<string>();
  @Output() searchProduct = new EventEmitter<string>();

  onClose(): void {
    this.close.emit();
  }

  onTypeChange(event: Event): void {
    const type = (event.target as HTMLSelectElement).value as 'product' | 'category' | 'none';
    this.updateType.emit(type);
  }

  onIdChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.updateId.emit(id);
  }

  onSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchProduct.emit(term);
  }
}
