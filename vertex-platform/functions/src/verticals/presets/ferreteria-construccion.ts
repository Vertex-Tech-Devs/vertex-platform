import type { BusinessVerticalDefinition } from '../../types/verticals.types';

export const FERRETERIA_CONSTRUCCION_PRESET: BusinessVerticalDefinition = {
  id: 'FERRETERIA_CONSTRUCCION',
  name: 'Ferretería & Construcción',
  icon: 'bi-tools',
  description: 'Herramientas eléctricas y manuales, fijaciones, pintura, electricidad y plomería.',
  bannerTitle: 'Herramientas Profesionales & Construcción',
  bannerSubtitle:
    'Maquinaria de alta potencia, insumos industriales y fijaciones para obras y hogar.',
  heroImages: [
    'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1920&h=700&fit=crop&q=80',
    'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=1920&h=700&fit=crop&q=80',
  ],
  featuredCategories: [
    {
      categoryId: 'herramientas-electricas',
      name: 'Herramientas Eléctricas',
      slug: 'herramientas-electricas',
      imageUrl:
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'herramientas-manuales',
      name: 'Herramientas Manuales',
      slug: 'herramientas-manuales',
      imageUrl:
        'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'pinturas',
      name: 'Pinturas & Impermeabilizantes',
      slug: 'pinturas',
      imageUrl:
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&h=400&fit=crop&q=80',
    },
    {
      categoryId: 'electricidad-iluminacion',
      name: 'Electricidad & Seguridad',
      slug: 'electricidad-iluminacion',
      imageUrl:
        'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&h=400&fit=crop&q=80',
    },
  ],
  categories: [
    {
      id: 'herramientas-electricas',
      name: 'Herramientas Eléctricas & Batería',
      slug: 'herramientas-electricas',
      order: 1,
      filterableAttributes: ['potencia-voltaje'],
    },
    {
      id: 'herramientas-manuales',
      name: 'Herramientas Manuales & Cajas',
      slug: 'herramientas-manuales',
      order: 2,
      filterableAttributes: [],
    },
    {
      id: 'pinturas',
      name: 'Pinturas, Esmaltes & Pincelería',
      slug: 'pinturas',
      order: 3,
      filterableAttributes: ['volumen-litros'],
    },
    {
      id: 'plomeria-gas',
      name: 'Plomería, Griferías & Gas',
      slug: 'plomeria-gas',
      order: 4,
      filterableAttributes: [],
    },
    {
      id: 'electricidad-iluminacion',
      name: 'Electricidad, Cables & Iluminación',
      slug: 'electricidad-iluminacion',
      order: 5,
      filterableAttributes: [],
    },
    {
      id: 'seguridad-obra',
      name: 'Seguridad Industrial & Protección',
      slug: 'seguridad-obra',
      order: 6,
      filterableAttributes: [],
    },
  ],
  attributes: [
    {
      id: 'potencia-voltaje',
      name: 'Voltaje / Alimentación',
      code: 'potencia-voltaje',
      type: 'select',
      values: ['220V Eléctrico', 'Batería 18V / 20V Li-Ion', 'Batería 12V Li-Ion'],
      required: false,
    },
    {
      id: 'volumen-litros',
      name: 'Presentación',
      code: 'volumen-litros',
      type: 'button',
      values: ['1 Litro', '4 Litros', '10 Litros', '20 Litros'],
      required: false,
    },
  ],
  colors: {
    primary: '#d97706',
    accent: '#2563eb',
    background: '#ffffff',
  },
  featureCards: [
    {
      title: 'Herramientas de Alto Rendimiento',
      content: 'Maquinaria con servicio técnico oficial y repuestos garantizados.',
    },
    {
      title: 'Asesoramiento Técnico en Obra',
      content: 'Te orientamos en el cálculo de materiales y fijaciones adecuadas.',
    },
    {
      title: 'Envíos a Domicilio y Obras',
      content: 'Logística ágil para que tu proyecto o reforma nunca se detenga.',
    },
  ],
  sampleProducts: [
    {
      name: 'Taladro Percutor Inalámbrico 20V Brushless con 2 Baterías y Maletín',
      categorySlug: 'herramientas-electricas',
      price: 185000,
      stock: 25,
      skuPrefix: 'FER-TAL-20V',
      description:
        'Motor sin escobillas de alto rendimiento, mandril metálico de 13mm autoajustable y torque de 65Nm.',
      image:
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Amoladora Angular 4 1/2" 850W con Traba de Eje',
      categorySlug: 'herramientas-electricas',
      price: 68000,
      stock: 35,
      skuPrefix: 'FER-AMO-850',
      description:
        '11.000 RPM, guarda protectora sin llave y empuñadura lateral antivibración de 2 posiciones.',
      image:
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Sierra Circular de Mano 7 1/4" 1400W Guía Láser',
      categorySlug: 'herramientas-electricas',
      price: 125000,
      stock: 20,
      skuPrefix: 'FER-SRC-1400',
      description:
        'Base de aluminio fundido, corte en bisel hasta 45° y disco de carburo de tungsteno de 24 dientes incluido.',
      image:
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Lijadora Orbital Rotorbital 125mm 300W con Bolsa Recolectora',
      categorySlug: 'herramientas-electricas',
      price: 59000,
      stock: 25,
      skuPrefix: 'FER-LIJ-ROT',
      description:
        'Velocidad variable de 6 niveles con fijación por abrojo velcro para acabado fino en madera y masilla.',
      image:
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Juego de Tubos Bocallaves y Llaves Crique 94 Piezas Cromo Vanadio',
      categorySlug: 'herramientas-manuales',
      price: 110000,
      stock: 30,
      skuPrefix: 'FER-SET-94',
      description:
        'Bocallaves 1/2" y 1/4", extensiones, juntas universales, puntas torx y maletín plástico reforzado.',
      image:
        'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Pinza Universal Aislada 1000V Electricista 8"',
      categorySlug: 'herramientas-manuales',
      price: 18500,
      stock: 50,
      skuPrefix: 'FER-PNZ-1000',
      description:
        'Filos templados por inducción para corte de alambre duro y mangos ergonómicos certificados IEC 60900.',
      image:
        'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Martillo Galponero Mango de Fibra de Vidrio Antivibración 20oz',
      categorySlug: 'herramientas-manuales',
      price: 22000,
      stock: 45,
      skuPrefix: 'FER-MAR-GLP',
      description:
        'Cabeza forjada en acero al carbono pulido con uña curva sacaclavos y grip de goma anatómico.',
      image:
        'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Cinta Métrica Profesional 8 Metros con Freno Automático y Gancho Magnético',
      categorySlug: 'herramientas-manuales',
      price: 14500,
      stock: 60,
      skuPrefix: 'FER-CNT-8M',
      description:
        'Cinta ancha de 25mm con recubrimiento de nylon antirrayaduras y carcasa engomada contra impactos.',
      image:
        'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Nivel Láser Autonivelante Cruz 360° con Trípode',
      categorySlug: 'herramientas-manuales',
      price: 95000,
      stock: 20,
      skuPrefix: 'FER-LSR-360',
      description:
        'Diodo verde de alta visibilidad hasta 30m para alineación precisa de cerámicos, tabiques y muebles.',
      image:
        'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Pintura Látex Interior Mate Lavable Antihongo Blanco',
      categorySlug: 'pinturas',
      price: 48000,
      stock: 40,
      skuPrefix: 'FER-LTX-INT',
      description:
        'Poder cubritivo superior con acabado terso antirreflejo, bajo olor y secado rápido al tacto en 1 hora.',
      image:
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=800&fit=crop&q=80',
      hasVariants: true,
      variants: [
        {
          sku: 'FER-LTX-4L',
          price: 48000,
          stock: 20,
          attributes: { 'volumen-litros': '4 Litros' },
        },
        {
          sku: 'FER-LTX-20L',
          price: 175000,
          stock: 20,
          attributes: { 'volumen-litros': '20 Litros' },
        },
      ],
    },
    {
      name: 'Membrana Líquida Poliuretánica Techados & Terrazas 20kg',
      categorySlug: 'pinturas',
      price: 125000,
      stock: 25,
      skuPrefix: 'FER-MMB-LIQ',
      description:
        'Impermeabilizante elástico transitable de alta resistencia a rayos UV y shock térmico.',
      image:
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Esmalte Sintético Satinado 3 en 1 Antióxido 4 Litros',
      categorySlug: 'pinturas',
      price: 52000,
      stock: 30,
      skuPrefix: 'FER-ESM-3IN1',
      description:
        'Convertidor, antióxido y esmalte de terminación para maderas y metales en interiores y exteriores.',
      image:
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Kit de Rodillo Antigota 22cm con Bandeja y 2 Pinceles',
      categorySlug: 'pinturas',
      price: 18500,
      stock: 55,
      skuPrefix: 'FER-ROD-KIT',
      description:
        'Fibras de microfibra de alta retención que evitan el salpicado en techos y paredes lisas.',
      image:
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Termofusora para Caños de Agua & Gas 800W con 6 Boquillas',
      categorySlug: 'plomeria-gas',
      price: 64000,
      stock: 20,
      skuPrefix: 'FER-TRM-FUS',
      description:
        'Regulador digital de temperatura hasta 300°C con boquillas de 20mm a 63mm y soporte de mesa.',
      image:
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Grifería Monocomando de Cocina Cuello Cisne Flexible',
      categorySlug: 'plomeria-gas',
      price: 78000,
      stock: 25,
      skuPrefix: 'FER-GRIF-COC',
      description:
        'Cuerpo de latón macizo cromado con aireador espumante anticalcáreo y cartucho cerámico de 35mm.',
      image:
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Multímetro Digital Tester Profesional con Medición de Temperatura',
      categorySlug: 'electricidad-iluminacion',
      price: 36000,
      stock: 30,
      skuPrefix: 'FER-MLT-DIG',
      description:
        'True RMS, detector de voltaje sin contacto (NCV), linterna LED y pantalla retroiluminada.',
      image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Reflector Proyector LED Exterior 100W IP65 Luz Fría',
      categorySlug: 'electricidad-iluminacion',
      price: 28000,
      stock: 40,
      skuPrefix: 'FER-RFL-100W',
      description:
        'Cuerpo de aluminio inyectado de alta disipación térmica y 9000 lúmenes de potencia lumínica.',
      image:
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Caja de Herramientas Plástica 19" con Bandeja y Organizadores',
      categorySlug: 'herramientas-manuales',
      price: 29000,
      stock: 35,
      skuPrefix: 'FER-CAJ-19',
      description:
        'Cierres metálicos de acero galvanizado con orificio para candado y compartimentos para tornillería en la tapa.',
      image:
        'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Zapatos de Seguridad Calzado de Trabajo Puntera de Acero',
      categorySlug: 'seguridad-obra',
      price: 62000,
      stock: 30,
      skuPrefix: 'FER-ZAP-SEG',
      description:
        'Cuero flor vacuno con suela de poliuretano bidensidad dieléctrica y plantilla confort anatómica.',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Máscara Protectora para Soldar Fotosensible Automática',
      categorySlug: 'seguridad-obra',
      price: 49000,
      stock: 20,
      skuPrefix: 'FER-SLD-MSK',
      description:
        'Celda solar con oscurecimiento variable DIN 9 a 13 en menos de 1/25.000 segundos.',
      image:
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
    {
      name: 'Silicona Neutra Selladora Transparente Cartucho 280ml',
      categorySlug: 'plomeria-gas',
      price: 7800,
      stock: 80,
      skuPrefix: 'FER-SIL-280',
      description:
        'Sellador 100% silicona para vidrio, aluminio, cerámica y sanitarios con aditivo antihongo.',
      image:
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=800&fit=crop&q=80',
      hasVariants: false,
    },
  ],
};
