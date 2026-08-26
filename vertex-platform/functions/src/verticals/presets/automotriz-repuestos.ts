import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const AUTOMOTRIZ_REPUESTOS_PRESET: BusinessVerticalDefinition = {
  id: 'AUTOMOTRIZ_REPUESTOS',
  name: 'Automotor & Repuestos',
  icon: 'bi-car-front',
  description:
    'Repuestos mecánicos, lubricantes, baterías, estética vehicular (detailing) y audio.',
  bannerTitle: 'Potencia, Mantenimiento & Cuidado Automotriz',
  bannerSubtitle:
    'Aceites sintéticos, filtros originales, baterías de alta duración y productos de detailing.',
  heroImages: [
    'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    {
      categoryId: 'lubricantes',
      name: 'Aceites & Lubricantes',
      slug: 'lubricantes',
      imageUrl:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'baterias',
      name: 'Baterías & Encendido',
      slug: 'baterias',
      imageUrl:
        'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'detailing',
      name: 'Estética & Detailing',
      slug: 'detailing',
      imageUrl:
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'accesorios-auto',
      name: 'Accesorios & Iluminación',
      slug: 'accesorios-auto',
      imageUrl:
        'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=600&h=400&fit=crop&q=80',
    },
  ],
  categories: [
    {
      id: 'lubricantes',
      name: 'Aceites, Fluidos & Filtros',
      slug: 'lubricantes',
      order: 1,
      filterableAttributes: ['viscosidad'],
    },
    {
      id: 'baterias',
      name: 'Baterías & Sistema Eléctrico',
      slug: 'baterias',
      order: 2,
      filterableAttributes: ['amperaje'],
    },
    {
      id: 'frenos-suspension',
      name: 'Frenos, Embragues & Suspensión',
      slug: 'frenos-suspension',
      order: 3,
      filterableAttributes: [],
    },
    {
      id: 'detailing',
      name: 'Detailing, Ceras & Limpieza',
      slug: 'detailing',
      order: 4,
      filterableAttributes: [],
    },
    {
      id: 'accesorios-auto',
      name: 'Accesorios de Interior, Confort & LED',
      slug: 'accesorios-auto',
      order: 5,
      filterableAttributes: [],
    },
  ],
  attributes: [
    {
      id: 'viscosidad',
      name: 'Viscosidad de Aceite',
      code: 'viscosidad',
      type: 'button',
      values: ['5W-30 Sintético', '5W-40 Sintético', '10W-40 Semisintético', '15W-40 Mineral'],
      required: false,
    },
    {
      id: 'amperaje',
      name: 'Capacidad de Batería',
      code: 'amperaje',
      type: 'button',
      values: ['12V 55Ah', '12V 65Ah', '12V 75Ah', '12V 90Ah'],
      required: false,
    },
  ],
  colors: {
    primary: '#dc2626',
    accent: '#1e293b',
    background: '#ffffff',
  },
  featureCards: [
    {
      title: 'Repuestos 100% Compatibles',
      content: 'Filtros, lubricantes y piezas con especificación y norma OEM de fábrica.',
    },
    {
      title: 'Detailing de Alto Brillo',
      content: 'Ceras sintéticas y productos testeados para proteger la pintura de tu auto.',
    },
    {
      title: 'Baterías con Instalación',
      content: 'Chequeo del alternador y garantía escrita por hasta 18 meses.',
    },
  ],
  sampleProducts: [
    {
      name: 'Aceite de Motor 100% Sintético 5W-30 Bidón 4 Litros',
      categorySlug: 'lubricantes',
      price: 54000,
      stock: 40,
      skuPrefix: 'AUT-OIL-5W30',
      description:
        'Tecnología sintética avanzada con aditivos antidesgaste para motores nafteros y diésel modernos.',
      image:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Aceite Semisintético 10W-40 Alto Kilometraje 4 Litros',
      categorySlug: 'lubricantes',
      price: 42000,
      stock: 45,
      skuPrefix: 'AUT-OIL-10W40',
      description:
        'Protección superior contra la formación de lodos y desgaste en motores con más de 100.000 km.',
      image:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Líquido Refrigerante Anticongelante Orgánico 50% Rosa 5 Litros',
      categorySlug: 'lubricantes',
      price: 19500,
      stock: 50,
      skuPrefix: 'AUT-REF-ORG',
      description: 'Protección anticorrosiva de radiador y bomba de agua de -35°C a +130°C.',
      image:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Líquido de Frenos Sintético DOT 4 Alta Temperatura 500ml',
      categorySlug: 'lubricantes',
      price: 11000,
      stock: 60,
      skuPrefix: 'AUT-DOT-4',
      description:
        'Punto de ebullición seco de 260°C para sistemas de frenos a disco, tambor y ABS.',
      image:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Batería de Auto 12V Libre de Mantenimiento',
      categorySlug: 'baterias',
      price: 145000,
      stock: 25,
      skuPrefix: 'AUT-BAT-12V',
      description:
        'Placas de aleación calcio-plata con visor de carga densímetro y 18 meses de garantía oficial.',
      image:
        'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        { sku: 'AUT-BAT-65AH', price: 145000, stock: 15, attributes: { amperaje: '12V 65Ah' } },
        { sku: 'AUT-BAT-75AH', price: 175000, stock: 10, attributes: { amperaje: '12V 75Ah' } },
      ],
    },
    {
      name: 'Cargador Arrancador Portátil Booster de Batería 12V 1000A',
      categorySlug: 'baterias',
      price: 89000,
      stock: 20,
      skuPrefix: 'AUT-BST-1000',
      description:
        'Arranca motores de hasta 6.0L nafta y 3.0L diésel. Incluye linterna LED y puertos Powerbank USB.',
      image:
        'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Cables Puente de Arranque de Batería Reforzados 500A 3 Metros',
      categorySlug: 'baterias',
      price: 24500,
      stock: 40,
      skuPrefix: 'AUT-CBL-ARR',
      description:
        'Pinzas de cobre con aislamiento de alta seguridad y cable de gran sección conductora.',
      image:
        'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Pastillas de Freno Cerámicas Delanteras (Juego 4 Ruedas)',
      categorySlug: 'frenos-suspension',
      price: 46000,
      stock: 30,
      skuPrefix: 'AUT-PST-FRN',
      description:
        'Frenado silencioso sin polvo residual en llantas con lámina antirruido shims de acero.',
      image:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Amortiguadores a Gas Delanteros Reforzados (Par)',
      categorySlug: 'frenos-suspension',
      price: 135000,
      stock: 15,
      skuPrefix: 'AUT-AMR-GAS',
      description:
        'Válvula multietapa de respuesta rápida que garantiza estabilidad y confort en curvas y baches.',
      image:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Shampoo pH Neutro Concentrado para Lavado de Auto 1L',
      categorySlug: 'detailing',
      price: 14500,
      stock: 60,
      skuPrefix: 'AUT-SHP-NEU',
      description:
        'Fórmula ultra espumosa para foam lance que no remueve ceras ni selladores previos.',
      image:
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Cera Líquida Rápida con Grafeno y SiO2 Hidrofóbica 500ml',
      categorySlug: 'detailing',
      price: 28000,
      stock: 45,
      skuPrefix: 'AUT-WAX-GRF',
      description:
        'Brillo espejo profundo, protección UV y repelencia extrema al agua y polvo por 6 meses.',
      image:
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Revividor y Acondicionador de Cubiertas y Plásticos Negro Mate 500ml',
      categorySlug: 'detailing',
      price: 16000,
      stock: 50,
      skuPrefix: 'AUT-REV-CUB',
      description:
        'Acabado natural no grasoso con inhibidores UV que evitan el cuarteamiento del caucho.',
      image:
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Guante de Lavado de Microfibra Chenille Ultrasuave',
      categorySlug: 'detailing',
      price: 9800,
      stock: 70,
      skuPrefix: 'AUT-GNT-MIC',
      description: 'Atrapa la suciedad sin rayar la laca ni dejar marcas circulares (swirls).',
      image:
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Toalla de Secado Twisted Loop 60x90cm 1200GSM',
      categorySlug: 'detailing',
      price: 24000,
      stock: 40,
      skuPrefix: 'AUT-TOW-DRY',
      description: 'Absorbe hasta 3 litros de agua en una sola pasada sin dejar pelusas ni vetas.',
      image:
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Kit de Luces LED Cree H7 Canbus 20.000 Lúmenes (Par)',
      categorySlug: 'accesorios-auto',
      price: 39000,
      stock: 35,
      skuPrefix: 'AUT-LED-H7',
      description:
        'Luz blanca fría 6500K con disipador térmico de cobre y driver Canbus anti-error en tablero.',
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Compresor de Aire Portátil Digital Inflador de Neumáticos 150 PSI',
      categorySlug: 'accesorios-auto',
      price: 48000,
      stock: 30,
      skuPrefix: 'AUT-CMP-DIG',
      description:
        'Batería recargable integrada con corte automático por presión programada y linterna de emergencia.',
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Soporte de Celular para Auto con Carga Inalámbrica Qi 15W y Sensor',
      categorySlug: 'accesorios-auto',
      price: 32000,
      stock: 40,
      skuPrefix: 'AUT-HLD-QI',
      description:
        'Apertura y cierre automático con sensor infrarrojo y fijación a la rejilla de ventilación.',
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Juego de Cubrealfombras de Goma Pesada Universales 4 Piezas',
      categorySlug: 'accesorios-auto',
      price: 36000,
      stock: 35,
      skuPrefix: 'AUT-ALF-GOM',
      description:
        'Bordes elevados antiderrame con base antideslizante adaptable por corte a cualquier modelo.',
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Aspiradora de Auto Portátil 12V 120W de Alta Potencia',
      categorySlug: 'accesorios-auto',
      price: 29000,
      stock: 30,
      skuPrefix: 'AUT-ASP-12V',
      description: 'Filtro HEPA lavable con boquilla para rincones y cepillo para tapizados.',
      image:
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Limpia Inyectores Nafta Fórmula Concentrada 300ml',
      categorySlug: 'lubricantes',
      price: 13500,
      stock: 65,
      skuPrefix: 'AUT-INJ-CLN',
      description:
        'Restaura la potencia del motor, reduce el consumo de combustible y limpia válvulas y cámara de combustión.',
      image:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Funda Cubreauto Impermeable Térmica con Felpa Interior Talle L',
      categorySlug: 'accesorios-auto',
      price: 68000,
      stock: 20,
      skuPrefix: 'AUT-COV-THM',
      description:
        'Protección contra granizo ligero, rayos solares UV, lluvia ácida y resina de árboles.',
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
