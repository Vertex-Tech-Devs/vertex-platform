import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const DIETETICA_NATURISTA_PRESET: BusinessVerticalDefinition = {
  id: 'DIETETICA_NATURISTA',
  name: 'Dietética & Naturista',
  icon: 'bi-egg-fried',
  description: 'Frutos secos, harinas integrales, semillas, productos sin TACC y orgánicos.',
  bannerTitle: 'Alimentación Consciente y Productos Saludables',
  bannerSubtitle: 'Frutos secos seleccionados, cereales integrales y opciones 100% veganas y sin TACC.',
  heroImages: [
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'frutos-secos', name: 'Frutos Secos', slug: 'frutos-secos', imageUrl: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'frutos-secos', name: 'Frutos Secos & Semillas', slug: 'frutos-secos', order: 1, filterableAttributes: ['fraccionado'] },
    { id: 'sin-tacc', name: 'Alimentos Sin TACC', slug: 'sin-tacc', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'fraccionado', name: 'Presentación', code: 'fraccionado', type: 'button', values: ['250g', '500g', '1 kg'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Mix Frutos Secos Premium (Nueces, Almendras, Castañas)',
      categorySlug: 'frutos-secos',
      price: 14500,
      stock: 60,
      skuPrefix: 'DIE-MIX',
      description: 'Cosecha del año, sin sal agregada ni conservantes artificiales.',
      image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'DIE-MIX-500', price: 14500, stock: 30, attributes: { fraccionado: '500g' } },
        { sku: 'DIE-MIX-1KG', price: 26500, stock: 30, attributes: { fraccionado: '1 kg' } },
      ],
    },
  ],
};
