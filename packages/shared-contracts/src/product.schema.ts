import { z } from 'zod';

/**
 * Variante de producto (talle/color/medida). Se usa cuando el producto tiene atributos.
 */
export const ProductVariantSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  storeId: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().min(0).optional(),
  attributes: z.record(z.string(), z.string()).default({}),
  stock: z.number().int().min(0, 'El stock no puede ser negativo'),
  image: z.string().url().nullable().optional(),
});

/**
 * Producto con soporte de inventario simple (#361):
 * - `hasAttributes: false` → `stock` numérico a nivel raíz OBLIGATORIO y variantes opcionales.
 * - `hasAttributes` ausente/true → validación histórica (variantes con atributos).
 */
export const productBaseSchema = z.object({
  id: z.string().optional(),
  storeId: z.string().optional(),
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  price: z.number().min(0, 'El precio no puede ser negativo'),
  currency: z.string().optional(),
  image: z.string().url().nullable().optional(),
  /** Producto sin atributos (talle/color) => stock directo a nivel raíz. */
  hasAttributes: z.boolean().optional().default(true),
  /** Inventario numérico directo para productos simples. */
  stock: z.number().int().min(0, 'El stock no puede ser negativo').optional(),
  variants: z.array(ProductVariantSchema).optional(),
});

export const ProductSchema = productBaseSchema.superRefine((product, ctx) => {
    const hasAttributes = product.hasAttributes !== false;
    const variants = product.variants ?? [];

    if (!hasAttributes) {
      // Producto simple: el stock raíz es obligatorio y las variantes no se exigen.
      if (product.stock === undefined || product.stock === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['stock'],
          message: 'El stock es obligatorio para productos sin atributos',
        });
      }
      return;
    }

    // Producto con atributos: validación histórica (variantes con atributos y stock).
    if (variants.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message: 'Los productos con atributos requieren al menos una variante',
      });
      return;
    }
    variants.forEach((variant, index) => {
      if (Object.keys(variant.attributes ?? {}).length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', index, 'attributes'],
          message: 'Cada variante debe declarar al menos un atributo',
        });
      }
    });
  });

/** Creación de producto (mismas reglas que el contrato base). */
export const createProductSchema = ProductSchema;

/** Actualización parcial: `{ stock }` solo es válido para productos simples. */
export const updateProductSchema = productBaseSchema.partial().superRefine((product, ctx) => {
  if (product.hasAttributes === false && (product.stock === undefined || product.stock === null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['stock'],
      message: 'El stock es obligatorio para productos sin atributos',
    });
  }
});

export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
