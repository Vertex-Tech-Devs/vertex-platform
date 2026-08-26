import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const VINOTECA_LICORERIA_PRESET: BusinessVerticalDefinition = {
  id: 'VINOTECA_LICORERIA',
  name: 'Vinoteca & Bebidas',
  icon: 'bi-cup-straw',
  description: 'Vinos de autor, espumantes, whiskies importados, licores y accesorios sommelier.',
  bannerTitle: 'Cavas Seleccionadas & Vinos de Autor',
  bannerSubtitle: 'Etiquetas premiadas de bodegas boutique, destilados premium y cristalería fina.',
  heroImages: [
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    {
      categoryId: 'vinos-tintos',
      name: 'Vinos Tintos',
      slug: 'vinos-tintos',
      imageUrl:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'vinos-blancos',
      name: 'Blancos & Rosados',
      slug: 'vinos-blancos',
      imageUrl:
        'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'espumantes',
      name: 'Espumantes',
      slug: 'espumantes',
      imageUrl:
        'https://images.unsplash.com/photo-1569919659476-f0852f6834b7?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'destilados',
      name: 'Whiskies & Destilados',
      slug: 'destilados',
      imageUrl:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&h=400&fit=crop&q=80',
    },
  ],
  categories: [
    {
      id: 'vinos-tintos',
      name: 'Vinos Tintos de Guarda',
      slug: 'vinos-tintos',
      order: 1,
      filterableAttributes: ['cepa', 'valle'],
    },
    {
      id: 'vinos-blancos',
      name: 'Vinos Blancos & Rosados',
      slug: 'vinos-blancos',
      order: 2,
      filterableAttributes: ['cepa'],
    },
    {
      id: 'espumantes',
      name: 'Espumantes & Champagne',
      slug: 'espumantes',
      order: 3,
      filterableAttributes: ['tipo-espumante'],
    },
    {
      id: 'destilados',
      name: 'Whiskies, Gin & Destilados',
      slug: 'destilados',
      order: 4,
      filterableAttributes: [],
    },
    {
      id: 'accesorios-vino',
      name: 'Accesorios & Cristalería',
      slug: 'accesorios-vino',
      order: 5,
      filterableAttributes: [],
    },
  ],
  attributes: [
    {
      id: 'cepa',
      name: 'Varietal',
      code: 'cepa',
      type: 'select',
      values: [
        'Malbec',
        'Cabernet Sauvignon',
        'Cabernet Franc',
        'Pinot Noir',
        'Chardonnay',
        'Torrontés',
      ],
      required: false,
    },
    {
      id: 'valle',
      name: 'Región / Valle',
      code: 'valle',
      type: 'select',
      values: [
        'Valle de Uco (Mendoza)',
        'Luján de Cuyo (Mendoza)',
        'Valles Calchaquíes (Salta)',
        'Patagonia',
      ],
      required: false,
    },
    {
      id: 'tipo-espumante',
      name: 'Tipo',
      code: 'tipo-espumante',
      type: 'select',
      values: ['Extra Brut', 'Brut Nature', 'Rosé', 'Dulce'],
      required: false,
    },
  ],
  colors: {
    primary: '#831843',
    accent: '#d97706',
    background: '#ffffff',
  },
  featureCards: [
    {
      title: 'Cava con Clima Controlado',
      content: 'Vinos y destilados conservados en condiciones óptimas de temperatura y humedad.',
    },
    {
      title: 'Selección de Sommeliers',
      content: 'Etiquetas premiadas y pequeñas producciones de bodegas boutique exclusivas.',
    },
    {
      title: 'Embalaje Antirroturas',
      content: 'Cajas inflables y divisorias diseñadas para proteger botellas de cristal.',
    },
  ],
  sampleProducts: [
    {
      name: 'Malbec Gran Reserva Icono Valle de Uco 750ml',
      categorySlug: 'vinos-tintos',
      price: 38000,
      stock: 35,
      skuPrefix: 'VIN-MLB-UCO',
      description:
        'Crianza de 18 meses en barricas de roble francés. Notas intensas a frutos negros, violetas, chocolate y taninos aterciopelados.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Cabernet Franc Single Vineyard Paraje Altamira',
      categorySlug: 'vinos-tintos',
      price: 42000,
      stock: 25,
      skuPrefix: 'VIN-CBF',
      description:
        'Elegante y especiado con notas a pimiento asado, grosellas rojas y mineralidad calcárea.',
      image:
        'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Cabernet Sauvignon Reserva de Altura 750ml',
      categorySlug: 'vinos-tintos',
      price: 28000,
      stock: 40,
      skuPrefix: 'VIN-CBS',
      description:
        'Gran estructura con aromas a cassis, tabaco rubio y pimienta negra con largo final de boca.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Pinot Noir Patagónico de Clima Frío 750ml',
      categorySlug: 'vinos-tintos',
      price: 34000,
      stock: 30,
      skuPrefix: 'VIN-PNT',
      description:
        'Sutil y complejo con notas a cerezas maduras, hongos silvestres y acidez fresca equilibrada.',
      image:
        'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Blend de Tintas de Corte Selección del Enólogo',
      categorySlug: 'vinos-tintos',
      price: 49000,
      stock: 20,
      skuPrefix: 'VIN-BLD',
      description: '50% Malbec, 30% Cabernet Sauvignon, 20% Petit Verdot con 24 meses de guarda.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Chardonnay Fermentado en Barrica 750ml',
      categorySlug: 'vinos-blancos',
      price: 31000,
      stock: 30,
      skuPrefix: 'VIN-CHD',
      description:
        'Blanco untuoso con notas a manzana verde, ananá asado, manteca y vainilla tostada.',
      image:
        'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Torrontés Salteño Cafayate Extremo 750ml',
      categorySlug: 'vinos-blancos',
      price: 22000,
      stock: 40,
      skuPrefix: 'VIN-TOR',
      description:
        'Exuberante perfil aromático floral a jazmines, ruda, durazno blanco y cítricos frescos.',
      image:
        'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Rosé de Malbec & Pinot Noir Pálido Provence',
      categorySlug: 'vinos-blancos',
      price: 24500,
      stock: 35,
      skuPrefix: 'VIN-ROS',
      description:
        'Color piel de cebolla sutil con aromas a frutillas frescas, pomelo rosado y final mineral.',
      image: 'https://images.unsplash.com/photo-1558001373-7b93ee48ffa0?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Espumante Nature Método Tradicional Champenoise',
      categorySlug: 'espumantes',
      price: 36000,
      stock: 30,
      skuPrefix: 'ESP-NAT',
      description:
        '36 meses sobre lías de levaduras. Burbuja fina persistente con aromas a pan brioche tostado y avellanas.',
      image:
        'https://images.unsplash.com/photo-1569919659476-f0852f6834b7?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Espumante Extra Brut Pinot Noir & Chardonnay',
      categorySlug: 'espumantes',
      price: 26500,
      stock: 45,
      skuPrefix: 'ESP-XBR',
      description:
        'Fresco, vibrante y equilibrado, ideal para celebraciones y maridajes con frutos de mar.',
      image:
        'https://images.unsplash.com/photo-1569919659476-f0852f6834b7?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Espumante Rosé Brut de Pinot Noir 750ml',
      categorySlug: 'espumantes',
      price: 29000,
      stock: 30,
      skuPrefix: 'ESP-ROS',
      description:
        'Elegante corona de burbujas con notas a frutos rojos silvestres y toque cítrico.',
      image:
        'https://images.unsplash.com/photo-1569919659476-f0852f6834b7?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Whisky Single Malt Escocés 12 Años 700ml',
      categorySlug: 'destilados',
      price: 95000,
      stock: 20,
      skuPrefix: 'DST-WKY12',
      description:
        'Madurado en barricas de roble americano y jerez con notas a miel, manzana roja y suave turba.',
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Whisky Bourbon Americano Oak Cask 750ml',
      categorySlug: 'destilados',
      price: 68000,
      stock: 25,
      skuPrefix: 'DST-BRB',
      description:
        'Destilado con alto porcentaje de maíz, añejado en roble blanco carbonizado con notas a caramelo.',
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Gin Botánico Premium Artesanal 750ml',
      categorySlug: 'destilados',
      price: 32000,
      stock: 40,
      skuPrefix: 'DST-GIN',
      description:
        'Destilación en alambique de cobre con 14 botánicos seleccionados: enebro, cardamomo, piel de pomelo y lavanda.',
      image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Ron Añejo Solera 15 Años Reserva Especial',
      categorySlug: 'destilados',
      price: 62000,
      stock: 20,
      skuPrefix: 'DST-RON',
      description:
        'Envejecido en barricas de roble a gran altura con notas a frutos secos, café y chocolate.',
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Vermut Rojo Artesanal Botánico 750ml',
      categorySlug: 'destilados',
      price: 18500,
      stock: 45,
      skuPrefix: 'DST-VRM',
      description:
        'Base de vino tinto infusionado con ajenjo, genciana, manzanilla y piel de naranja amarga.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Set de 6 Copas de Cristal de Bohemia para Malbec 600ml',
      categorySlug: 'accesorios-vino',
      price: 54000,
      stock: 25,
      skuPrefix: 'ACC-COP',
      description:
        'Cristal soplado ultraligero sin plomo con cáliz amplio para oxigenación óptima del vino tinto.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Decantador de Vino Cristal con Soporte Antigoteo 1.5L',
      categorySlug: 'accesorios-vino',
      price: 39000,
      stock: 20,
      skuPrefix: 'ACC-DEC',
      description: 'Diseño ergonómico con base ancha para una rápida aireación de vinos de guarda.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Descorchador Eléctrico Automático USB con Cortacápsulas',
      categorySlug: 'accesorios-vino',
      price: 29500,
      stock: 35,
      skuPrefix: 'ACC-DSC',
      description:
        'Extrae el corcho en 6 segundos con solo presionar un botón. Batería recargable para 50 botellas.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Bomba de Vacío para Vino con 4 Tapones Herméticos',
      categorySlug: 'accesorios-vino',
      price: 16500,
      stock: 50,
      skuPrefix: 'ACC-VAC',
      description: 'Conserva el vino abierto por hasta 10 días eliminando el aire de la botella.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Caja Regalo Estuche Sommelier Madera de Roble 3 Botellas',
      categorySlug: 'accesorios-vino',
      price: 24000,
      stock: 30,
      skuPrefix: 'ACC-EST',
      description:
        'Estuche de madera lustrada con herrajes metálicos dorados para presentación de etiquetas premium.',
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
