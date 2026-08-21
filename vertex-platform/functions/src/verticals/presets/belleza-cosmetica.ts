import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const BELLEZA_COSMETICA_PRESET: BusinessVerticalDefinition = {
  id: 'BELLEZA_COSMETICA',
  name: 'Belleza & Cosmética',
  icon: 'bi-flower1',
  description: 'Skincare, maquillaje, cuidado capilar y perfumería.',
  bannerTitle: 'Cuidado Personal y Belleza Natural',
  bannerSubtitle: 'Fórmulas dermatológicas y cruelty-free para el cuidado de tu piel y cabello.',
  heroImages: [
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'facial', name: 'Cuidado Facial', slug: 'facial', imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'facial', name: 'Cuidado Facial & Serums', slug: 'facial', order: 1, filterableAttributes: ['tipo-piel', 'volumen'] },
    { id: 'capilar', name: 'Cuidado Capilar', slug: 'capilar', order: 2, filterableAttributes: ['tipo-cabello'] },
  ],
  attributes: [
    { id: 'tipo-piel', name: 'Tipo de Piel', code: 'tipo-piel', type: 'select', values: ['Todo Tipo de Piel', 'Piel Grasa', 'Piel Seca', 'Piel Sensible'], required: true },
    { id: 'volumen', name: 'Volumen', code: 'volumen', type: 'button', values: ['30 ml', '50 ml', '100 ml'], required: false },
    { id: 'tipo-cabello', name: 'Tipo de Cabello', code: 'tipo-cabello', type: 'select', values: ['Seco/Dañado', 'Graso', 'Rulos/Ondas'], required: false },
  ],
  sampleProducts: [
    {
      name: 'Serum Facial Niacinamida 10% + Zinc',
      categorySlug: 'facial',
      price: 24500,
      stock: 45,
      skuPrefix: 'SER-NIA',
      description: 'Minimiza poros, unifica el tono y regula la producción de sebo.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
