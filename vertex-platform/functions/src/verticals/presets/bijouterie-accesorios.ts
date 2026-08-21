import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const BIJOUTERIE_ACCESORIOS_PRESET: BusinessVerticalDefinition = {
  id: 'BIJOUTERIE_ACCESORIOS',
  name: 'Bijouterie & Accesorios',
  icon: 'bi-handbag',
  description: 'Carteras de cuero, mochilas urbanas, billeteras, pañuelos y bijouterie fina.',
  bannerTitle: 'Accesorios, Marroquinería y Estilo Urbano',
  bannerSubtitle: 'Complementos de moda y marroquinería de alta confección para tu día a día.',
  heroImages: [
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'carteras', name: 'Carteras & Bolsos', slug: 'carteras', imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'carteras', name: 'Carteras & Bandoleras', slug: 'carteras', order: 1, filterableAttributes: ['color'] },
    { id: 'billeteras', name: 'Billeteras & Tarjeteros', slug: 'billeteras', order: 2, filterableAttributes: ['color'] },
  ],
  attributes: [
    { id: 'color', name: 'Color', code: 'color', type: 'color', values: ['Negro', 'Suela / Caramelo', 'Bordeaux', 'Verde Bosque'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Bandolera de Cuero Vacuno Suela con Correa Regulable',
      categorySlug: 'carteras',
      price: 58000,
      stock: 25,
      skuPrefix: 'BIJ-BAN',
      description: 'Forrería interior de gabardina estampada con cierre metálico reforzado YKK.',
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
