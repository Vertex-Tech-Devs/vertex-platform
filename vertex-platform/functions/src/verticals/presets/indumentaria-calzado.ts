import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const INDUMENTARIA_CALZADO_PRESET: BusinessVerticalDefinition = {
  id: 'INDUMENTARIA_CALZADO',
  name: 'Indumentaria & Calzado',
  icon: 'bi-bag',
  description: 'Ropa urbana, calzado deportivo, camperas y accesorios de moda.',
  bannerTitle: 'Nueva Colección Streetwear 2026',
  bannerSubtitle: 'Moda argentina con identidad propia, corte moderno y alcance nacional.',
  heroImages: [
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    { categoryId: 'remeras', name: 'Remeras & Tops', slug: 'remeras', imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=400&fit=crop&q=80' },
    { categoryId: 'pantalones', name: 'Pantalones & Jeans', slug: 'pantalones', imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&h=400&fit=crop&q=80' },
    { categoryId: 'calzado', name: 'Zapatillas Urbanas', slug: 'calzado', imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&h=400&fit=crop&q=80' },
  ],
  categories: [
    { id: 'remeras', name: 'Remeras & Tops', slug: 'remeras', order: 1, filterableAttributes: ['talle-ropa', 'color'] },
    { id: 'pantalones', name: 'Pantalones & Denim', slug: 'pantalones', order: 2, filterableAttributes: ['talle-pantalon', 'color'] },
    { id: 'camperas', name: 'Camperas & Abrigos', slug: 'camperas', order: 3, filterableAttributes: ['talle-ropa', 'color'] },
    { id: 'calzado', name: 'Calzado & Zapatillas', slug: 'calzado', order: 4, filterableAttributes: ['talle-calzado', 'color'] },
  ],
  attributes: [
    { id: 'talle-ropa', name: 'Talle (Ropa)', code: 'talle-ropa', type: 'button', values: ['S', 'M', 'L', 'XL'], required: true },
    { id: 'talle-pantalon', name: 'Talle (Pantalón)', code: 'talle-pantalon', type: 'button', values: ['38', '40', '42', '44'], required: true },
    { id: 'talle-calzado', name: 'Talle (Calzado)', code: 'talle-calzado', type: 'button', values: ['39', '40', '41', '42', '43'], required: true },
    { id: 'color', name: 'Color', code: 'color', type: 'color', values: ['Negro', 'Blanco', 'Azul Marino', 'Beige', 'Gris'], required: true },
  ],
  sampleProducts: [
    {
      name: 'Remera Oversize Heavy Cotton',
      categorySlug: 'remeras',
      price: 28900,
      stock: 60,
      skuPrefix: 'REM-OVR',
      description: 'Confeccionada en 100% algodón peinado premium 24/1 con caída pesada estructurada.',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'REM-OVR-BLK-M', price: 28900, stock: 20, attributes: { 'talle-ropa': 'M', color: 'Negro' } },
        { sku: 'REM-OVR-BLK-L', price: 28900, stock: 20, attributes: { 'talle-ropa': 'L', color: 'Negro' } },
        { sku: 'REM-OVR-WHT-L', price: 28900, stock: 20, attributes: { 'talle-ropa': 'L', color: 'Blanco' } },
      ],
    },
    {
      name: 'Pantalón Cargo Baggy Ripstop',
      categorySlug: 'pantalones',
      price: 64900,
      stock: 40,
      skuPrefix: 'PNT-CRG',
      description: 'Pantalón cargo corte relajado con 6 bolsillos utilitarios y tejido antidesgarro.',
      image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'PNT-CRG-BLK-40', price: 64900, stock: 20, attributes: { 'talle-pantalon': '40', color: 'Negro' } },
        { sku: 'PNT-CRG-BGE-42', price: 64900, stock: 20, attributes: { 'talle-pantalon': '42', color: 'Beige' } },
      ],
    },
    {
      name: 'Zapatillas Urban Retro Low',
      categorySlug: 'calzado',
      price: 98000,
      stock: 30,
      skuPrefix: 'ZAP-RET',
      description: 'Zapatillas de cuero sintético premium y suela de caucho vulcanizado antideslizante.',
      image: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'ZAP-RET-WHT-41', price: 98000, stock: 15, attributes: { 'talle-calzado': '41', color: 'Blanco' } },
        { sku: 'ZAP-RET-WHT-42', price: 98000, stock: 15, attributes: { 'talle-calzado': '42', color: 'Blanco' } },
      ],
    },
  ],
};
