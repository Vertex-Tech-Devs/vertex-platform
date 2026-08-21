import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const GASTRONOMIA_RESTAURANTE_PRESET: BusinessVerticalDefinition = {
  id: 'GASTRONOMIA_RESTAURANTE',
  name: 'Gastronomía & Restaurante',
  icon: 'bi-cup-hot',
  description: 'Platos gourmet, hamburgueserías, cafetería de especialidad y pastelería.',
  bannerTitle: 'Sabores Artesanales y Café de Especialidad',
  bannerSubtitle: 'Ingredientes frescos seleccionados para brindarte la mejor experiencia gastronómica.',
  heroImages: [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'hamburguesas', name: 'Hamburguesas', slug: 'hamburguesas', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop&q=80' },
    { categoryId: 'cafe', name: 'Café de Especialidad', slug: 'cafeteria', imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=400&fit=crop&q=80' },
    { categoryId: 'postres', name: 'Pastelería & Postres', slug: 'postres', imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'hamburguesas', name: 'Hamburguesas Gourmet', slug: 'hamburguesas', order: 1, filterableAttributes: ['pan', 'puntos'] },
    { id: 'cafe', name: 'Cafetería & Bebidas', slug: 'cafeteria', order: 2, filterableAttributes: ['leche', 'tamano'] },
    { id: 'postres', name: 'Pastelería Artesanal', slug: 'postres', order: 3, filterableAttributes: [] },
  ],
  attributes: [
    { id: 'pan', name: 'Tipo de Pan', code: 'pan', type: 'select', values: ['Brioche Artesanal', 'Pan de Papa', 'Sin TACC'], required: true },
    { id: 'puntos', name: 'Punto de Cocción', code: 'puntos', type: 'button', values: ['A Punto', 'Jugoso', 'Cocido'], required: false },
    { id: 'leche', name: 'Tipo de Leche', code: 'leche', type: 'select', values: ['Entera', 'Descremada', 'Almendras', 'Avena'], required: false },
    { id: 'tamano', name: 'Tamaño', code: 'tamano', type: 'button', values: ['Chico (250ml)', 'Mediano (350ml)', 'Grande (500ml)'], required: false },
  ],
  sampleProducts: [
    {
      name: 'Burger Doble Smash Cheddar Bacon',
      categorySlug: 'hamburguesas',
      price: 14500,
      stock: 50,
      skuPrefix: 'BGR-SMSH',
      description: 'Doble medallón de 110g smash, cuádruple cheddar, panceta crocante y salsa mil islas.',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'BGR-SMSH-BRC', price: 14500, stock: 30, attributes: { pan: 'Brioche Artesanal' } },
        { sku: 'BGR-SMSH-POT', price: 14500, stock: 20, attributes: { pan: 'Pan de Papa' } },
      ],
    },
    {
      name: 'Flat White de Especialidad Origen Etiopía',
      categorySlug: 'cafeteria',
      price: 5200,
      stock: 100,
      skuPrefix: 'CAF-FLAT',
      description: 'Doble shot de espresso de grano arábica con leche microtexturizada sedosa.',
      image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'CAF-FLAT-ENT', price: 5200, stock: 60, attributes: { leche: 'Entera', tamano: 'Mediano (350ml)' } },
        { sku: 'CAF-FLAT-ALM', price: 5900, stock: 40, attributes: { leche: 'Almendras', tamano: 'Mediano (350ml)' } },
      ],
    },
  ],
};
