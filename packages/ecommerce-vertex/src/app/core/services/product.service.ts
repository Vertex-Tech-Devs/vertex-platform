import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import type { Observable } from 'rxjs';
import { from } from 'rxjs';
import { map, combineLatest, switchMap, of, catchError } from 'rxjs';
import { Firestore, collectionData, docData } from '@angular/fire/firestore';
import type {
  WithFieldValue,
  QueryConstraint,
  CollectionReference,
  DocumentReference,
  DocumentData,
} from 'firebase/firestore';
import {
  doc,
  collection,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import type { Product, ProductVariant } from '../models/product.model';
import { convertTimestampsToDates } from '@core/utils/date-converter';
import { tenantPath } from '@core/utils/tenant';

export interface ProductFilters {
  categoryId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  includeOutOfStock?: boolean;
  dynamicFilters: { [key: string]: string[] };
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private firestore: Firestore = inject(Firestore);
  private injector = inject(Injector);
  private readonly collectionName = 'products';

  private get collectionRef(): CollectionReference<DocumentData> {
    return collection(this.firestore, tenantPath(this.collectionName));
  }

  private get legacyCollectionRef(): CollectionReference<DocumentData> {
    return collection(this.firestore, this.collectionName);
  }

  getProducts(): Observable<Product[]> {
    return runInInjectionContext(this.injector, () => {
      return from(getDocs(this.collectionRef)).pipe(
        switchMap((snap) =>
          snap.empty
            ? (collectionData(this.legacyCollectionRef, { idField: 'id' }) as Observable<Product[]>)
            : (collectionData(this.collectionRef, { idField: 'id' }) as Observable<Product[]>)
        ),
        map((items) => items.map((item) => convertTimestampsToDates(item) as Product)),
        catchError((err) => {
          console.warn('Unable to load products:', err);
          return of([]);
        })
      );
    });
  }

  getProductsByQuery(categoryId: string | null): Observable<Product[]> {
    return runInInjectionContext(this.injector, () => {
      const constraints: QueryConstraint[] = [];
      if (categoryId && categoryId !== 'all') {
        constraints.push(where('categoryId', '==', categoryId));
      }
      return from(getDocs(this.collectionRef)).pipe(
        switchMap((snap) => {
          const ref = snap.empty ? this.legacyCollectionRef : this.collectionRef;
          const q = query(ref, ...constraints);
          return collectionData(q, { idField: 'id' }) as Observable<Product[]>;
        }),
        map((items) => items.map((item) => convertTimestampsToDates(item) as Product)),
        catchError((err) => {
          console.warn(`Unable to load products with query category ${categoryId}:`, err);
          return of([]);
        })
      );
    });
  }

  getProductById(id: string): Observable<Product | undefined> {
    return runInInjectionContext(this.injector, () => {
      const tenantDocRef: DocumentReference<DocumentData> = doc(
        this.firestore,
        tenantPath(this.collectionName),
        id
      );
      const legacyDocRef: DocumentReference<DocumentData> = doc(
        this.firestore,
        this.collectionName,
        id
      );
      return from(getDoc(tenantDocRef)).pipe(
        switchMap((snap) =>
          snap.exists()
            ? (docData(tenantDocRef, { idField: 'id' }) as Observable<Product | undefined>)
            : (docData(legacyDocRef, { idField: 'id' }) as Observable<Product | undefined>)
        ),
        map((item) => (item ? (convertTimestampsToDates(item) as Product) : undefined)),
        catchError((err) => {
          console.warn(`Unable to load product ${id}:`, err);
          return of(undefined);
        })
      );
    });
  }

  getProductWithVariants(
    id: string
  ): Observable<{ product: Product; variants: ProductVariant[] } | undefined> {
    return runInInjectionContext(this.injector, () => {
      const product$ = this.getProductById(id);
      const productRef = doc(this.firestore, tenantPath(this.collectionName), id);
      const variantsCollectionRef = collection(productRef, 'variants');
      const variants$ = (
        collectionData(variantsCollectionRef, { idField: 'id' }) as Observable<ProductVariant[]>
      ).pipe(
        catchError((err) => {
          console.warn(`Unable to load variants for product ${id}:`, err);
          return of([]);
        })
      );

      return combineLatest([product$, variants$]).pipe(
        map(([product, variants]) => {
          if (!product) {
            return undefined;
          }
          return {
            product,
            variants: variants.map((v) => convertTimestampsToDates(v) as ProductVariant),
          };
        }),
        catchError((err) => {
          console.warn(`Unable to resolve product and variants combined for product ${id}:`, err);
          return of(undefined);
        })
      );
    });
  }

  async createProductWithVariants(
    product: WithFieldValue<Omit<Product, 'id'>>,
    variants: WithFieldValue<Omit<ProductVariant, 'id' | 'productId'>>[]
  ): Promise<string> {
    const batch = writeBatch(this.firestore);
    const newProductRef = doc(this.collectionRef);

    batch.set(newProductRef, product);

    variants.forEach((variantData) => {
      const newVariantRef = doc(collection(newProductRef, 'variants'));
      const variantWithId: WithFieldValue<Omit<ProductVariant, 'id'>> = {
        ...variantData,
        productId: newProductRef.id,
      };
      batch.set(newVariantRef, variantWithId);
    });

    await batch.commit();
    return newProductRef.id;
  }

  async updateProductWithVariants(
    productId: string,
    productData: Partial<Product>,
    variantsToUpdate: (Partial<ProductVariant> & { id: string })[],
    variantsToAdd: WithFieldValue<Omit<ProductVariant, 'id' | 'productId'>>[],
    variantIdsToDelete: string[]
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    const productRef = doc(this.firestore, tenantPath(this.collectionName), productId);

    batch.update(productRef, productData);

    const variantsCollectionRef = collection(productRef, 'variants');

    variantsToUpdate.forEach((variant) => {
      const variantRef = doc(variantsCollectionRef, variant.id);
      batch.update(variantRef, variant);
    });

    variantsToAdd.forEach((variantData) => {
      const newVariantRef = doc(variantsCollectionRef);
      const variantWithId: WithFieldValue<Omit<ProductVariant, 'id'>> = {
        ...variantData,
        productId,
      };
      batch.set(newVariantRef, variantWithId);
    });

    variantIdsToDelete.forEach((variantId) => {
      const variantRef = doc(variantsCollectionRef, variantId);
      batch.delete(variantRef);
    });

    return batch.commit();
  }

  deleteProduct(id: string): Promise<void> {
    const docRef = doc(this.firestore, tenantPath(this.collectionName), id);
    return deleteDoc(docRef);
  }

  getProductsLowInStock(threshold: number = 5): Observable<Product[]> {
    return runInInjectionContext(this.injector, () => {
      const q = query(
        this.collectionRef,
        where('totalStock', '>', 0),
        where('totalStock', '<=', threshold),
        orderBy('totalStock', 'asc')
      );
      return (collectionData(q, { idField: 'id' }) as Observable<Product[]>).pipe(
        map((items) => items.map((item) => convertTimestampsToDates(item) as Product)),
        catchError((err) => {
          console.warn('Unable to load products low in stock:', err);
          return of([]);
        })
      );
    });
  }

  getLatestProducts(count: number = 10): Observable<Product[]> {
    return runInInjectionContext(this.injector, () => {
      const q = query(this.collectionRef, orderBy('createdAt', 'desc'), limit(count));
      return (collectionData(q, { idField: 'id' }) as Observable<Product[]>).pipe(
        map((items) => items.map((item) => convertTimestampsToDates(item) as Product)),
        catchError((err) => {
          console.warn('Unable to load latest products:', err);
          return of([]);
        })
      );
    });
  }

  checkStockAvailability(
    productId: string,
    variantId: string,
    quantity: number
  ): Observable<boolean> {
    return runInInjectionContext(this.injector, () => {
      const productRef = doc(this.firestore, tenantPath(this.collectionName), productId);
      const variantRef = doc(collection(productRef, 'variants'), variantId);
      return (docData(variantRef) as Observable<{ stock?: number } | undefined>).pipe(
        map((variant) => {
          if (!variant) {
            return false;
          }
          return (variant.stock ?? 0) >= quantity;
        }),
        catchError((err) => {
          console.warn(
            `Unable to check stock availability for variant ${variantId} of product ${productId}:`,
            err
          );
          return of(false);
        })
      );
    });
  }
}
