import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const SUPERMERCADO_ALMACEN_PRESET: BusinessVerticalDefinition = {
  id: 'SUPERMERCADO_ALMACEN',
  name: 'Supermercado & Almacén',
  icon: 'bi-cart4',
  description: 'Almacén de comestibles, bebidas, frescos, lácteos y productos de limpieza.',
  bannerTitle: 'Tu Compra Diaria Fácil, Rápida y Fresca',
  bannerSubtitle: 'Alimentos seleccionados, bebidas frías y productos de limpieza al mejor precio.',
  heroImages: [
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    {
      categoryId: 'almacen',
      name: 'Almacén & Secos',
      slug: 'almacen',
      imageUrl:
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'lacteos',
      name: 'Lácteos & Quesos',
      slug: 'lacteos',
      imageUrl:
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'bebidas',
      name: 'Bebidas & Jugos',
      slug: 'bebidas',
      imageUrl:
        'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'limpieza',
      name: 'Limpieza del Hogar',
      slug: 'limpieza',
      imageUrl:
        'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=600&h=400&fit=crop&q=80',
    },
  ],
  categories: [
    {
      id: 'almacen',
      name: 'Almacén, Pastas & Aceites',
      slug: 'almacen',
      order: 1,
      filterableAttributes: [],
    },
    {
      id: 'lacteos',
      name: 'Lácteos, Fiambres & Quesos',
      slug: 'lacteos',
      order: 2,
      filterableAttributes: [],
    },
    {
      id: 'bebidas',
      name: 'Bebidas, Aguas & Gaseosas',
      slug: 'bebidas',
      order: 3,
      filterableAttributes: ['volumen-bebida'],
    },
    {
      id: 'snacks',
      name: 'Snacks, Galletitas & Golosinas',
      slug: 'snacks',
      order: 4,
      filterableAttributes: [],
    },
    {
      id: 'limpieza',
      name: 'Limpieza & Cuidado del Hogar',
      slug: 'limpieza',
      order: 5,
      filterableAttributes: [],
    },
  ],
  attributes: [
    {
      id: 'volumen-bebida',
      name: 'Volumen',
      code: 'volumen-bebida',
      type: 'button',
      values: ['500 ml', '1.5 L', '2.25 L'],
      required: false,
    },
  ],
  colors: {
    primary: '#16a34a',
    accent: '#ea580c',
    background: '#ffffff',
  },
  featureCards: [
    {
      title: 'Frescura Garantizada',
      content: 'Control de calidad estricto en productos frescos y envasados de origen.',
    },
    {
      title: 'Precios Claros y Promociones',
      content: 'Ahorrá con ofertas semanales y combos familiares de alta conveniencia.',
    },
    {
      title: 'Entrega Programada',
      content: 'Recibí tu compra en la franja horaria que mejor se adapte a tu día.',
    },
  ],
  sampleProducts: [
    {
      name: 'Aceite de Oliva Extra Virgen Primera Prensada 500ml',
      categorySlug: 'almacen',
      price: 14500,
      stock: 45,
      skuPrefix: 'ALM-OLV',
      description:
        'Aceite de oliva de acidez menor a 0.5% elaborado con olivas Arauco mendocinas en botella oscura.',
      image:
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Café Tostado en Granos Especialidad Blend 250g',
      categorySlug: 'almacen',
      price: 16800,
      stock: 50,
      skuPrefix: 'ALM-CAF',
      description:
        '100% arábica tostado artesanalmente con notas a caramelo y chocolate con leche.',
      image:
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Yerba Mate Orgánica Despalada Estacionamiento Natural 500g',
      categorySlug: 'almacen',
      price: 6800,
      stock: 90,
      skuPrefix: 'ALM-YRB',
      description:
        'Estacionada 24 meses sin agroquímicos, bajo contenido de polvo y sabor suave duradero.',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Fideos Secos Fetuccini de Trigo Candeal 500g',
      categorySlug: 'almacen',
      price: 3200,
      stock: 80,
      skuPrefix: 'ALM-FID',
      description:
        'Elaborados con trefilado de bronce para una absorción óptima de salsas y textura al dente.',
      image: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Arroz Doble Carolina Selección Especial 1kg',
      categorySlug: 'almacen',
      price: 3900,
      stock: 75,
      skuPrefix: 'ALM-ARR',
      description:
        'Grano pulido de gran absorción ideal para risottos, paellas y comidas tradicionales.',
      image:
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Salsa de Tomate Passata Rustica Casera 700g',
      categorySlug: 'almacen',
      price: 4500,
      stock: 60,
      skuPrefix: 'ALM-PAS',
      description:
        'Tomates perita triturados madurados al sol sin conservantes artificiales en frasco de vidrio.',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Queso Gouda Artesanal Estacionado Trozo 300g',
      categorySlug: 'lacteos',
      price: 8900,
      stock: 40,
      skuPrefix: 'LAC-GOU',
      description:
        'Queso de pasta semidura elaborado con leche entera de tambos locales con ojos regulares y sabor frutal.',
      image:
        'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Jamón Cocido Natural Feteado al Vacío 200g',
      categorySlug: 'lacteos',
      price: 7400,
      stock: 35,
      skuPrefix: 'LAC-JAM',
      description:
        'Elaborado con pata de cerdo entera seleccionada, libre de gluten y con bajo contenido de sodio.',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Leche Entera Larga Vida Fortificada con Calcio 1L',
      categorySlug: 'lacteos',
      price: 2400,
      stock: 120,
      skuPrefix: 'LAC-LCH',
      description: 'Ultra pasteurizada UAT enriquecida con vitaminas A, D y complejo mineral.',
      image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Yogur Griego Natural Cremoso 500g',
      categorySlug: 'lacteos',
      price: 5200,
      stock: 45,
      skuPrefix: 'LAC-YOG',
      description:
        'Doble filtrado con alto contenido de proteínas naturales, sin azúcar añadida ni espesantes.',
      image:
        'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Manteca Calidad Extra sin Sal 200g',
      categorySlug: 'lacteos',
      price: 3600,
      stock: 55,
      skuPrefix: 'LAC-MNT',
      description:
        '100% crema de leche de primera calidad pasteurizada con sabor puro y untuosidad ideal.',
      image:
        'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Agua Mineral de Manantial Natural sin Gas',
      categorySlug: 'bebidas',
      price: 1800,
      stock: 100,
      skuPrefix: 'BEB-AGU',
      description: 'Agua pura de vertiente andina baja en sodio y minerales pesados.',
      image:
        'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'BEB-AGU-500', price: 1800, stock: 50, attributes: { 'volumen-bebida': '500 ml' } },
        { sku: 'BEB-AGU-1500', price: 2900, stock: 50, attributes: { 'volumen-bebida': '1.5 L' } },
      ],
    },
    {
      name: 'Jugo de Naranja 100% Exprimido Puro 1L',
      categorySlug: 'bebidas',
      price: 4500,
      stock: 40,
      skuPrefix: 'BEB-JUG',
      description: 'Jugo natural pasteurizado con pulpa sin conservantes, agua ni azúcar agregada.',
      image:
        'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Gaseosa Cola Clásica Botella 2.25L',
      categorySlug: 'bebidas',
      price: 3800,
      stock: 80,
      skuPrefix: 'BEB-GAS',
      description:
        'Bebida refrescante sabor cola con gasificación óptima para compartir en familia.',
      image:
        'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Papas Fritas Corte Americano Crujientes 150g',
      categorySlug: 'snacks',
      price: 3600,
      stock: 65,
      skuPrefix: 'SNK-PAP',
      description:
        'Papas seleccionadas fritas en aceite vegetal de girasol alto oleico con toque justo de sal marina.',
      image:
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Galletitas Dulces con Chips de Chocolate Belga 200g',
      categorySlug: 'snacks',
      price: 4200,
      stock: 70,
      skuPrefix: 'SNK-CKI',
      description:
        'Cookies horneadas con textura tierna y abundantes gotas de chocolate semiamargo.',
      image:
        'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Mix de Frutos Secos Energético con Pasas 250g',
      categorySlug: 'snacks',
      price: 7800,
      stock: 50,
      skuPrefix: 'SNK-MIX',
      description: 'Almendras nonpareil, nueces Chandler, castañas de cajú y pasas de uva rubias.',
      image:
        'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Detergente Líquido Lavavajillas Concentrado Limón 750ml',
      categorySlug: 'limpieza',
      price: 3900,
      stock: 60,
      skuPrefix: 'LMP-DET',
      description: 'Poder desengrasante instantáneo con glicerina que cuida la piel de las manos.',
      image:
        'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Jabón Líquido para Ropa Máxima Blancura 3L',
      categorySlug: 'limpieza',
      price: 13500,
      stock: 35,
      skuPrefix: 'LMP-JAB',
      description:
        'Remoción efectiva de manchas difíciles con fragancia floral de larga duración para 30 lavados.',
      image:
        'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Limpiador Multisuperficies Antibacterial Gatillo 500ml',
      categorySlug: 'limpieza',
      price: 4800,
      stock: 55,
      skuPrefix: 'LMP-MUL',
      description:
        'Elimina el 99.9% de bacterias en mesadas, azulejos y pisos sin dejar residuos grasos.',
      image:
        'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Papel Higiénico Doble Hoja Premium (Pack x4)',
      categorySlug: 'limpieza',
      price: 5200,
      stock: 90,
      skuPrefix: 'LMP-PAP',
      description: 'Máxima suavidad y resistencia con fibras naturales 100% vírgenes.',
      image:
        'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
