import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const SUPERMERCADO_ALMACEN_PRESET: BusinessVerticalDefinition = {
  id: 'SUPERMERCADO_ALMACEN',
  name: 'Supermercado & Almacén',
  icon: 'bi-cart',
  description: 'Alimentos secos, bebidas, frescos, lácteos y productos de limpieza.',
  bannerTitle: 'Tus Compras Cotidianas, Más Simples',
  bannerSubtitle: 'Variedad de marcas, precios convenientes y entregas rápidas.',
  heroImages: [
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'almacen', name: 'Almacén', slug: 'almacen', imageUrl: 'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'almacen', name: 'Almacén & Despensa', slug: 'almacen', order: 1, filterableAttributes: ['pack'] },
    { id: 'limpieza', name: 'Cuidado del Hogar & Limpieza', slug: 'limpieza', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'pack', name: 'Formato / Pack', code: 'pack', type: 'select', values: ['Unidad (500g)', 'Pack x3', 'Pack Familiar x6'], required: false },
  ],
  sampleProducts: [
    {
      name: 'Aceite de Oliva Extra Virgen 500ml',
      categorySlug: 'almacen',
      price: 12500,
      stock: 80,
      skuPrefix: 'ALM-OLI',
      description: 'Primera prensada en frío con acidez menor a 0.5%.',
      image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
