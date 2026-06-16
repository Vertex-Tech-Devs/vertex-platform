import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { of, switchMap, combineLatest } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Product, ProductVariant } from '@core/models/product.model';
import { ProductService } from '@core/services/product.service';
import { CartService } from '@core/services/cart.service';
import { AttributeService } from '@core/services/attribute.service';
import type { Attribute } from '@core/models/attribute.model';

interface AttributeSelection {
  id: string;
  name: string;
  values: string[];
  allValues: string[];
  selectedValue: string | null;
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private attributeService = inject(AttributeService);
  private destroyRef = inject(DestroyRef);

  product = signal<Product | undefined>(undefined);
  variants = signal<ProductVariant[]>([]);
  quantity = signal(1);

  mainImage = signal('');
  galleryImages = signal<string[]>([]);

  attributes = signal<AttributeSelection[]>([]);
  selectedVariant = signal<ProductVariant | null | undefined>(undefined);

  allAttributes = signal<Attribute[]>([]);
  private allPossibleValues = new Map<string, string[]>();

  constructor() {
    this.loadProductData();
  }

  private loadProductData(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const productId = params.get('id');
          if (productId) {
            return combineLatest({
              productData: this.productService.getProductWithVariants(productId),
              attributes: this.attributeService.getAttributes(),
            });
          }
          return of(null);
        })
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        if (data?.productData) {
          this.product.set(data.productData.product);
          this.variants.set(data.productData.variants.filter((v) => v.stock > 0));
          this.allAttributes.set(data.attributes);

          const product = this.product();
          if (product) {
            this.mainImage.set(product.image);
            this.galleryImages.set([product.image, ...(product.images ?? [])]);
            this.initializeAttributes();
          }
        }
      });
  }

  private initializeAttributes(): void {
    const product = this.product();
    if (!product?.variantAttributes) {
      this.selectedVariant.set(null);
      return;
    }

    this.allPossibleValues.clear();

    const variants = this.variants();
    const attributeSelections: AttributeSelection[] = product.variantAttributes.map((attrId) => {
      const attr = this.allAttributes().find((a) => a.id === attrId);
      const attrName = attr?.name ?? attrId;

      const allValuesForAttr = [...new Set(variants.map((v) => v.attributes[attrId]))].sort();
      this.allPossibleValues.set(attrId, allValuesForAttr);

      return {
        id: attrId,
        name: attrName,
        values: allValuesForAttr,
        allValues: allValuesForAttr,
        selectedValue: null,
      };
    });

    this.attributes.set(attributeSelections);

    if (product.variantAttributes.length === 0 && variants.length === 1) {
      this.selectedVariant.set(variants[0]);
    } else {
      this.selectedVariant.set(undefined);
    }
  }

  selectAttribute(attributeId: string, value: string): void {
    this.attributes.update((currentAttributes) =>
      currentAttributes.map((attr) => {
        if (attr.id === attributeId) {
          return { ...attr, selectedValue: attr.selectedValue === value ? null : value };
        }
        return attr;
      })
    );

    this.updateAvailableOptions();
    this.findSelectedVariant();
  }

  private updateAvailableOptions(): void {
    const selectedAttributes = this.attributes()
      .filter((a) => a.selectedValue)
      .reduce(
        (acc, a) => {
          acc[a.id] = a.selectedValue;
          return acc;
        },
        {} as { [key: string]: string | null }
      );

    this.attributes.update((currentAttributes) =>
      currentAttributes.map((attr) => {
        const otherSelectedAttributes = { ...selectedAttributes };
        delete otherSelectedAttributes[attr.id];

        const possibleVariants = this.variants().filter((v) => {
          return Object.entries(otherSelectedAttributes).every(
            ([attrId, value]) => v.attributes[attrId] === value
          );
        });

        const availableValues = [...new Set(possibleVariants.map((v) => v.attributes[attr.id]))];

        let newSelectedValue = attr.selectedValue;
        if (attr.selectedValue && !availableValues.includes(attr.selectedValue)) {
          newSelectedValue = null;
        }

        return { ...attr, values: availableValues.sort(), selectedValue: newSelectedValue };
      })
    );
  }

  private findSelectedVariant(): void {
    const allSelected = this.attributes().every((a) => a.selectedValue);
    if (!allSelected) {
      this.selectedVariant.set(undefined);
      return;
    }

    const selection = this.attributes().reduce(
      (acc, a) => {
        acc[a.id] = a.selectedValue;
        return acc;
      },
      {} as { [key: string]: string | null }
    );

    const variant = this.variants().find((v) => {
      return Object.entries(selection).every(([key, value]) => v.attributes[key] === value);
    });

    this.selectedVariant.set(variant ?? null);
    if (variant) {
      this.mainImage.set(variant.image ?? this.product()?.image ?? '');
      this.quantity.set(1);
    }
  }

  getValuesForAttribute(attr: AttributeSelection): string[] {
    // First try to get from allPossibleValues (generated from variants)
    const variantValues = this.allPossibleValues.get(attr.id) ?? [];

    // If no variants have values yet, show all possible values from the attribute definition
    if (variantValues.length === 0) {
      const allAttr = this.allAttributes().find((a) => a.id === attr.id);
      return allAttr?.values ?? [];
    }

    return variantValues;
  }

  isOptionVisible(attributeId: string, value: string): boolean {
    const attr = this.attributes().find((a) => a.id === attributeId);
    if (!attr) {
      return false;
    }

    // If no variants exist yet, show all values
    if (this.variants().length === 0) {
      const allAttr = this.allAttributes().find((a) => a.id === attributeId);
      return allAttr?.values.includes(value) ?? false;
    }

    // Otherwise check if value is in available values for this attribute
    return attr.values.includes(value);
  }

  changeMainImage(image: string): void {
    this.mainImage.set(image);
  }

  decreaseQuantity(): void {
    this.quantity.update((q) => (q > 1 ? q - 1 : 1));
  }

  increaseQuantity(): void {
    const variant = this.selectedVariant();
    if (variant) {
      this.quantity.update((q) => (q < variant.stock ? q + 1 : q));
    }
  }

  addToCart(): void {
    const product = this.product();
    const variant = this.selectedVariant();
    if (product && variant) {
      this.cartService.addItem(product, variant, this.quantity());
    }
  }

  get isMaxQuantityReached(): boolean {
    const variant = this.selectedVariant();
    return !variant || this.quantity() >= (variant.stock || 1);
  }
}
