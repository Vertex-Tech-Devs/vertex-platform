import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const FARMACIA_SALUD_PRESET: BusinessVerticalDefinition = {
  id: 'FARMACIA_SALUD',
  name: 'Farmacia & Salud',
  icon: 'bi-heart-pulse',
  description: 'Suplementos nutricionales, primeros auxilios y cuidado médico preventivo.',
  bannerTitle: 'Bienestar, Prevención y Salud Integral',
  bannerSubtitle: 'Suplementos y productos avalados para acompañar tu calidad de vida.',
  heroImages: [
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'suplementos', name: 'Suplementos', slug: 'suplementos', imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'suplementos', name: 'Vitaminas & Suplementos', slug: 'suplementos', order: 1, filterableAttributes: ['presentacion'] },
    { id: 'primeros-auxilios', name: 'Botiquín & Primeros Auxilios', slug: 'primeros-auxilios', order: 2, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'presentacion', name: 'Presentación', code: 'presentacion', type: 'select', values: ['30 Cápsulas', '60 Cápsulas', '90 Comprimidos'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Complejo Vitamina D3 4000 UI + K2',
      categorySlug: 'suplementos',
      price: 18900,
      stock: 50,
      skuPrefix: 'VIT-D3',
      description: 'Refuerzo para el sistema inmunológico y la salud ósea.',
      image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
