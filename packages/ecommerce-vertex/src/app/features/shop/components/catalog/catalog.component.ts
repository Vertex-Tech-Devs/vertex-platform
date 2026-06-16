import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import type { FormGroup, FormControl } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import type { Observable } from 'rxjs';
import { take } from 'rxjs';
import { startWith, debounceTime } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import type { Product } from '@core/models/product.model';
import type { Category } from '@core/models/category.model';
import type { Attribute } from '@core/models/attribute.model';
import { ProductService } from '@core/services/product.service';
import { CategoryService } from '@core/services/category.service';
import { AttributeService } from '@core/services/attribute.service';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe, ReactiveFormsModule],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogComponent implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private attributeService = inject(AttributeService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  // Core signals for state
  readonly categoriesSignal = signal<Category[]>([]);
  readonly allAttributes = signal<Attribute[]>([]);
  readonly activeAttributes = signal<Attribute[]>([]);
  readonly allCategories = signal<Map<string, Category>>(new Map());

  readonly sort = signal<string>('newest');
  readonly page = signal<number>(1);
  readonly itemsPerPage = signal<number>(12);
  readonly productsFromQuery = signal<Product[]>([]);
  readonly isLoading = signal<boolean>(true);

  // Signals for form values to keep computed pipeline pure
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly dynamicAttributesFilter = signal<Record<string, Record<string, boolean>>>({});
  readonly selectedCategoryId = signal<string | null>(null);

  // Properties mapped to observables for template async pipe
  readonly paginatedProducts$: Observable<Product[]>;
  readonly categories$ = toObservable(this.categoriesSignal);

  filterForm: FormGroup;
  isSidebarOpen = false;

  // Computed properties
  readonly filteredProducts = computed(() => {
    const products = this.productsFromQuery();
    const minPrice = this.minPrice();
    const maxPrice = this.maxPrice();
    const dynamicAttributes = this.dynamicAttributesFilter();

    const dynamicFilters: { [key: string]: string[] } = {};
    for (const attrId in dynamicAttributes) {
      if (Object.prototype.hasOwnProperty.call(dynamicAttributes, attrId)) {
        const valuesGroup = dynamicAttributes[attrId];
        const selectedValues = Object.keys(valuesGroup).filter((key) => valuesGroup[key]);
        if (selectedValues.length > 0) {
          dynamicFilters[attrId] = selectedValues;
        }
      }
    }

    const hasPriceFilter =
      (minPrice !== null && minPrice !== undefined) ||
      (maxPrice !== null && maxPrice !== undefined && maxPrice > 0);
    const hasDynamicFilter = Object.keys(dynamicFilters).length > 0;

    return products.filter((product) => {
      if (product.totalStock <= 0) {
        return false;
      }

      if (hasPriceFilter) {
        if (minPrice !== null && product.price < minPrice) {
          return false;
        }
        if (maxPrice !== null && maxPrice > 0 && product.price > maxPrice) {
          return false;
        }
      }

      if (hasDynamicFilter) {
        const match = Object.entries(dynamicFilters).every(([attrId, values]) => {
          const productAttributeValues = product.inStockAttributes[attrId];
          if (!productAttributeValues) {
            return false;
          }
          return values.some((val) => productAttributeValues.includes(val));
        });
        if (!match) {
          return false;
        }
      }

      return true;
    });
  });

  readonly sortedProducts = computed(() => {
    const products = this.filteredProducts();
    const sort = this.sort();
    const sorted = [...products];
    if (sort === 'priceAsc') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sort === 'priceDesc') {
      sorted.sort((a, b) => b.price - a.price);
    } else if (sort === 'newest') {
      sorted.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return dateB - dateA;
      });
    }
    return sorted;
  });

  readonly paginatedProductsSignal = computed(() => {
    const products = this.sortedProducts();
    const page = this.page();
    const itemsPerPageValue = this.itemsPerPage();

    const startIndex = (page - 1) * itemsPerPageValue;
    const endIndex = startIndex + itemsPerPageValue;
    return products.slice(startIndex, endIndex);
  });

  get totalPages(): number {
    return Math.ceil(this.sortedProducts().length / this.itemsPerPage());
  }

  get currentPage(): number {
    return this.page();
  }

  constructor() {
    this.paginatedProducts$ = toObservable(this.paginatedProductsSignal);
    this.filterForm = this.fb.group({
      category: [null],
      minPrice: [null],
      maxPrice: [null],
      dynamicAttributes: this.fb.group({}),
    });
  }

  ngOnInit(): void {
    this.loadInitialDataAndInitializeForm();
  }

  private loadInitialDataAndInitializeForm(): void {
    this.categoryService.getCategories().subscribe((categories) => {
      const categoryMap = new Map<string, Category>();
      categories.forEach((cat) => categoryMap.set(cat.id!, cat));
      this.allCategories.set(categoryMap);
      this.categoriesSignal.set(categories);
    });

    this.attributeService
      .getAttributes()
      .pipe(take(1))
      .subscribe((attrs) => {
        this.allAttributes.set(attrs);
        this.activeAttributes.set([]);

        const dynamicGroup = this.filterForm.get('dynamicAttributes') as FormGroup;
        attrs.forEach((attr) => {
          if (attr.id) {
            const controls = attr.values.reduce(
              (acc, val) => {
                acc[val] = this.fb.control(false);
                return acc;
              },
              {} as { [key: string]: FormControl }
            );
            dynamicGroup.addControl(attr.id, this.fb.group(controls));
          }
        });

        this.setupFormListeners();
        this.applyInitialCategoryFilter();
      });
  }

  private setupFormListeners(): void {
    this.filterForm.valueChanges
      .pipe(startWith(this.filterForm.value), debounceTime(200))
      .subscribe((filters) => {
        this.minPrice.set(filters.minPrice);
        this.maxPrice.set(filters.maxPrice);
        this.dynamicAttributesFilter.set(filters.dynamicAttributes ?? {});

        const newCatId = filters.category === 'all' ? null : (filters.category ?? null);
        if (this.selectedCategoryId() !== newCatId) {
          this.selectedCategoryId.set(newCatId);
          this.page.set(1);
          this.updateActiveFilters(filters.category ?? null);

          this.productService.getProductsByQuery(newCatId).subscribe((products) => {
            this.productsFromQuery.set(products);
            this.isLoading.set(false);
          });
        }
      });
  }

  private updateActiveFilters(selectedCategoryId: string | null): void {
    if (!selectedCategoryId || selectedCategoryId === 'all') {
      this.activeAttributes.set([]);
      return;
    }

    const category = this.allCategories().get(selectedCategoryId);
    if (category?.filterableAttributes) {
      const active = this.allAttributes().filter((attr) =>
        category.filterableAttributes!.includes(attr.id!)
      );
      this.activeAttributes.set(active);
    } else {
      this.activeAttributes.set([]);
    }
  }

  private applyInitialCategoryFilter(): void {
    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const categoryId = params.get('category');
      if (categoryId) {
        this.filterForm.patchValue({ category: categoryId });
      } else {
        this.filterForm.patchValue({ category: 'all' });
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  onSortChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.sort.set(selectElement.value);
    this.page.set(1);
  }

  clearFilters(): void {
    const dynamicGroup = this.filterForm.get('dynamicAttributes') as FormGroup;
    dynamicGroup.reset();
    this.filterForm.patchValue({
      category: this.filterForm.get('category')?.value,
      minPrice: null,
      maxPrice: null,
    });
    this.page.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.page.set(page);
    }
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get hasActiveFilters(): boolean {
    return this.filterForm.get('category')?.value !== 'all';
  }
}
