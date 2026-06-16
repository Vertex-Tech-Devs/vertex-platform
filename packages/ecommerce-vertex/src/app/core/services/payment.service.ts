import { Injectable, inject } from '@angular/core';
import type { CartItem } from '@core/models/cart.model';
import { Functions, httpsCallable } from '@angular/fire/functions';

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
  init_point?: string;
}

interface RequestData {
  items: {
    productId: string;
    variantId: string;
    title: string;
    quantity: number;
    unit_price: number;
  }[];
  external_reference: string;
}

interface PreferenceResponseData {
  id: string;
  init_point: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private functions: Functions = inject(Functions);

  private async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) {
        throw error;
      }
      console.warn(
        `[Mercado Pago Retry] Falló la conexión con Mercado Pago. Reintentando en ${delay}ms... Intentos restantes: ${retries}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }

  async initiatePayment(items: CartItem[], orderId: string): Promise<PaymentResponse> {
    try {
      const preferenceItems = items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        title: item.name,
        quantity: item.quantity,
        unit_price: Number(item.price),
      }));

      const createPaymentPreference = httpsCallable<RequestData, PreferenceResponseData>(
        this.functions,
        'createPaymentPreference'
      );

      const result = await this.retryWithBackoff(() =>
        createPaymentPreference({
          items: preferenceItems,
          external_reference: orderId,
        })
      );

      return {
        success: true,
        init_point: result.data.init_point,
      };
    } catch (error: unknown) {
      console.error('Error al crear la preferencia de pago:', error);
      return {
        success: false,
        error: (error as Error).message || 'Error al conectar con el servicio de pago.',
      };
    }
  }
}
