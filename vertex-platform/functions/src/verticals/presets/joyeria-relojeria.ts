import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const JOYERIA_RELOJERIA_PRESET: BusinessVerticalDefinition = {
  id: 'JOYERIA_RELOJERIA',
  name: 'Joyería & Relojería',
  icon: 'bi-gem',
  description: 'Anillos, cadenas de plata 925, oro, relojes automáticos y accesorios finos.',
  bannerTitle: 'Elegancia Atemporal y Alta Joyería',
  bannerSubtitle: 'Piezas exclusivas trabajadas en metales nobles y piedras preciosas certificadas.',
  heroImages: [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'anillos', name: 'Anillos & Solitarios', slug: 'anillos', imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'anillos', name: 'Anillos & Alianzas', slug: 'anillos', order: 1, filterableAttributes: ['metal', 'medida-anillo'] },
    { id: 'relojes', name: 'Relojes Suizos & Automáticos', slug: 'relojes', order: 2, filterableAttributes: ['metal'] },
  ],
  attributes: [
    { id: 'metal', name: 'Material', code: 'metal', type: 'select', values: ['Plata 925', 'Oro Amarillo 18k', 'Oro Blanco 18k', 'Acero Quirúrgico'], required: true },
    { id: 'medida-anillo', name: 'Medida Anillo', code: 'medida-anillo', type: 'button', values: ['14', '16', '18', '20'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Anillo Solitario Circonia Brilliant Cut Plata 925',
      categorySlug: 'anillos',
      price: 42000,
      stock: 20,
      skuPrefix: 'JOY-SOL',
      description: 'Plata 925 rodinada con engarce clásico de 6 garras y piedra central facetada.',
      image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'JOY-SOL-16', price: 42000, stock: 10, attributes: { metal: 'Plata 925', 'medida-anillo': '16' } },
        { sku: 'JOY-SOL-18', price: 42000, stock: 10, attributes: { metal: 'Plata 925', 'medida-anillo': '18' } },
      ],
    },
  ],
};
