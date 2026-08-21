import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const HOGAR_MUEBLES_DECO_PRESET: BusinessVerticalDefinition = {
  id: 'HOGAR_MUEBLES_DECO',
  name: 'Hogar, Muebles & Decoración',
  icon: 'bi-house-door',
  description: 'Muebles de madera maciza, iluminación, textiles y objetos de diseño.',
  bannerTitle: 'Diseño, Confort y Calidez para tu Hogar',
  bannerSubtitle: 'Muebles y luminarias de diseño para transformar tus espacios cotidianos.',
  heroImages: [
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'muebles', name: 'Muebles de Madera', slug: 'muebles', imageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=600&h=400&fit=crop&q=80' },
    { categoryId: 'iluminacion', name: 'Iluminación', slug: 'iluminacion', imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'muebles', name: 'Muebles & Estanterías', slug: 'muebles', order: 1, filterableAttributes: ['madera', 'dimensiones'] },
    { id: 'iluminacion', name: 'Lámparas & Iluminación', slug: 'iluminacion', order: 2, filterableAttributes: ['material', 'color'] },
    { id: 'decoracion', name: 'Bazar & Decoración', slug: 'decoracion', order: 3, filterableAttributes: ['material'] },
  ],
  attributes: [
    { id: 'madera', name: 'Tipo de Madera', code: 'madera', type: 'select', values: ['Paraíso Natural', 'Petiribí Macizo', 'Roble'], required: true },
    { id: 'dimensiones', name: 'Medidas', code: 'dimensiones', type: 'button', values: ['120 x 60 cm', '160 x 80 cm', '180 x 90 cm'], required: false },
    { id: 'material', name: 'Material', code: 'material', type: 'select', values: ['Cerámica', 'Metal Laqueado', 'Vidrio'], required: false },
    { id: 'color', name: 'Color', code: 'color', type: 'color', values: ['Madera Natural', 'Negro Mate', 'Blanco Cálido'], required: false },
  ],
  sampleProducts: [
    {
      name: 'Mesa Ratona Orgánica Petiribí',
      categorySlug: 'muebles',
      price: 185000,
      stock: 12,
      skuPrefix: 'MUE-PET',
      description: 'Mesa baja con tapa de bordes curvos suaves en madera maciza de petiribí con hidrolaca satinada.',
      image: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'MUE-PET-120', price: 185000, stock: 6, attributes: { madera: 'Petiribí Macizo', dimensiones: '120 x 60 cm' } },
        { sku: 'MUE-PET-160', price: 235000, stock: 6, attributes: { madera: 'Petiribí Macizo', dimensiones: '160 x 80 cm' } },
      ],
    },
  ],
};
