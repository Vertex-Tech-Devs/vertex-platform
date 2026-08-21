import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const LIBRERIA_PAPELERIA_PRESET: BusinessVerticalDefinition = {
  id: 'LIBRERIA_PAPELERIA',
  name: 'Librería & Papelería',
  icon: 'bi-book',
  description: 'Libros, cuadernos artesanales, útiles escolares, plumas y artística.',
  bannerTitle: 'Inspiración, Lectura y Creatividad',
  bannerSubtitle: 'Cuadernos de diseño, títulos literarios y materiales artísticos profesionales.',
  heroImages: [
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'cuadernos', name: 'Cuadernos & Libretas', slug: 'cuadernos', imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'cuadernos', name: 'Cuadernos & Agendas', slug: 'cuadernos', order: 1, filterableAttributes: ['rayado'] },
    { id: 'escritura', name: 'Escritura & Plumas', slug: 'escritura', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'rayado', name: 'Hojas / Rayado', code: 'rayado', type: 'select', values: ['Rayado', 'Cuadriculado', 'Punteado Bullet', 'Liso'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Cuaderno Tapa Dura Tela A5 90g',
      categorySlug: 'cuadernos',
      price: 16500,
      stock: 50,
      skuPrefix: 'LIB-CUA',
      description: 'Encuadernación cosida con cinta señaladora y papel libre de ácido de 90g/m².',
      image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'LIB-CUA-DOT', price: 16500, stock: 25, attributes: { rayado: 'Punteado Bullet' } },
        { sku: 'LIB-CUA-RAY', price: 16500, stock: 25, attributes: { rayado: 'Rayado' } },
      ],
    },
  ],
};
