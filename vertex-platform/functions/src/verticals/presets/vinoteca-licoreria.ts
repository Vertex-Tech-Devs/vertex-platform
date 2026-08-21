import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const VINOTECA_LICORERIA_PRESET: BusinessVerticalDefinition = {
  id: 'VINOTECA_LICORERIA',
  name: 'Vinoteca & Licorería',
  icon: 'bi-cup-straw',
  description: 'Vinos de autor, espumantes, destilados premium, whiskies y gins artesanales.',
  bannerTitle: 'Vinos de Autor y Destilados de Colección',
  bannerSubtitle: 'Selección exclusiva de bodegas boutique y destilerías artesanales premiadas.',
  heroImages: [
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'vinos', name: 'Vinos Tintos', slug: 'tintos', imageUrl: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'vinos', name: 'Vinos Tintos & Blancos', slug: 'vinos', order: 1, filterableAttributes: ['varietal', 'cosecha'] },
    { id: 'destilados', name: 'Gins & Whiskies', slug: 'destilados', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'varietal', name: 'Varietal / Cepa', code: 'varietal', type: 'select', values: ['Malbec Gran Reserva', 'Cabernet Franc', 'Pinot Noir', 'Chardonnay'], required: true },
    { id: 'cosecha', name: 'Cosecha', code: 'cosecha', type: 'button', values: ['2020', '2021', '2022', '2023'], required: false },
  ],
  sampleProducts: [
    {
      name: 'Malbec Gran Reserva Valle de Uco 750ml',
      categorySlug: 'vinos',
      price: 28500,
      stock: 48,
      skuPrefix: 'VIN-MAL',
      description: '18 meses de crianza en barricas de roble francés. Notas a frutos rojos maduros y vainilla.',
      image: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
