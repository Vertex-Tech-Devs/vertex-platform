import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const DEPORTES_FITNESS_PRESET: BusinessVerticalDefinition = {
  id: 'DEPORTES_FITNESS',
  name: 'Deportes & Fitness',
  icon: 'bi-activity',
  description: 'Equipamiento de entrenamiento, mancuernas, indumentaria deportiva y running.',
  bannerTitle: 'Rendimiento, Entrenamiento y Superación',
  bannerSubtitle: 'Equipamiento funcional, pesas y accesorios para entrenar al máximo nivel.',
  heroImages: [
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'pesas', name: 'Mancuernas & Pesas', slug: 'mancuernas', imageUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'pesas', name: 'Mancuernas & Barras', slug: 'mancuernas', order: 1, filterableAttributes: ['peso-kg'] },
    { id: 'yoga', name: 'Yoga & Pilates', slug: 'yoga', order: 2, filterableAttributes: ['color'] },
  ],
  attributes: [
    { id: 'peso-kg', name: 'Peso', code: 'peso-kg', type: 'button', values: ['5 kg', '10 kg', '15 kg', '20 kg'], required: true },
    { id: 'color', name: 'Color', code: 'color', type: 'color', values: ['Negro', 'Azul', 'Rosa', 'Verde Oliva'], required: false },
  ],
  sampleProducts: [
    {
      name: 'Mancuerna Hexagonal Engomada Profesional',
      categorySlug: 'mancuernas',
      price: 26000,
      stock: 40,
      skuPrefix: 'FIT-HEX',
      description: 'Núcleo de hierro fundido recubierto en caucho virgen de alta absorción de impacto.',
      image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'FIT-HEX-5KG', price: 26000, stock: 20, attributes: { 'peso-kg': '5 kg' } },
        { sku: 'FIT-HEX-10KG', price: 48000, stock: 20, attributes: { 'peso-kg': '10 kg' } },
      ],
    },
  ],
};
