import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const PET_SHOP_VETERINARIA_PRESET: BusinessVerticalDefinition = {
  id: 'PET_SHOP_VETERINARIA',
  name: 'Pet Shop & Veterinaria',
  icon: 'bi-tencent-qq',
  description: 'Alimentos premium, juguetes, camas, pipetas y accesorios para mascotas.',
  bannerTitle: 'El Mejor Cuidado y Nutrición para tus Mascotas',
  bannerSubtitle: 'Alimentos balanceados de primera línea, antiparasitarios y juguetes divertidos.',
  heroImages: [
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'perros', name: 'Alimento Perros', slug: 'perros', imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'perros', name: 'Perros & Cachorros', slug: 'perros', order: 1, filterableAttributes: ['peso-bolsa'] },
    { id: 'gatos', name: 'Gatos & Felinos', slug: 'gatos', order: 2, filterableAttributes: ['peso-bolsa'] },
  ],
  attributes: [
    { id: 'peso-bolsa', name: 'Peso Bolsa', code: 'peso-bolsa', type: 'button', values: ['3 kg', '7.5 kg', '15 kg'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Alimento Super Premium Perro Adulto Raza Mediana',
      categorySlug: 'perros',
      price: 56000,
      stock: 35,
      skuPrefix: 'PET-DOG',
      description: 'Proteína de salmón y pollo con prebióticos y ácidos grasos Omega 3 y 6.',
      image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'PET-DOG-7KG', price: 56000, stock: 20, attributes: { 'peso-bolsa': '7.5 kg' } },
        { sku: 'PET-DOG-15KG', price: 98000, stock: 15, attributes: { 'peso-bolsa': '15 kg' } },
      ],
    },
  ],
};
