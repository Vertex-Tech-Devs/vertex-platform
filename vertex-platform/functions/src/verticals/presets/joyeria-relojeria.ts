import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const JOYERIA_RELOJERIA_PRESET: BusinessVerticalDefinition = {
  id: 'JOYERIA_RELOJERIA',
  name: 'Joyería & Relojería',
  icon: 'bi-gem',
  description: 'Anillos de compromiso, collares, pulseras de plata/oro y relojes de alta gama.',
  bannerTitle: 'Elegancia Eterna, Joyas & Relojería Fina',
  bannerSubtitle:
    'Piezas exclusivas en plata 925, oro 18k, piedras preciosas y relojes automáticos suizos.',
  heroImages: [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    {
      categoryId: 'anillos',
      name: 'Anillos & Alianzas',
      slug: 'anillos',
      imageUrl:
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'collares',
      name: 'Collares & Dijes',
      slug: 'collares',
      imageUrl:
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'pulseras',
      name: 'Pulseras & Brazaletes',
      slug: 'pulseras',
      imageUrl:
        'https://images.unsplash.com/photo-1611591475152-47794389424e?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'relojes',
      name: 'Relojes de Autor',
      slug: 'relojes',
      imageUrl:
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&h=400&fit=crop&q=80',
    },
  ],
  categories: [
    {
      id: 'anillos',
      name: 'Anillos, Solitarios & Alianzas',
      slug: 'anillos',
      order: 1,
      filterableAttributes: ['talle-anillo', 'material-metal'],
    },
    {
      id: 'collares',
      name: 'Collares, Gargantillas & Dijes',
      slug: 'collares',
      order: 2,
      filterableAttributes: ['material-metal'],
    },
    {
      id: 'pulseras',
      name: 'Pulseras, Esclavas & Brazaletes',
      slug: 'pulseras',
      order: 3,
      filterableAttributes: ['material-metal'],
    },
    {
      id: 'aros',
      name: 'Aros, Argollas & Trepadores',
      slug: 'aros',
      order: 4,
      filterableAttributes: ['material-metal'],
    },
    {
      id: 'relojes',
      name: 'Relojería Automática & Cuarzo',
      slug: 'relojes',
      order: 5,
      filterableAttributes: ['tipo-malla'],
    },
  ],
  attributes: [
    {
      id: 'material-metal',
      name: 'Metal',
      code: 'material-metal',
      type: 'select',
      values: ['Plata 925 Rodinada', 'Oro Amarillo 18k', 'Oro Blanco 18k', 'Oro Rosa 18k'],
      required: true,
    },
    {
      id: 'talle-anillo',
      name: 'Medida / Talle de Anillo',
      code: 'talle-anillo',
      type: 'button',
      values: ['N° 12', 'N° 14', 'N° 16', 'N° 18', 'N° 20'],
      required: false,
    },
    {
      id: 'tipo-malla',
      name: 'Malla de Reloj',
      code: 'tipo-malla',
      type: 'select',
      values: ['Acero Inoxidable 316L', 'Cuero Genuino Italiano', 'Caucho Siliconado'],
      required: false,
    },
  ],
  colors: {
    primary: '#b45309',
    accent: '#1e293b',
    background: '#ffffff',
  },
  featureCards: [
    {
      title: 'Metales Nobles Certificados',
      content: 'Plata 925 de ley y oro 18 kilates con certificado de autenticidad.',
    },
    {
      title: 'Grabados Personalizados',
      content: 'Grabamos tus alianzas y medallas sin costo adicional.',
    },
    {
      title: 'Estuche de Lujo',
      content: 'Cada joya se entrega en estuche rígido con moño de raso listo para regalar.',
    },
  ],
  sampleProducts: [
    {
      name: 'Anillo Solitario Compromiso Diamante Moissanita 1ct Plata 925',
      categorySlug: 'anillos',
      price: 165000,
      stock: 20,
      skuPrefix: 'JOY-SOL-1CT',
      description:
        'Piedra central de corte brillante excelente engarzada en 6 garras con baño de rodio blanco antialérgico.',
      image:
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'JOY-SOL-14',
          price: 165000,
          stock: 10,
          attributes: { 'talle-anillo': 'N° 14', 'material-metal': 'Plata 925 Rodinada' },
        },
        {
          sku: 'JOY-SOL-16',
          price: 165000,
          stock: 10,
          attributes: { 'talle-anillo': 'N° 16', 'material-metal': 'Plata 925 Rodinada' },
        },
      ],
    },
    {
      name: 'Par de Alianzas Tradicionales Oro Amarillo 18k Cinta Media Caña',
      categorySlug: 'anillos',
      price: 490000,
      stock: 10,
      skuPrefix: 'JOY-ALI-18K',
      description:
        '4 gramos por par de oro 18 kilates nacional con pulido a espejo y grabado interior personalizado sin cargo.',
      image:
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Anillo Sin Fin Circón Pavé Plata 925',
      categorySlug: 'anillos',
      price: 48000,
      stock: 35,
      skuPrefix: 'JOY-SINF',
      description:
        'Hilera continua de microcircones cúbicos engarzados a grano para un brillo ininterrumpido.',
      image:
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Collar Punto de Luz Circonia Brillante Cadena Veneciana 45cm',
      categorySlug: 'collares',
      price: 52000,
      stock: 40,
      skuPrefix: 'JOY-COL-PDL',
      description:
        'Dije engarzado en bisel de plata 925 con cadena veneciana diamantada ultrabrillante.',
      image:
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'JOY-COL-PLT',
          price: 52000,
          stock: 20,
          attributes: { 'material-metal': 'Plata 925 Rodinada' },
        },
        {
          sku: 'JOY-COL-ORO',
          price: 68000,
          stock: 20,
          attributes: { 'material-metal': 'Oro Amarillo 18k' },
        },
      ],
    },
    {
      name: 'Gargantilla Choker Eslabones Gruesos Plata Inflada 925',
      categorySlug: 'collares',
      price: 95000,
      stock: 25,
      skuPrefix: 'JOY-CHK-ESL',
      description: 'Eslabones paperclip de 40cm con extensor y cierre marinero timón.',
      image:
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Collar Medalla Sol & Luna Grabada con Zafiro Azul',
      categorySlug: 'collares',
      price: 78000,
      stock: 30,
      skuPrefix: 'JOY-COL-SOL',
      description:
        'Medalla vintage acuñada artesanalmente con piedra zafiro reconstituido central.',
      image:
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Pulsera Tennis Circones Cúbicos Engarzados 4 Garras',
      categorySlug: 'pulseras',
      price: 110000,
      stock: 25,
      skuPrefix: 'JOY-PUL-TNS',
      description:
        'Diseño clásico icónico con cierre de seguridad doble traba en plata de ley 925.',
      image:
        'https://images.unsplash.com/photo-1611591475152-47794389424e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Esclava Rígida Abierta Minimalista Oro Rosa 18k Laminado',
      categorySlug: 'pulseras',
      price: 64000,
      stock: 30,
      skuPrefix: 'JOY-ESC-RS',
      description:
        'Brazalete adaptable con terminaciones esféricas pulidas de gran confort diario.',
      image:
        'https://images.unsplash.com/photo-1611591475152-47794389424e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Pulsera Dijes Charms Compatibles Plata 925',
      categorySlug: 'pulseras',
      price: 85000,
      stock: 35,
      skuPrefix: 'JOY-PUL-CHM',
      description:
        'Cadena de serpiente con broche corazón pavé de circones para coleccionar dijes.',
      image:
        'https://images.unsplash.com/photo-1611591475152-47794389424e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Aros Argollas Tubo Gruesas Huggies Plata 925 18mm',
      categorySlug: 'aros',
      price: 36000,
      stock: 45,
      skuPrefix: 'JOY-ARO-ARG',
      description:
        'Argollitas de cierre a presión click italianas, livianas e ideales para uso continuo.',
      image:
        'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Aros Trepadores Hojas con Micro Pavé de Cristales',
      categorySlug: 'aros',
      price: 42000,
      stock: 35,
      skuPrefix: 'JOY-ARO-TRP',
      description:
        'Recorren la curva de la oreja con fijación trasera anatómica sin necesidad de perforaciones extra.',
      image:
        'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Aros Solitarios Perlas Cultivadas de Río Perno Oro 18k',
      categorySlug: 'aros',
      price: 58000,
      stock: 30,
      skuPrefix: 'JOY-ARO-PRL',
      description:
        'Perlas naturales esféricas de 8mm de lustre perlado nacarado con tuerca mariposa de oro.',
      image:
        'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Reloj Automático Esqueleto Hombre Acero Inoxidable 42mm',
      categorySlug: 'relojes',
      price: 380000,
      stock: 15,
      skuPrefix: 'REL-AUT-SKL',
      description:
        'Movimiento automático japonés con 40hs de reserva de marcha, cristal de zafiro y fondo visto.',
      image:
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'REL-AUT-STL',
          price: 380000,
          stock: 8,
          attributes: { 'tipo-malla': 'Acero Inoxidable 316L' },
        },
        {
          sku: 'REL-AUT-LEA',
          price: 380000,
          stock: 7,
          attributes: { 'tipo-malla': 'Cuero Genuino Italiano' },
        },
      ],
    },
    {
      name: 'Reloj Cronógrafo Deportivo Diver 200M Cuarzo Suizo',
      categorySlug: 'relojes',
      price: 290000,
      stock: 18,
      skuPrefix: 'REL-CRN-DVR',
      description:
        'Bisel giratorio cerámico unidireccional, corona a rosca, agujas superluminova y sumergible 20 ATM.',
      image:
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Reloj Dama Elegance Ultra Slim Oro Rosa Cristal Facetado 32mm',
      categorySlug: 'relojes',
      price: 195000,
      stock: 20,
      skuPrefix: 'REL-DAM-ELG',
      description:
        'Caja delgada de 6mm con cuadrante de nácar genuino y malla milanesa de ajuste magnético.',
      image:
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Dije Cruz Latina de Oro 18k con Circones',
      categorySlug: 'collares',
      price: 89000,
      stock: 20,
      skuPrefix: 'JOY-DIJ-CRZ',
      description:
        'Cruz clásica pulida de 2.5cm de altura en oro legítimo con reasa triangular reforzada.',
      image:
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Tobillera Doble Cadena con Bolitas Plata 925 26cm',
      categorySlug: 'pulseras',
      price: 29000,
      stock: 40,
      skuPrefix: 'JOY-TOB-DBL',
      description:
        'Cadena con esferas diamantadas y extensor de 4cm para ajuste perfecto al tobillo.',
      image:
        'https://images.unsplash.com/photo-1611591475152-47794389424e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Alhajero Joyero Organizador de Viaje Cuero Ecológico',
      categorySlug: 'anillos',
      price: 24500,
      stock: 35,
      skuPrefix: 'JOY-ACC-ALH',
      description:
        'Interior de terciopelo suave con ranuras para anillos, ganchos para collares y divisores desmontables.',
      image:
        'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Limpia Joyas Líquido Profesional de Inmersión Plata & Oro 120ml',
      categorySlug: 'anillos',
      price: 12000,
      stock: 50,
      skuPrefix: 'JOY-ACC-CLN',
      description:
        'Devuelve el brillo instantáneo en 10 segundos removiendo sulfatos y oxidación superficial.',
      image:
        'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Gemelos de Camisa Elegantes Plata 925 con Ónix Negro',
      categorySlug: 'aros',
      price: 74000,
      stock: 20,
      skuPrefix: 'JOY-GEM-ONX',
      description:
        'Piedra ónix natural tallada a mano con cierre de balancín clásico para puño francés.',
      image:
        'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Anillo Sello de Hombre Macizo Plata 925 Personalizable',
      categorySlug: 'anillos',
      price: 89000,
      stock: 18,
      skuPrefix: 'JOY-SEL-HMB',
      description:
        'Mesa lisa rectangular de 14x12mm apta para grabado de iniciales o escudo heráldico.',
      image:
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
