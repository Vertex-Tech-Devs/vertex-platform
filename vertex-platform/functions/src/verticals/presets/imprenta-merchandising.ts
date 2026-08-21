import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const IMPRENTA_MERCHANDISING_PRESET: BusinessVerticalDefinition = {
  id: 'IMPRENTA_MERCHANDISING',
  name: 'Imprenta & Merchandising',
  icon: 'bi-printer',
  description: 'Impresión digital, gigantografías, remeras personalizadas, tazas y packaging.',
  bannerTitle: 'Soluciones Gráficas y Merchandising Corporativo',
  bannerSubtitle: 'Impresión offset digital de alta resolución, corte láser y branding promocional.',
  heroImages: [
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'corporativo', name: 'Merchandising', slug: 'merchandising', imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'corporativo', name: 'Merchandising & Regalos', slug: 'merchandising', order: 1, filterableAttributes: ['pack-unidades'] },
    { id: 'papeleria-comercial', name: 'Papelería Comercial', slug: 'papeleria-comercial', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'pack-unidades', name: 'Cantidad / Tirada', code: 'pack-unidades', type: 'select', values: ['Pack x25', 'Pack x50', 'Pack x100'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Tazas de Cerámica Importada Personalizadas Full Color',
      categorySlug: 'merchandising',
      price: 95000,
      stock: 50,
      skuPrefix: 'IMP-TAZ',
      description: 'Sublimación de alta durabilidad apta para microondas y lavavajillas.',
      image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'IMP-TAZ-25', price: 95000, stock: 25, attributes: { 'pack-unidades': 'Pack x25' } },
        { sku: 'IMP-TAZ-50', price: 175000, stock: 25, attributes: { 'pack-unidades': 'Pack x50' } },
      ],
    },
  ],
};
