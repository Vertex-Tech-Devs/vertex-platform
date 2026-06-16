import { z } from 'zod';

export const OrderItemSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  productName: z.string(),
  quantity: z.number().positive(),
  price: z.number().positive(),
  productImage: z.string().optional(),
  attributes: z.record(z.string(), z.string()),
});

export const OrderSchema = z.object({
  clientName: z.string().min(1, "El nombre del cliente es requerido."),
  clientEmail: z.string().email("El email del cliente no es válido."),
  clientPhone: z.string().min(8, "El teléfono del cliente es requerido."),
  items: z.array(OrderItemSchema).min(1, "El pedido debe contener al menos un ítem."),
  total: z.number(),
  status: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;