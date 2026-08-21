import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const FERRETERIA_CONSTRUCCION_PRESET: BusinessVerticalDefinition = {
  id: 'FERRETERIA_CONSTRUCCION',
  name: 'Ferretería & Construcción',
  icon: 'bi-tools',
  description: 'Herramientas eléctricas y manuales, fijaciones, pintura y electricidad.',
  bannerTitle: 'Herramientas Profesionales para Obras y Hogar',
  bannerSubtitle: 'Maquinaria de alta durabilidad, insumos técnicos y asesoramiento experto.',
  heroImages: [
    'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'electricas', name: 'Herramientas Eléctricas', slug: 'herramientas-electricas', imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'electricas', name: 'Herramientas Eléctricas', slug: 'herramientas-electricas', order: 1, filterableAttributes: ['potencia', 'bateria'] },
    { id: 'manuales', name: 'Herramientas Manuales', slug: 'herramientas-manuales', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'potencia', name: 'Potencia', code: 'potencia', type: 'select', values: ['650W', '800W', '1200W', '20V Max'], required: false },
    { id: 'bateria', name: 'Alimentación', code: 'bateria', type: 'select', values: ['A Batería Litio', 'Cable 220V'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Taladro Atornillador Inalámbrico Brushless 20V',
      categorySlug: 'herramientas-electricas',
      price: 145000,
      stock: 25,
      skuPrefix: 'FER-TAL',
      description: 'Motor sin carbones de alto rendimiento con 2 baterías de 2.0Ah y cargador rápido.',
      image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
