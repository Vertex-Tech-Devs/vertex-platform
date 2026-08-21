import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const OPTICA_ACCESORIOS_PRESET: BusinessVerticalDefinition = {
  id: 'OPTICA_ACCESORIOS',
  name: 'Óptica & Accesorios',
  icon: 'bi-eyeglasses',
  description: 'Armazones recetados, anteojos de sol polarizados y lentes de contacto.',
  bannerTitle: 'Salud Visual, Diseño y Protección UV',
  bannerSubtitle: 'Armazones ligeros de acetato italiano y cristales con filtro de luz azul.',
  heroImages: [
    'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'sol', name: 'Anteojos de Sol', slug: 'sol', imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'sol', name: 'Anteojos de Sol UV400', slug: 'sol', order: 1, filterableAttributes: ['armazon-color', 'polarizado'] },
    { id: 'recetados', name: 'Armazones Ópticos', slug: 'recetados', order: 2, filterableAttributes: ['armazon-color'] },
  ],
  attributes: [
    { id: 'armazon-color', name: 'Color Armazón', code: 'armazon-color', type: 'color', values: ['Negro Brillante', 'Carey Habana', 'Transparente Cristal'], required: true },
    { id: 'polarizado', name: 'Tratamiento Cristales', code: 'polarizado', type: 'select', values: ['Polarizado G15', 'Filtro Blue Light', 'Degradé'], required: false },
  ],
  sampleProducts: [
    {
      name: 'Anteojos de Sol Acetato Carey Polarizados UV400',
      categorySlug: 'sol',
      price: 68000,
      stock: 25,
      skuPrefix: 'OPT-SOL',
      description: 'Protección 100% contra rayos UVA/UVB con bisagras metálicas reforzadas de 5 pernos.',
      image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
