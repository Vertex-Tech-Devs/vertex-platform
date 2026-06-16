import { Injectable, signal, computed, effect, inject } from '@angular/core';
import type { Product, ProductVariant } from '@core/models/product.model';
import type { Cart, CartItem } from '@core/models/cart.model';
import { SweetAlertService } from './sweet-alert.service';
import { AttributeService } from './attribute.service';
import { take } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private sweetAlertService = inject(SweetAlertService);
  private attributeService = inject(AttributeService);
  private readonly CART_STORAGE_KEY = `cart_${environment.tenantId}`;

  private attributeMap = new Map<string, string>();
  cart = signal<Cart>(this.getCartFromStorage());

  itemCount = computed(() => this.cart().items.reduce((acc, item) => acc + item.quantity, 0));

  constructor() {
    this.loadAttributes();
    effect(() => {
      this.saveCartToStorage(this.cart());
    });
  }

  private loadAttributes(): void {
    this.attributeService
      .getAttributes()
      .pipe(take(1))
      .subscribe((attrs) => {
        attrs.forEach((attr) => {
          if (attr.id) {
            this.attributeMap.set(attr.id, attr.name);
          }
        });
      });
  }

  private getCartFromStorage(): Cart {
    try {
      const cartJson = localStorage.getItem(this.CART_STORAGE_KEY);
      if (cartJson) {
        const cart = JSON.parse(cartJson) as Cart;
        if (!cart.items) {
          return { items: [], total: 0 };
        }
        return cart;
      }
    } catch (error) {
      console.error('Error reading cart from localStorage', error);
      localStorage.removeItem(this.CART_STORAGE_KEY);
    }
    return { items: [], total: 0 };
  }

  private saveCartToStorage(cart: Cart): void {
    try {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to localStorage', error);
    }
  }

  private calculateTotal(items: CartItem[]): number {
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }

  getVariantDescription(attributes: { [key: string]: string }): string {
    if (this.attributeMap.size === 0) {
      this.loadAttributes();
    }

    return Object.entries(attributes)
      .map(([id, value]) => {
        const name = this.attributeMap.get(id) ?? id;
        return `${name}: ${value}`;
      })
      .join(' / ');
  }

  addItem(product: Product, variant: ProductVariant, quantity: number): void {
    if (quantity > variant.stock) {
      this.sweetAlertService.error(
        'Stock insuficiente',
        `No puedes añadir ${quantity}. Stock disponible: ${variant.stock}.`
      );
      return;
    }

    const cartItemId = variant.id;

    this.cart.update((currentCart) => {
      const existingItem = currentCart.items.find((item) => item.id === cartItemId);
      let newItems: CartItem[];

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > variant.stock) {
          this.sweetAlertService.error(
            'Stock insuficiente',
            `No puedes añadir más. Stock disponible: ${variant.stock}.`
          );
          return currentCart;
        }
        newItems = currentCart.items.map((item) =>
          item.id === cartItemId ? { ...item, quantity: newQuantity } : item
        );
      } else {
        const variantDescription = this.getVariantDescription(variant.attributes);
        const newItem: CartItem = {
          id: cartItemId,
          productId: product.id,
          variantId: variant.id,
          name: `${product.name} (${variantDescription})`,
          price: product.price,
          quantity,
          image: variant.image ?? product.image,
          attributes: variant.attributes,
          stock: variant.stock,
        };
        newItems = [...currentCart.items, newItem];
      }
      this.sweetAlertService.success('¡Añadido!', 'Producto añadido al carrito.');
      return { items: newItems, total: this.calculateTotal(newItems) };
    });
  }

  updateQuantity(itemId: string, quantity: number): void {
    this.cart.update((currentCart) => {
      const itemToUpdate = currentCart.items.find((item) => item.id === itemId);
      let newQuantity = quantity;

      if (!itemToUpdate) {
        return currentCart;
      }

      if (newQuantity > itemToUpdate.stock) {
        newQuantity = itemToUpdate.stock;
        this.sweetAlertService.error(
          'Stock insuficiente',
          `Solo quedan ${itemToUpdate.stock} unidades de este producto.`
        );
      }

      if (newQuantity < 1) {
        newQuantity = 1;
      }

      const newItems = currentCart.items.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      );

      return { items: newItems, total: this.calculateTotal(newItems) };
    });
  }

  removeItem(itemId: string): void {
    this.cart.update((currentCart) => {
      const newItems = currentCart.items.filter((item) => item.id !== itemId);
      this.sweetAlertService.success('Eliminado', 'El producto ha sido eliminado del carrito.');
      return { items: newItems, total: this.calculateTotal(newItems) };
    });
  }

  clearCart(): void {
    this.cart.set({ items: [], total: 0 });
  }
}
