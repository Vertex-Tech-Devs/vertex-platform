import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const VIVEROS_JARDINERIA_PRESET: BusinessVerticalDefinition = {
  id: 'VIVEROS_JARDINERIA',
  name: 'Viveros & Jardinería',
  icon: 'bi-tree',
  description: 'Plantas de interior, suculentas, macetas de autor y sustratos premium.',
  bannerTitle: 'Naturaleza Viva y Botánica para tus Espacios',
  bannerSubtitle: 'Plantas aclimatadas, macetas de diseño artesanal y abonos orgánicos.',
  heroImages: [
    'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'interior', name: 'Plantas de Interior', slug: 'interior', imageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'interior', name: 'Plantas de Interior', slug: 'interior', order: 1, filterableAttributes: ['luz'] },
    { id: 'macetas', name: 'Macetas & Jardineras', slug: 'macetas', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'luz', name: 'Requerimiento de Luz', code: 'luz', type: 'select', values: ['Luz Indirecta Brillante', 'Media Sombra', 'Pleno Sol'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Monstera Deliciosa en Maceta de Barro 20cm',
      categorySlug: 'interior',
      price: 26000,
      stock: 20,
      skuPrefix: 'VIV-MON',
      description: 'Planta ornamental de follaje exhuberante con hojas fenestradas.',
      image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
