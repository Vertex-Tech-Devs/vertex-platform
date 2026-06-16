import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, updateDoc } from '@angular/fire/firestore';
import type { Attribute } from '@core/models/attribute.model';
import { PRODUCT_CATALOGUE } from '../constants/seed-products.constants';
import { tenantPath } from '@core/utils/tenant';

/** Unsplash CDN – specific fashion photo by ID */
function u(id: string, w: number, h: number): string {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;
}

export interface SeedProduct {
  id: string;
  name: string;
  finalPrice: number;
  image: string;
  categoryName: string;
}

@Injectable({ providedIn: 'root' })
export class SeedProductsService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private generateVariantCombinations(
    attributes: Attribute[],
    variantAttrIds: string[]
  ): Record<string, string>[] {
    const selectedAttrs = attributes.filter(
      (a): a is Attribute & { id: string } => a.id !== undefined && variantAttrIds.includes(a.id)
    );
    if (selectedAttrs.length === 0) {
      return [];
    }

    let result: Record<string, string>[] = [{}];

    selectedAttrs.forEach((attr) => {
      const newResult: Record<string, string>[] = [];
      result.forEach((existing) => {
        attr.values.forEach((value) => {
          newResult.push({ ...existing, [attr.id]: value });
        });
      });
      result = newResult;
    });

    return result;
  }

  async seedProducts(cats: Record<string, { id: string; name: string }>): Promise<SeedProduct[]> {
    const seeded: SeedProduct[] = [];

    const attrsSnap = await this.run(() =>
      getDocs(collection(this.firestore, tenantPath('attributes')))
    );
    const allAttrs = attrsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data['name'] as string,
        values: (data['values'] ?? []) as string[],
      } as Attribute;
    });

    const attrNameToId: Record<string, string> = {};
    allAttrs.forEach((attr) => {
      if (!attr.id) {
        return;
      }
      attrNameToId[attr.name] = attr.id;
      if (attr.name.includes('(')) {
        const slug = attr.name.split('(')[0].trim().toLowerCase();
        attrNameToId[slug] = attr.id;
      }
    });

    for (const cat of PRODUCT_CATALOGUE) {
      const catData = cats[cat.slug];
      if (!catData) {
        continue;
      }

      // Limit to 3 products per category to keep seed data lean
      const itemsToSeed = cat.items.slice(0, 3);
      for (const item of itemsToSeed) {
        const mainImg = u(item.imgs[0], 600, 600);
        const extraImgs = item.imgs.slice(1).map((id) => u(id, 600, 600));
        const fp =
          item.discount > 0 ? Math.round(item.price * (1 - item.discount / 100)) : item.price;

        const productRef = await this.run(() =>
          addDoc(collection(this.firestore, tenantPath('products')), {
            name: item.name,
            description: item.desc,
            categoryId: catData.id,
            price: item.price,
            discount: item.discount,
            finalPrice: fp,
            image: mainImg,
            images: [mainImg, ...extraImgs],
            totalStock: 0,
            inStockAttributes: {},
            variantAttributes: cat.variants.map((v) => attrNameToId[v]).filter(Boolean),
            featured: item.featured,
            active: true,
            createdAt: new Date(),
          })
        );

        const variantAttrIds = cat.variants.map((v) => attrNameToId[v]).filter(Boolean);

        if (variantAttrIds.length > 0) {
          const combinations = this.generateVariantCombinations(allAttrs, variantAttrIds);
          let totalStock = 0;
          const inStockAttributes: Record<string, string[]> = {};

          for (const combo of combinations) {
            const stock = Math.floor(Math.random() * 80) + 5;
            totalStock += stock;

            Object.entries(combo).forEach(([attrId, value]) => {
              if (!inStockAttributes[attrId]) {
                inStockAttributes[attrId] = [];
              }
              if (!inStockAttributes[attrId].includes(value)) {
                inStockAttributes[attrId].push(value);
              }
            });

            await this.run(() =>
              addDoc(collection(productRef, 'variants'), {
                attributes: combo,
                stock,
                productId: productRef.id,
              })
            );
          }

          await this.run(() => updateDoc(productRef, { totalStock, inStockAttributes }));
        }

        seeded.push({
          id: productRef.id,
          name: item.name,
          finalPrice: fp,
          image: mainImg,
          categoryName: catData.name,
        });
      }
    }
    return seeded;
  }
}
