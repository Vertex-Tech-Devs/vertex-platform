import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const JUGUETERIA_BEBES_PRESET: BusinessVerticalDefinition = {
  id: 'JUGUETERIA_BEBES',
  name: 'Juguetería & Bebés',
  icon: 'bi-controller',
  description: 'Juguetes didácticos de madera, primera infancia, juegos de mesa y rodados.',
  bannerTitle: 'Juegos, Aprendizaje y Diversión para la Infancia',
  bannerSubtitle: 'Juguetes seguros, didácticos y creativos pensados para cada etapa del crecimiento.',
  heroImages: [
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'didacticos', name: 'Juguetes Didácticos', slug: 'didacticos', imageUrl: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'didacticos', name: 'Madera & Didácticos', slug: 'didacticos', order: 1, filterableAttributes: ['edad'] },
    { id: 'juegos-mesa', name: 'Juegos de Mesa & Familia', slug: 'juegos-mesa', order: 2, filterableAttributes: ['edad'] },
  ],
  attributes: [
    { id: 'edad', name: 'Rango de Edad', code: 'edad', type: 'select', values: ['0 a 12 Meses', '1 a 3 Años', '4 a 7 Años', '+8 Años'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Torre de Encastre y Equilibrio de Madera Nórdica',
      categorySlug: 'didacticos',
      price: 19500,
      stock: 30,
      skuPrefix: 'JUG-ENC',
      description: 'Pinturas al agua no tóxicas, madera maciza de haya con terminaciones pulidas.',
      image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
