export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  variantId: string;
  productName: string;
  quantity: number;
  price: number;
  productImage?: string;
  attributes: { [key: string]: string };
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface PaymentDetails {
  paymentMethod: string;
  shippingCost: number;
  taxAmount: number;
  subtotal: number;
  paymentId?: string;
}

export interface Order {
  id: string;
  userId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  orderDate: Date;
  total: number;
  status: OrderStatus;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  paymentDetails?: PaymentDetails;
  mercadopago_preference_id?: string;
  mercadopago_init_point?: string;
  mercadopago_expiration_date?: Date;
  stockDecremented?: boolean;
  notes?: string;
}
