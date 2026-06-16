import { z } from 'zod';

export const PaymentRequestSchema = z.object({
  external_reference: z.string().min(1, "La referencia externa (orderId) es requerida."),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().min(1),
      title: z.string(),
      quantity: z.number().positive(),
      unit_price: z.number().positive(),
    })
  ).min(1, "La solicitud debe incluir al menos un producto."),
});

export type PaymentRequestData = z.infer<typeof PaymentRequestSchema>;