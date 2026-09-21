import { describe, expect, it } from 'vitest';
import { createProductSchema, updateProductSchema } from './product.schema';

const base = { name: 'Producto', price: 1000 };

describe('producto simple con stock directo (#361)', () => {
  it('1. producto simple válido (hasAttributes false + stock 12, sin variantes)', () => {
    const result = createProductSchema.safeParse({ ...base, hasAttributes: false, stock: 12 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stock).toBe(12);
      expect(result.data.variants).toBeUndefined();
    }
  });

  it('2. falla si hasAttributes=false y no se envía stock', () => {
    const result = createProductSchema.safeParse({ ...base, hasAttributes: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['stock']);
      expect(result.error.issues[0].message).toBe(
        'El stock es obligatorio para productos sin atributos',
      );
    }
  });

  it('3. falla si el stock es negativo', () => {
    const result = createProductSchema.safeParse({ ...base, hasAttributes: false, stock: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['stock']);
      expect(result.error.issues[0].message).toBe('El stock no puede ser negativo');
    }
  });

  it('4. retrocompatibilidad: producto con variantes sin declarar hasAttributes', () => {
    const result = createProductSchema.safeParse({
      ...base,
      variants: [{ attributes: { Talle: 'M' }, stock: 3 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasAttributes).toBe(true);
      expect(result.data.variants).toHaveLength(1);
    }
  });

  it('4b. retrocompatibilidad: producto con atributos sin variantes falla', () => {
    const result = createProductSchema.safeParse({ ...base });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['variants']);
    }
  });

  it('5. actualización parcial de stock en producto simple', () => {
    const result = updateProductSchema.safeParse({ stock: 7 });
    expect(result.success).toBe(true);
  });

  it('5b. actualización que marca hasAttributes=false sin stock falla', () => {
    const result = updateProductSchema.safeParse({ hasAttributes: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['stock']);
    }
  });
});
