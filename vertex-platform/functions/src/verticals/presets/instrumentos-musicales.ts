import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const INSTRUMENTOS_MUSICALES_PRESET: BusinessVerticalDefinition = {
  id: 'INSTRUMENTOS_MUSICALES',
  name: 'Instrumentos Musicales',
  icon: 'bi-music-note-beamed',
  description: 'Guitarras eléctricas, acústicas, teclados sintetizadores y audio pro.',
  bannerTitle: 'Pasión por la Música y Sonido Profesional',
  bannerSubtitle: 'Instrumentos de precisión, amplificación valvular e interfaces de grabación.',
  heroImages: [
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'guitarras', name: 'Guitarras Eléctricas', slug: 'guitarras', imageUrl: 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'guitarras', name: 'Guitarras & Bajos', slug: 'guitarras', order: 1, filterableAttributes: ['acabado'] },
    { id: 'teclados', name: 'Teclados & Pianos Digitales', slug: 'teclados', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'acabado', name: 'Color / Acabado', code: 'acabado', type: 'color', values: ['Sunburst Vintage', 'Negro Ébano', 'Blanco Olímpico'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Guitarra Eléctrica Custom Alder Body HH',
      categorySlug: 'guitarras',
      price: 650000,
      stock: 10,
      skuPrefix: 'MUS-GTR',
      description: 'Cuerpo de aliso seleccionado, mástil de arce tostado y micrófonos Humbucker cerámicos.',
      image: 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
