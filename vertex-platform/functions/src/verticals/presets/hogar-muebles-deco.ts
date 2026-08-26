import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const HOGAR_MUEBLES_DECO_PRESET: BusinessVerticalDefinition = {
  id: 'HOGAR_MUEBLES_DECO',
  name: 'Hogar, Muebles & Decoración',
  icon: 'bi-house-heart',
  description: 'Muebles de diseño nórdico, iluminación cálida, textiles y objetos de decoración.',
  bannerTitle: 'Espacios que Inspiran y Acogen',
  bannerSubtitle: 'Mobiliario de autor, textiles naturales e iluminación de diseño para tu hogar.',
  heroImages: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    {
      categoryId: 'living',
      name: 'Living & Sillones',
      slug: 'living',
      imageUrl:
        'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'comedor',
      name: 'Mesas & Sillas',
      slug: 'comedor',
      imageUrl:
        'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'iluminacion',
      name: 'Lámparas & Luces',
      slug: 'iluminacion',
      imageUrl:
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'deco',
      name: 'Objetos Deco',
      slug: 'deco',
      imageUrl:
        'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&h=400&fit=crop&q=80',
    },
  ],
  categories: [
    {
      id: 'living',
      name: 'Living & Sillones',
      slug: 'living',
      order: 1,
      filterableAttributes: ['color-tela', 'cuerpos'],
    },
    {
      id: 'comedor',
      name: 'Comedor & Mesas',
      slug: 'comedor',
      order: 2,
      filterableAttributes: ['material-madera'],
    },
    {
      id: 'dormitorio',
      name: 'Dormitorio & Camas',
      slug: 'dormitorio',
      order: 3,
      filterableAttributes: ['medida-cama'],
    },
    {
      id: 'iluminacion',
      name: 'Iluminación de Diseño',
      slug: 'iluminacion',
      order: 4,
      filterableAttributes: ['acabado'],
    },
    {
      id: 'textiles',
      name: 'Textiles, Alfombras & Almohadones',
      slug: 'textiles',
      order: 5,
      filterableAttributes: ['color-tela'],
    },
    { id: 'deco', name: 'Decoración & Bazar', slug: 'deco', order: 6, filterableAttributes: [] },
  ],
  attributes: [
    {
      id: 'color-tela',
      name: 'Tapizado',
      code: 'color-tela',
      type: 'color',
      values: ['Gris Claro', 'Arena / Beige', 'Verde Oliva', 'Gris Grafito'],
      required: true,
    },
    {
      id: 'cuerpos',
      name: 'Cuerpos',
      code: 'cuerpos',
      type: 'button',
      values: ['2 Cuerpos', '3 Cuerpos', 'Esquinero'],
      required: false,
    },
    {
      id: 'material-madera',
      name: 'Madera',
      code: 'material-madera',
      type: 'select',
      values: ['Paraíso Natural', 'Petiribí Macizo', 'Roble Americano'],
      required: false,
    },
    {
      id: 'medida-cama',
      name: 'Medida',
      code: 'medida-cama',
      type: 'button',
      values: ['1 Plaza', '2 Plazas', 'Queen Size', 'King Size'],
      required: false,
    },
    {
      id: 'acabado',
      name: 'Acabado',
      code: 'acabado',
      type: 'select',
      values: ['Negro Mate', 'Bronce Viejo', 'Dorado Cepillado'],
      required: false,
    },
  ],
  colors: {
    primary: '#78716c',
    accent: '#ca8a04',
    background: '#ffffff',
  },
  featureCards: [
    {
      title: 'Maderas Macizas Nobles',
      content: 'Fabricación artesanal en petiribí, paraíso y guatambú seleccionado.',
    },
    {
      title: 'Personalización a Medida',
      content: 'Elegí tapizados, medidas y acabados según tu espacio.',
    },
    {
      title: 'Flete Especializado',
      content: 'Logística de muebles con personal de subida e instalación.',
    },
  ],
  sampleProducts: [
    {
      name: 'Sillón Nórdico Escandinavo 3 Cuerpos Pana Antimanchas',
      categorySlug: 'living',
      price: 680000,
      stock: 12,
      skuPrefix: 'DEC-SOF',
      description:
        'Estructura en madera de eucalipto macizo encastrada con placa soft de alta densidad 28kg.',
      image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'DEC-SOF-GRS',
          price: 680000,
          stock: 6,
          attributes: { 'color-tela': 'Gris Claro', cuerpos: '3 Cuerpos' },
        },
        {
          sku: 'DEC-SOF-SAN',
          price: 680000,
          stock: 6,
          attributes: { 'color-tela': 'Arena / Beige', cuerpos: '3 Cuerpos' },
        },
      ],
    },
    {
      name: 'Poltrona Lounge Sillón Individual Tapizado Bouclé',
      categorySlug: 'living',
      price: 290000,
      stock: 15,
      skuPrefix: 'DEC-POL',
      description:
        'Butaca envolvente con textura bouclé de lana sintética y patas metálicas cónicas.',
      image:
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'DEC-POL-BOU-BGE',
          price: 290000,
          stock: 8,
          attributes: { 'color-tela': 'Arena / Beige' },
        },
        {
          sku: 'DEC-POL-BOU-GRS',
          price: 290000,
          stock: 7,
          attributes: { 'color-tela': 'Gris Claro' },
        },
      ],
    },
    {
      name: 'Mesa de Centro Ratona Nido Madera Petiribí Macizo',
      categorySlug: 'living',
      price: 195000,
      stock: 18,
      skuPrefix: 'DEC-TAB',
      description:
        'Juego de dos mesas auxiliares circulares encastrables con tapa biselada y acabado hidrolaqueado mate.',
      image:
        'https://images.unsplash.com/photo-1533090161767-e6ffed986b88?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Rack de TV Nórdico Flotante con Puertas Ranuradas',
      categorySlug: 'living',
      price: 240000,
      stock: 14,
      skuPrefix: 'DEC-RCK',
      description:
        'Mueble para televisión de hasta 65 pulgadas con pasacables ocultos y frente alistonado de madera natural.',
      image:
        'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Mesa de Comedor Extensible Petiribí 1.60m a 2.10m',
      categorySlug: 'comedor',
      price: 540000,
      stock: 10,
      skuPrefix: 'DEC-COM',
      description:
        'Mesa con sistema telescópico de apertura suave, bordes redondeados y patas en ángulo.',
      image:
        'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Set de 4 Sillas de Comedor Tapizadas en Lino',
      categorySlug: 'comedor',
      price: 320000,
      stock: 15,
      skuPrefix: 'DEC-CHR',
      description:
        'Sillas ergonómicas con respaldo curvado, estructura de madera paraíso y tapizado antimancha.',
      image:
        'https://images.unsplash.com/photo-1503602642458-232111445657?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'DEC-CHR-GRS', price: 320000, stock: 8, attributes: { 'color-tela': 'Gris Claro' } },
        {
          sku: 'DEC-CHR-BGE',
          price: 320000,
          stock: 7,
          attributes: { 'color-tela': 'Arena / Beige' },
        },
      ],
    },
    {
      name: 'Vajillero Aparador Buffet 3 Puertas Alistonadas',
      categorySlug: 'comedor',
      price: 380000,
      stock: 8,
      skuPrefix: 'DEC-VAJ',
      description:
        'Mueble organizador con estantes interiores regulables y sistema de cierre suave soft-close.',
      image:
        'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Cama Sommier Tapizada con Cabecero Acolchado Queen',
      categorySlug: 'dormitorio',
      price: 590000,
      stock: 10,
      skuPrefix: 'DEC-BED',
      description:
        'Base sommier con cajones laterales ocultos y respaldo tapizado en pana aterciopelada.',
      image:
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'DEC-BED-QUEEN-GRS',
          price: 590000,
          stock: 5,
          attributes: { 'medida-cama': 'Queen Size', 'color-tela': 'Gris Claro' },
        },
        {
          sku: 'DEC-BED-KING-SAN',
          price: 680000,
          stock: 5,
          attributes: { 'medida-cama': 'King Size', 'color-tela': 'Arena / Beige' },
        },
      ],
    },
    {
      name: 'Mesa de Luz Flotante con Cajón Oculto en Paraíso',
      categorySlug: 'dormitorio',
      price: 89000,
      stock: 25,
      skuPrefix: 'DEC-NIG',
      description:
        'Mesa de noche de líneas puras con guías telescópicas y ranura pasacables para cargador.',
      image:
        'https://images.unsplash.com/photo-1533090161767-e6ffed986b88?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Lámpara Colgante Techo Globo Vidrio Opalino',
      categorySlug: 'iluminacion',
      price: 68000,
      stock: 30,
      skuPrefix: 'DEC-LGT-GLB',
      description:
        'Esfera de vidrio soplado opalino de 30cm con florón metálico y cable textil regulable.',
      image:
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'DEC-LGT-GLB-BRZ',
          price: 68000,
          stock: 15,
          attributes: { acabado: 'Bronce Viejo' },
        },
        { sku: 'DEC-LGT-GLB-BLK', price: 68000, stock: 15, attributes: { acabado: 'Negro Mate' } },
      ],
    },
    {
      name: 'Lámpara de Pie Nórdica Trípode Madera & Lino',
      categorySlug: 'iluminacion',
      price: 110000,
      stock: 16,
      skuPrefix: 'DEC-LGT-TRP',
      description:
        'Lámpara de pie de 1.50m de altura con pantalla cónica de lino natural y pedal de encendido.',
      image:
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Lámpara de Mesa Minimalista LED Recargable Touch',
      categorySlug: 'iluminacion',
      price: 49000,
      stock: 35,
      skuPrefix: 'DEC-LGT-TCH',
      description:
        'Lámpara portátil con dimmer táctil de 3 temperaturas de color y batería de 12 horas de duración.',
      image:
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Alfombra Nórdica Pelo Corto Lavable 2.00x1.50m',
      categorySlug: 'textiles',
      price: 145000,
      stock: 20,
      skuPrefix: 'DEC-RUG',
      description:
        'Alfombra tejida con diseño geométrico sutil, base antideslizante y apta para lavarropas.',
      image:
        'https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'DEC-RUG-GRS',
          price: 145000,
          stock: 10,
          attributes: { 'color-tela': 'Gris Claro' },
        },
        {
          sku: 'DEC-RUG-BGE',
          price: 145000,
          stock: 10,
          attributes: { 'color-tela': 'Arena / Beige' },
        },
      ],
    },
    {
      name: 'Manta de Sillón Throw Tejida a Mano Waffle 100% Algodón',
      categorySlug: 'textiles',
      price: 42000,
      stock: 35,
      skuPrefix: 'DEC-MNT',
      description:
        'Manta liviana de 1.80x1.30m con textura panal de abeja y terminación con flecos artesanales.',
      image:
        'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Pack x2 Fundas de Almohadón Lino Rústico 45x45cm',
      categorySlug: 'textiles',
      price: 26000,
      stock: 45,
      skuPrefix: 'DEC-ALM',
      description:
        'Fundas con cierre invisible y pestaña desflecada confeccionadas en lino puro prelavado.',
      image:
        'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'DEC-ALM-GRS', price: 26000, stock: 25, attributes: { 'color-tela': 'Gris Claro' } },
        {
          sku: 'DEC-ALM-BGE',
          price: 26000,
          stock: 20,
          attributes: { 'color-tela': 'Arena / Beige' },
        },
      ],
    },
    {
      name: 'Espejo Circular Borde Metálico 80cm de Diámetro',
      categorySlug: 'deco',
      price: 78000,
      stock: 22,
      skuPrefix: 'DEC-ESP',
      description:
        'Espejo de cristal float sin distorsión con marco de hierro tratado electrostáticamente.',
      image:
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'DEC-ESP-BLK', price: 78000, stock: 12, attributes: { acabado: 'Negro Mate' } },
        {
          sku: 'DEC-ESP-GLD',
          price: 85000,
          stock: 10,
          attributes: { acabado: 'Dorado Cepillado' },
        },
      ],
    },
    {
      name: 'Jarrón de Cerámica Artesanal Texturado Escultural',
      categorySlug: 'deco',
      price: 34000,
      stock: 30,
      skuPrefix: 'DEC-JAR',
      description:
        'Florero de gres esmaltado a mano con acabado mate rugoso para flores secas o ramas.',
      image:
        'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Vela Aromática de Cera de Soja en Vaso Ámbar 250g',
      categorySlug: 'deco',
      price: 18500,
      stock: 50,
      skuPrefix: 'DEC-VEL',
      description:
        'Vela con pabilo de madera crepitante y aceites esenciales naturales de vainilla & sándalo.',
      image:
        'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Set de 4 Cuadros Láminas Botánicas Marco Madera',
      categorySlug: 'deco',
      price: 52000,
      stock: 25,
      skuPrefix: 'DEC-ART',
      description:
        'Cuadros de 30x40cm impresos en papel fine art con vidrio antirreflejo y marco de kiri natural.',
      image:
        'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Difusor de Aromas Ultrasónico & Humidificador LED',
      categorySlug: 'deco',
      price: 45000,
      stock: 30,
      skuPrefix: 'DEC-DIF',
      description:
        'Vaporizador frío de 500ml con temporizador, luz ambiental cálida y apagado automático.',
      image:
        'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Bandeja Decorativa de Cemento Terrazzo 30cm',
      categorySlug: 'deco',
      price: 24000,
      stock: 35,
      skuPrefix: 'DEC-TRZ',
      description:
        'Bandeja organizadora para mesa ratona o tocador con piedras incrustadas pulidas a espejo.',
      image:
        'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
