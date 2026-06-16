import { z } from "zod";

export const ProductVariantSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  sku: z.string().optional(),
  attributes: z.record(z.string(), z.string()),
  stock: z.number().min(0),
  image: z.string().url().nullable().optional(),
});