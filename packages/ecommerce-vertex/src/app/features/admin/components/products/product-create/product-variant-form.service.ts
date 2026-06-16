import { Injectable, inject } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { FormBuilder, Validators } from '@angular/forms';
import type { WithFieldValue } from '@angular/fire/firestore';
import type { Attribute } from '@core/models/attribute.model';
import type { Product, ProductVariant } from '@core/models/product.model';

export interface ProductVariantFormValue {
  id: string | null;
  attributes: Record<string, string>;
  stock: number;
}

export interface ProductFormValue {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  image: string;
  images: string[];
  variantAttributes: string[];
  variants: ProductVariantFormValue[];
}

export interface EditVariantChanges {
  toUpdate: (Partial<ProductVariant> & { id: string })[];
  toAdd: WithFieldValue<Omit<ProductVariant, 'id' | 'productId'>>[];
  toDelete: string[];
}

@Injectable({ providedIn: 'root' })
export class ProductVariantFormService {
  private fb = inject(FormBuilder);

  createVariantGroup(selectedIds: string[], variant?: ProductVariant): FormGroup {
    const attributesGroup = this.fb.group({});
    selectedIds.forEach((id) => {
      attributesGroup.addControl(
        id,
        this.fb.control(variant?.attributes[id] ?? null, Validators.required)
      );
    });
    return this.fb.group({
      id: [variant?.id ?? null],
      attributes: attributesGroup,
      stock: [variant?.stock ?? 0, [Validators.required, Validators.min(0)]],
    });
  }

  generateCombinations(attributes: Attribute[]): Record<string, string>[] {
    if (!attributes.length) {
      return [];
    }
    let result: Record<string, string>[] = [{}];
    attributes.forEach((attr) => {
      const next: Record<string, string>[] = [];
      result.forEach((existing) => {
        attr.values.forEach((value) => next.push({ ...existing, [attr.id!]: value }));
      });
      result = next;
    });
    return result;
  }

  buildEditChanges(
    formVariants: ProductVariantFormValue[],
    initialVariants: ProductVariant[]
  ): EditVariantChanges {
    const toUpdate: (Partial<ProductVariant> & { id: string })[] = [];
    const toAdd: WithFieldValue<Omit<ProductVariant, 'id' | 'productId'>>[] = [];
    const currentIds = new Set<string>();

    formVariants.forEach((v) => {
      if (v.id) {
        toUpdate.push({ id: v.id, attributes: v.attributes, stock: v.stock });
        currentIds.add(v.id);
      } else {
        toAdd.push({ attributes: v.attributes, stock: v.stock });
      }
    });

    const toDelete = initialVariants.filter((iv) => !currentIds.has(iv.id)).map((iv) => iv.id);

    return { toUpdate, toAdd, toDelete };
  }

  buildProductData(formValue: ProductFormValue): WithFieldValue<Omit<Product, 'id'>> {
    return {
      name: formValue.name,
      description: formValue.description,
      price: formValue.price,
      categoryId: formValue.categoryId,
      image: formValue.image,
      images: formValue.images ?? [],
      variantAttributes: formValue.variantAttributes ?? [],
      createdAt: new Date(),
      totalStock: 0,
      inStockAttributes: {},
    };
  }
}
