import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const AUTOMOTRIZ_REPUESTOS_PRESET: BusinessVerticalDefinition = {
  id: 'AUTOMOTRIZ_REPUESTOS',
  name: 'Automotriz & Repuestos',
  icon: 'bi-car-front',
  description: 'Lubricantes, baterías, filtros, lámparas LED y accesorios para vehículos.',
  bannerTitle: 'Repuestos Originales y Accesorios Vehiculares',
  bannerSubtitle: 'Máxima performance y seguridad para tu auto, moto o camioneta.',
  heroImages: [
    'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'lubricantes', name: 'Aceites & Lubricantes', slug: 'lubricantes', imageUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'lubricantes', name: 'Aceites & Lubricantes', slug: 'lubricantes', order: 1, filterableAttributes: ['viscosidad'] },
    { id: 'baterias', name: 'Baterías & Electricidad', slug: 'baterias', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'viscosidad', name: 'Viscosidad', code: 'viscosidad', type: 'select', values: ['5W-30 Sintético', '5W-40 Sintético', '10W-40 Semi-Sintético'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Aceite Motor 100% Sintético 5W-30 4 Litros',
      categorySlug: 'lubricantes',
      price: 48900,
      stock: 30,
      skuPrefix: 'AUT-OIL',
      description: 'Protección avanzada contra el desgaste en arranques en frío y altas temperaturas.',
      image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
