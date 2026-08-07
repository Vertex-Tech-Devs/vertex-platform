import type { OAuth2Client } from 'google-auth-library';
import * as logger from 'firebase-functions/logger';
import { apiFetch, retry } from './helpers';

// Helper to convert standard JavaScript values to Firestore REST API Value types
function toFirestoreValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (
    val instanceof Date ||
    (typeof val === 'object' &&
      val &&
      'toISOString' in val &&
      typeof (val as any).toISOString === 'function')
  ) {
    return { timestampValue: (val as any).toISOString() };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Convert a standard JavaScript object into a Firestore fields wrapper
export function toFirestoreFields(obj: Record<string, unknown>): {
  fields: Record<string, unknown>;
} {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

// Unsplash Image Helper
function u(id: string, w: number, h: number): string {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;
}

// Mock Clients (from legacy client-data.ts)
const CLIENT_DATA = [
  { fullName: 'Valentina García', email: 'valenti.garcia@gmail.com', phone: '+54 9 11 4523-8801' },
  { fullName: 'Mateo Rodríguez', email: 'mateo.rodriguez@gmail.com', phone: '+54 9 11 5634-9912' },
  { fullName: 'Camila López', email: 'camila.lopez@outlook.com', phone: '+54 9 11 4712-3345' },
  { fullName: 'Santiago Martínez', email: 'santi.martinez@gmail.com', phone: '+54 9 11 6789-2200' },
  { fullName: 'Lucía González', email: 'luci.gonzalez@yahoo.com.ar', phone: '+54 9 11 3345-6678' },
];

const CLIENT_DAYS_LIST = [150, 90, 60, 30, 10];

const CLIENT_ORDER_COUNTS = [5, 4, 3, 2, 1];

// Mock Orders (from legacy order-data.ts)
const ORDER_DATA = [
  {
    clientIdx: 0,
    daysAgo: 2,
    status: 'delivered',
    paymentMethod: 'MercadoPago',
    shippingCost: 1200,
    street: 'Av. Corrientes 4531',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    zip: '1414',
    lines: [
      { prodIdx: 0, qty: 2, talle: 'M', color: 'Negro' },
      { prodIdx: 1, qty: 1, talle: '32', color: 'Azul' },
    ],
  },
  {
    clientIdx: 1,
    daysAgo: 5,
    status: 'delivered',
    paymentMethod: 'Tarjeta de crédito',
    shippingCost: 800,
    street: 'San Martín 882',
    city: 'Córdoba',
    state: 'Córdoba',
    zip: '5000',
    lines: [{ prodIdx: 2, qty: 1, talle: '40', color: 'Blanco' }],
  },
  {
    clientIdx: 2,
    daysAgo: 8,
    status: 'shipped',
    paymentMethod: 'Transferencia bancaria',
    shippingCost: 1500,
    street: 'Av. Rivadavia 3200',
    city: 'Rosario',
    state: 'Santa Fe',
    zip: '2000',
    lines: [
      { prodIdx: 3, qty: 1, color: 'Negro' },
      { prodIdx: 4, qty: 1, color: 'Azul' },
    ],
  },
  {
    clientIdx: 3,
    daysAgo: 3,
    status: 'delivered',
    paymentMethod: 'MercadoPago',
    shippingCost: 1200,
    street: 'Belgrano 145',
    city: 'Mendoza',
    state: 'Mendoza',
    zip: '5500',
    lines: [
      { prodIdx: 0, qty: 1, talle: 'L', color: 'Blanco' },
      { prodIdx: 2, qty: 1, talle: '38', color: 'Negro' },
    ],
  },
  {
    clientIdx: 4,
    daysAgo: 1,
    status: 'processing',
    paymentMethod: 'Débito',
    shippingCost: 900,
    street: '9 de Julio 2200',
    city: 'La Plata',
    state: 'Buenos Aires',
    zip: '1900',
    lines: [{ prodIdx: 1, qty: 1, talle: '30', color: 'Negro' }],
  },
  {
    clientIdx: 5,
    daysAgo: 14,
    status: 'delivered',
    paymentMethod: 'MercadoPago',
    shippingCost: 2200,
    street: 'Mitre 567',
    city: 'Mar del Plata',
    state: 'Buenos Aires',
    zip: '7600',
    lines: [
      { prodIdx: 3, qty: 2, talle: 'S', color: 'Gris' },
      { prodIdx: 16, qty: 1, color: 'Azul' },
    ],
  },
  {
    clientIdx: 6,
    daysAgo: 20,
    status: 'delivered',
    paymentMethod: 'Tarjeta de crédito',
    shippingCost: 1800,
    street: 'Sarmiento 1100',
    city: 'Tucumán',
    state: 'Tucumán',
    zip: '4000',
    lines: [
      { prodIdx: 11, qty: 1, talle: '40', color: 'Gris' },
      { prodIdx: 18, qty: 1, color: 'Negro' },
    ],
  },
  {
    clientIdx: 7,
    daysAgo: 0,
    status: 'pending',
    paymentMethod: 'MercadoPago',
    shippingCost: 1200,
    street: 'Av. Santa Fe 3888',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    zip: '1425',
    lines: [{ prodIdx: 19, qty: 1, talle: 'M', color: 'Caqui' }],
  },
  {
    clientIdx: 8,
    daysAgo: 35,
    status: 'delivered',
    paymentMethod: 'Transferencia bancaria',
    shippingCost: 1500,
    street: 'Colón 456',
    city: 'Salta',
    state: 'Salta',
    zip: '4400',
    lines: [
      { prodIdx: 6, qty: 1, talle: '30', color: 'Beige' },
      { prodIdx: 17, qty: 1, color: 'Negro' },
    ],
  },
  {
    clientIdx: 9,
    daysAgo: 7,
    status: 'shipped',
    paymentMethod: 'MercadoPago',
    shippingCost: 1200,
    street: 'Florida 855',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    zip: '1005',
    lines: [
      { prodIdx: 4, qty: 1, talle: 'XL', color: 'Rojo' },
      { prodIdx: 13, qty: 1, talle: '43', color: 'Rojo' },
    ],
  },
  {
    clientIdx: 10,
    daysAgo: 50,
    status: 'delivered',
    paymentMethod: 'Débito',
    shippingCost: 900,
    street: 'Hipólito Yrigoyen 2054',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    zip: '1089',
    lines: [
      { prodIdx: 8, qty: 1, talle: '32', color: 'Negro' },
      { prodIdx: 2, qty: 1, talle: 'M', color: 'Azul' },
    ],
  },
  {
    clientIdx: 11,
    daysAgo: 4,
    status: 'processing',
    paymentMethod: 'Tarjeta de crédito',
    shippingCost: 1500,
    street: 'Maipú 750',
    city: 'Córdoba',
    state: 'Córdoba',
    zip: '5000',
    lines: [{ prodIdx: 10, qty: 2, talle: '39', color: 'Blanco' }],
  },
  {
    clientIdx: 12,
    daysAgo: 90,
    status: 'delivered',
    paymentMethod: 'MercadoPago',
    shippingCost: 2000,
    street: 'Av. Colón 1400',
    city: 'Mendoza',
    state: 'Mendoza',
    zip: '5500',
    lines: [
      { prodIdx: 15, qty: 1, color: 'Negro' },
      { prodIdx: 17, qty: 1, color: 'Beige' },
    ],
  },
  {
    clientIdx: 13,
    daysAgo: 6,
    status: 'cancelled',
    paymentMethod: 'MercadoPago',
    shippingCost: 1200,
    street: 'San Lorenzo 900',
    city: 'Rosario',
    state: 'Santa Fe',
    zip: '2000',
    lines: [{ prodIdx: 14, qty: 1, talle: 'XL', color: 'Negro' }],
  },
  {
    clientIdx: 14,
    daysAgo: 12,
    status: 'shipped',
    paymentMethod: 'Transferencia bancaria',
    shippingCost: 1500,
    street: 'Rivadavia 500',
    city: 'La Plata',
    state: 'Buenos Aires',
    zip: '1900',
    lines: [
      { prodIdx: 5, qty: 1, talle: '36', color: 'Negro' },
      { prodIdx: 8, qty: 1, talle: '32', color: 'Gris' },
    ],
  },
  {
    clientIdx: 15,
    daysAgo: 25,
    status: 'delivered',
    paymentMethod: 'MercadoPago',
    shippingCost: 1200,
    street: 'Pellegrini 1200',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    zip: '1074',
    lines: [
      { prodIdx: 14, qty: 1, talle: '44', color: 'Negro' },
      { prodIdx: 17, qty: 2, color: 'Marrón' },
    ],
  },
  {
    clientIdx: 16,
    daysAgo: 60,
    status: 'delivered',
    paymentMethod: 'Débito',
    shippingCost: 800,
    street: 'Laprida 400',
    city: 'Mar del Plata',
    state: 'Buenos Aires',
    zip: '7600',
    lines: [{ prodIdx: 19, qty: 1, talle: 'S', color: 'Azul' }],
  },
  {
    clientIdx: 17,
    daysAgo: 3,
    status: 'processing',
    paymentMethod: 'Tarjeta de crédito',
    shippingCost: 1500,
    street: 'Tucumán 1500',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    zip: '1049',
    lines: [
      { prodIdx: 0, qty: 1, talle: 'XS', color: 'Blanco' },
      { prodIdx: 16, qty: 1, color: 'Azul' },
      { prodIdx: 10, qty: 1, talle: '38', color: 'Gris' },
    ],
  },
  {
    clientIdx: 18,
    daysAgo: 45,
    status: 'delivered',
    paymentMethod: 'MercadoPago',
    shippingCost: 1800,
    street: 'Paraguay 2600',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    zip: '1121',
    lines: [{ prodIdx: 13, qty: 1, talle: 'XL', color: 'Caqui' }],
  },
  {
    clientIdx: 19,
    daysAgo: 9,
    status: 'shipped',
    paymentMethod: 'MercadoPago',
    shippingCost: 2200,
    street: 'Av. Cabildo 3100',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    zip: '1429',
    lines: [
      { prodIdx: 18, qty: 1, talle: '38', color: 'Beige' },
      { prodIdx: 3, qty: 2, talle: 'M', color: 'Blanco' },
    ],
  },
];

// Product details for the 3 verticals
const VERTICAL_SEEDS: Record<
  string,
  {
    categories: Array<{
      id: string;
      name: string;
      slug: string;
      parentId: string | null;
      filterableAttributes: string[];
    }>;
    attributes: Array<{ id: string; name: string; values: string[] }>;
    products: Array<{
      id: string;
      name: string;
      description: string;
      categoryId: string;
      price: number;
      discount?: number;
      image: string;
      images?: string[];
      variantAttributes: string[];
    }>;
  }
> = {
  indumentaria: {
    categories: [
      {
        id: 'remeras',
        name: 'Remeras',
        slug: 'remeras',
        parentId: null,
        filterableAttributes: ['talle-ropa', 'color'],
      },
      {
        id: 'pantalones',
        name: 'Pantalones',
        slug: 'pantalones',
        parentId: null,
        filterableAttributes: ['talle-pantalon', 'color'],
      },
      {
        id: 'zapatillas',
        name: 'Zapatillas',
        slug: 'zapatillas',
        parentId: null,
        filterableAttributes: ['talle-calzado', 'color'],
      },
      {
        id: 'accesorios',
        name: 'Accesorios',
        slug: 'accesorios',
        parentId: null,
        filterableAttributes: ['color'],
      },
      {
        id: 'camperas',
        name: 'Camperas',
        slug: 'camperas',
        parentId: null,
        filterableAttributes: ['talle-ropa', 'color'],
      },
    ],
    attributes: [
      { id: 'talle-ropa', name: 'Talle (ropa)', values: ['S', 'M', 'L'] },
      { id: 'talle-calzado', name: 'Talle (calzado)', values: ['38', '40', '42'] },
      { id: 'talle-pantalon', name: 'Talle (pantalón)', values: ['30', '32', '34'] },
      { id: 'color', name: 'Color', values: ['Negro', 'Blanco', 'Azul'] },
      { id: 'material', name: 'Material', values: ['Algodón', 'Denim'] },
    ],
    products: [
      {
        id: 'remera-pima',
        name: 'Remera Básica Pima 180g',
        description:
          'Confeccionada en algodón Pima 180 g/m² con certificado GOTS. Costuras reinforced, cuello canalé y lavados garantizados sin deformación. La base ideal para cualquier look.',
        categoryId: 'remeras',
        price: 8500,
        discount: 0,
        image: u('1521572163474-6864f9cf17ab', 600, 600),
        images: [
          u('1521572163474-6864f9cf17ab', 600, 600),
          u('1503342217505-b0a15ec3261c', 600, 600),
        ],
        variantAttributes: ['talle-ropa', 'color'],
      },
      {
        id: 'jean-indigo',
        name: 'Jean Slim Fit Índigo 12oz',
        description:
          'Denim selvático 100% algodón 12 oz con lavado índigo profundo. Corte slim que abraza la silueta sin limitar el movimiento. Cinco bolsillos clásicos, costura naranja característica.',
        categoryId: 'pantalones',
        price: 22500,
        discount: 0,
        image: u('1542272604-787c3835535d', 600, 600),
        images: [u('1542272604-787c3835535d', 600, 600), u('1541099649105-f69ad21f3246', 600, 600)],
        variantAttributes: ['talle-pantalon', 'color'],
      },
      {
        id: 'running-air-zoom',
        name: 'Zapatilla Running Air Zoom V3',
        description:
          'Mediasuela de espuma EVA + cámara de aire en talón y antepié. Upper de malla 3D ultraliviana con refuerzos de TPU. Suela de goma con canales multidireccionales. Peso: 285 g.',
        categoryId: 'zapatillas',
        price: 52000,
        discount: 0,
        image: u('1542291026-7eec264c27ff', 600, 600),
        images: [u('1542291026-7eec264c27ff', 600, 600), u('1491553895911-0055eca6402d', 600, 600)],
        variantAttributes: ['talle-calzado', 'color'],
      },
      {
        id: 'rinonera-crossbody',
        name: 'Riñonera Crossbody 2L',
        description:
          'Cuerpo principal + bolsillo frontal con cierre YKK y organizador interior. Correa ajustable doble uso: cintura o bandolera. Tela ripstop resistente al agua.',
        categoryId: 'accesorios',
        price: 9800,
        discount: 10,
        image: u('1548036328-c9fa89d128fa', 600, 600),
        images: [u('1548036328-c9fa89d128fa', 600, 600), u('1553062407-98eeb64c6a62', 600, 600)],
        variantAttributes: ['color'],
      },
      {
        id: 'campera-rompevientos',
        name: 'Campera Rompevientos Packable',
        description:
          'Membrana impermeabilizante 3.000 mm de presión hídrica. Costuras termoselladas. Empacable en su propio bolsillo trasero. Peso total: 340 g.',
        categoryId: 'camperas',
        price: 38000,
        discount: 0,
        image: u('1551028719-00167b16eac5', 600, 600),
        images: [u('1551028719-00167b16eac5', 600, 600), u('1551537482-f2075a1d41f2', 600, 600)],
        variantAttributes: ['talle-ropa', 'color'],
      },
      {
        id: 'buzo-oversize-hoodie',
        name: 'Buzo Hoodie Oversize Premium',
        description:
          'Frisa invisible 100% algodón peinado de 360g. Capucha doble con cordones al tono y bolsillo canguro reforzado.',
        categoryId: 'camperas',
        price: 28000,
        discount: 0,
        image: u('1556905055-8f358a7a47b2', 600, 600),
        variantAttributes: ['talle-ropa', 'color'],
      },
      {
        id: 'camisa-lino-manga-corta',
        name: 'Camisa de Lino Manga Corta',
        description:
          'Lino 100% italiano pre-lavado para máxima frescura en días cálidos. Botones de nácar natural y corte relaxed.',
        categoryId: 'remeras',
        price: 18500,
        discount: 5,
        image: u('1598033129183-c4f50c736f10', 600, 600),
        variantAttributes: ['talle-ropa', 'color'],
      },
      {
        id: 'pantalon-jogger-cargo',
        name: 'Pantalón Jogger Cargo Gabardina',
        description:
          'Gabardina elastizada 98% algodón 2% elastano. Cintura elastizada con cordón y seis bolsillos funcionales.',
        categoryId: 'pantalones',
        price: 21000,
        discount: 0,
        image: u('1624378439575-d8705ad7ae80', 600, 600),
        variantAttributes: ['talle-pantalon', 'color'],
      },
      {
        id: 'zapatilla-urban-leather',
        name: 'Zapatilla Urbana Leather Retro',
        description:
          'Cuero vacuno genuino con detalles de gamuza natural. Suela cóncava de goma cosida 360 grados.',
        categoryId: 'zapatillas',
        price: 46000,
        discount: 0,
        image: u('1525966222134-fcfa99b8ae77', 600, 600),
        variantAttributes: ['talle-calzado', 'color'],
      },
      {
        id: 'gorra-dad-cap-cotton',
        name: 'Gorra Dad Cap 100% Algodón',
        description:
          'Gorra de 6 paneles desestructurada con hebilla metálica regulable y visera curva retro.',
        categoryId: 'accesorios',
        price: 6500,
        discount: 0,
        image: u('1588850561407-ed78c282e89b', 600, 600),
        variantAttributes: ['color'],
      },
      {
        id: 'lentes-sol-wayfarer',
        name: 'Lentes de Sol Polarizados UV400',
        description:
          'Armazón de acetato de celulosa con bisagras metálicas de 5 barriles. Cristal TAC polarizado antirreflex.',
        categoryId: 'accesorios',
        price: 14500,
        discount: 15,
        image: u('1572635196237-14b3f281503f', 600, 600),
        variantAttributes: ['color'],
      },
      {
        id: 'campera-cuero-biker',
        name: 'Campera Biker Cuero Ecológico',
        description:
          'Corte cruzado con cierres y broches de metal plateado. Forro interior de satén matelaseado.',
        categoryId: 'camperas',
        price: 64000,
        discount: 0,
        image: u('1521223890158-f9f7c3d5d504', 600, 600),
        variantAttributes: ['talle-ropa', 'color'],
      },
    ],
  },
  gastronomia: {
    categories: [
      {
        id: 'hamburguesas',
        name: 'Hamburguesas',
        slug: 'hamburguesas',
        parentId: null,
        filterableAttributes: ['coccion'],
      },
      {
        id: 'acompanamientos',
        name: 'Acompañamientos',
        slug: 'acompanamientos',
        parentId: null,
        filterableAttributes: [],
      },
      { id: 'bebidas', name: 'Bebidas', slug: 'bebidas', parentId: null, filterableAttributes: [] },
    ],
    attributes: [{ id: 'coccion', name: 'Cocción', values: ['Jugosa', 'A punto', 'Cocida'] }],
    products: [
      {
        id: 'burger-deluxe',
        name: 'Burger Deluxe Vertex',
        description:
          'Medallón de carne 100% de novillo seleccionado (180g), cheddar fundido, lechuga, tomate y salsa ahumada Vertex en pan de papa.',
        categoryId: 'hamburguesas',
        price: 8900,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
        variantAttributes: ['coccion'],
      },
      {
        id: 'papas-rusticas',
        name: 'Papas Rústicas de la Casa',
        description:
          'Bastones de papa rústica fritos en doble cocción para mayor crocancia por fuera y suavidad por dentro. Acompañados de alioli casero.',
        categoryId: 'acompanamientos',
        price: 3500,
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800',
        variantAttributes: [],
      },
      {
        id: 'limonada-casa',
        name: 'Limonada de la Casa',
        description:
          'Limonada fresca con menta fresca, jengibre y almíbar de limón casero. Servida con hielo.',
        categoryId: 'bebidas',
        price: 2200,
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800',
        variantAttributes: [],
      },
      {
        id: 'burger-bacon-bbq',
        name: 'Burger Double Bacon BBQ',
        description:
          'Doble medallón 120g, cheddar doble, tocino crocante ahumado y salsa barbacoa de la casa.',
        categoryId: 'hamburguesas',
        price: 9600,
        image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800',
        variantAttributes: ['coccion'],
      },
      {
        id: 'nuggets-pollo',
        name: 'Crispy Chicken Nuggets x10',
        description:
          'Bocaditos de pechuga de pollo rebozados con cereales y especias. Incluye dip de dip honey mustard.',
        categoryId: 'acompanamientos',
        price: 4200,
        image: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800',
        variantAttributes: [],
      },
      {
        id: 'empano-queso',
        name: 'Tequeños Rellenos de Queso x6',
        description: 'Deditos de masa artesanal fritos rellenos de queso llanero derretido.',
        categoryId: 'acompanamientos',
        price: 3800,
        image: 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=800',
        variantAttributes: [],
      },
      {
        id: 'cerveza-artesanal-ipa',
        name: 'Cerveza Artesanal IPA 500ml',
        description: 'India Pale Ale con intenso aroma a lúpulo cítrico y amargor balanceado.',
        categoryId: 'bebidas',
        price: 2800,
        image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800',
        variantAttributes: [],
      },
      {
        id: 'pinta-stout',
        name: 'Cerveza Artesanal Stout 500ml',
        description: 'Cerveza negra con notas tostadas de café y chocolate amargo.',
        categoryId: 'bebidas',
        price: 2800,
        image: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=800',
        variantAttributes: [],
      },
      {
        id: 'burger-veggie-mushroom',
        name: 'Burger Veggie Hongos & Brie',
        description:
          'Medallón de garbanzos y girasol, hongos salteados al tomillo, queso brie fundido y rúcula.',
        categoryId: 'hamburguesas',
        price: 8700,
        image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=800',
        variantAttributes: [],
      },
      {
        id: 'arros-aros-cebolla',
        name: 'Aros de Cebolla Crocantes',
        description:
          'Anillos de cebolla dulce empanados en panko japonés y fritos al punto dorado.',
        categoryId: 'acompanamientos',
        price: 3200,
        image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=800',
        variantAttributes: [],
      },
      {
        id: 'milkshake-chocolate',
        name: 'Milkshake de Chocolate & OREO',
        description:
          'Helado artesanal de chocolate cremoso con trozos de galletitas OREO y crema batida.',
        categoryId: 'bebidas',
        price: 3400,
        image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800',
        variantAttributes: [],
      },
      {
        id: 'tiramisu-artesanal',
        name: 'Tiramisú Artesanal en Frasco',
        description:
          'Vainillas embebidas en espresso illy, queso mascarpone y cacao amargo espolvoreado.',
        categoryId: 'acompanamientos',
        price: 3900,
        image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
        variantAttributes: [],
      },
    ],
  },
  retail: {
    categories: [
      {
        id: 'hogar',
        name: 'Hogar & Decoración',
        slug: 'hogar-y-decoracion',
        parentId: null,
        filterableAttributes: ['color'],
      },
      {
        id: 'tecnologia',
        name: 'Tecnología',
        slug: 'tecnologia',
        parentId: null,
        filterableAttributes: [],
      },
      {
        id: 'papeleria',
        name: 'Oficina & Papelería',
        slug: 'oficina-y-papeleria',
        parentId: null,
        filterableAttributes: [],
      },
    ],
    attributes: [{ id: 'color', name: 'Color', values: ['Madera', 'Negro', 'Blanco'] }],
    products: [
      {
        id: 'lampara-minimalista',
        name: 'Lámpara Minimalista Vertex',
        description:
          'Lámpara de mesa moderna con base de madera natural, pantalla cilíndrica y luz cálida regulable. Ideal para escritorios o mesas de luz.',
        categoryId: 'hogar',
        price: 19500,
        image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
        variantAttributes: ['color'],
      },
      {
        id: 'teclado-mecanico-rgb',
        name: 'Teclado Mecánico 60% RGB',
        description:
          'Teclado mecánico ultra-compacto con switches táctiles, retroiluminación RGB configurable y cable USB-C desmontable.',
        categoryId: 'tecnologia',
        price: 45000,
        image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800',
        variantAttributes: [],
      },
      {
        id: 'cuaderno-de-cuero',
        name: 'Cuaderno Cuero Ecológico A5',
        description:
          'Cuaderno con tapa de cuero ecológico, hojas rayadas de papel ahuesado de 90g y cierre con banda elástica premium.',
        categoryId: 'papeleria',
        price: 7800,
        image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800',
        variantAttributes: [],
      },
      {
        id: 'auriculares-bluetooth-pro',
        name: 'Auriculares Wireless Noise Cancelling',
        description:
          'Auriculares over-ear con cancelación activa de ruido (ANC), drivers de 40mm y 30hs de autonomía.',
        categoryId: 'tecnologia',
        price: 62000,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
        variantAttributes: [],
      },
      {
        id: 'mouse-ergonomico-wireless',
        name: 'Mouse Ergonómico Vertical Wireless',
        description:
          'Diseño vertical de 57° que reduce la tensión muscular en la muñeca. Sensor óptico de 2400 DPI.',
        categoryId: 'tecnologia',
        price: 18500,
        image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800',
        variantAttributes: [],
      },
      {
        id: 'parlante-portatil-waterproof',
        name: 'Parlante Bluetooth Waterproof 20W',
        description:
          'Parlante compacto resistente al agua IPX7 con radiador pasivo de bajos y batería de 12 horas.',
        categoryId: 'tecnologia',
        price: 32000,
        image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800',
        variantAttributes: [],
      },
      {
        id: 'velador-nordico-madera',
        name: 'Velador Nórdico LED Regulable',
        description: 'Cuerpo en madera de eucalipto curvada con iluminación LED de tacto gradual.',
        categoryId: 'hogar',
        price: 14200,
        image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800',
        variantAttributes: ['color'],
      },
      {
        id: 'difusor-aromatico-ultrasonico',
        name: 'Difusor Aromático Ultrasónico 500ml',
        description:
          'Humidificador de ambientes con temporizador, luz nocturna de 7 colores y tecnología ultrasónica silenciosa.',
        categoryId: 'hogar',
        price: 11800,
        image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800',
        variantAttributes: [],
      },
      {
        id: 'maceta-ceramica-diseno',
        name: 'Maceta Cerámica Artesanal Diseño',
        description:
          'Maceta hecha a mano en torno alfarero con esmalte mate semibrillante y plato de drenaje incluido.',
        categoryId: 'hogar',
        price: 6900,
        image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800',
        variantAttributes: [],
      },
      {
        id: 'organizador-escritorio-bambu',
        name: 'Organizador de Escritorio Bambú',
        description:
          'Módulo de escritorio en bambú 100% sustentable con compartimentos para bolígrafos, notas y celular.',
        categoryId: 'papeleria',
        price: 9500,
        image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800',
        variantAttributes: [],
      },
      {
        id: 'termo-acero-inoxidable-1l',
        name: 'Termo Acero Inoxidable 1L Doble Capa',
        description:
          'Termo térmico con aislamiento al vacío que mantiene líquidos calientes o fríos por 24 horas.',
        categoryId: 'hogar',
        price: 24000,
        image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
        variantAttributes: [],
      },
      {
        id: 'soporte-laptop-aluminio',
        name: 'Soporte Ergonómico Laptop Aluminio',
        description:
          'Estructura de aluminio anodizado plegable de 6 niveles de altura para MacBook y laptops de hasta 17".',
        categoryId: 'tecnologia',
        price: 15500,
        image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800',
        variantAttributes: [],
      },
    ],
  },
};

// Deletion helper for clear-all operations (storeId-scoped: only deletes docs belonging to the given store)
async function clearCollection(
  auth: OAuth2Client,
  projectId: string,
  collectionName: string,
  storeId: string,
): Promise<void> {
  try {
    const res = (await apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`,
      { method: 'GET', quotaProject: projectId },
    )) as { documents?: Array<{ name: string }> };

    if (res && res.documents && res.documents.length > 0) {
      for (const doc of res.documents) {
        // doc.name is projects/{projectId}/databases/(default)/documents/{collectionName}/{docId}
        const docPath = doc.name.split('/documents/')[1];
        const docId = docPath.split('/').pop() ?? '';
        // Flat multi-tenant model: only delete docs that belong to this store (id prefix)
        if (!docId.startsWith(`${storeId}-`)) continue;

        // If it's a product, we should also clean its subcollection 'variants' first
        if (collectionName === 'products') {
          await clearCollection(auth, projectId, `${docPath}/variants`, storeId);
        }

        await apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`,
          { method: 'DELETE', quotaProject: projectId },
        );
      }
    }
  } catch (err: any) {
    const isNotFound =
      err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
    if (!isNotFound) {
      console.warn(`[SeedEngine] Error clearing collection ${collectionName}:`, err);
    }
  }
}

async function deleteDocumentPath(
  auth: OAuth2Client,
  projectId: string,
  docPath: string,
): Promise<void> {
  try {
    await apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`,
      { method: 'DELETE', quotaProject: projectId },
    );
  } catch (err: any) {
    const isNotFound =
      err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
    if (!isNotFound) {
      console.warn(`[SeedEngine] Error deleting document ${docPath}:`, err);
    }
  }
}

// Check if store has existing products or orders to prevent overwriting production stores
async function checkStoreSafety(
  auth: OAuth2Client,
  projectId: string,
  storeId: string,
): Promise<void> {
  logger.info(
    `[SeedEngine] Safety validation: Checking products and orders in project "${projectId}" store "${storeId}"...`,
  );
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const runQuery = async (collectionId: string): Promise<boolean> => {
    try {
      const res = (await apiFetch(auth, `${base}:runQuery`, {
        method: 'POST',
        quotaProject: projectId,
        body: {
          structuredQuery: {
            from: [{ collectionId }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'storeId' },
                op: 'EQUAL',
                value: { stringValue: storeId },
              },
            },
            limit: 1,
          },
        },
      })) as Array<{ document?: unknown }>;
      return (res ?? []).some((r) => r && r.document);
    } catch (err: any) {
      const isNotFound =
        err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
      if (!isNotFound) throw err;
      return false;
    }
  };

  const hasProducts = await runQuery('products');
  const hasOrders = await runQuery('orders');

  if (hasProducts || hasOrders) {
    throw new Error(
      'La tienda ya contiene productos o pedidos activos. Se canceló la regeneración para proteger la base de datos de producción.',
    );
  }
}

// Multi-dimension variant combinations generator
function generateVariantCombinations(
  attributesList: Array<{ id: string; name: string; values: string[] }>,
  variantAttrIds: string[],
): Array<Record<string, string>> {
  const selectedAttrs = attributesList.filter((a) => variantAttrIds.includes(a.id));
  if (selectedAttrs.length === 0) return [];

  let result: Array<Record<string, string>> = [{}];
  selectedAttrs.forEach((attr) => {
    const newResult: Array<Record<string, string>> = [];
    result.forEach((existing) => {
      attr.values.forEach((value) => {
        newResult.push({ ...existing, [attr.id]: value });
      });
    });
    result = newResult;
  });
  return result;
}

// Prefix all deterministic catalog ids with the store prefix so flat collections never collide across stores
function prefixSeedIds<T extends { attributes: any[]; categories: any[]; products: any[] }>(
  seed: T,
  prefix: string,
): T {
  const attrId = new Map(seed.attributes.map((a) => [a.id, `${prefix}${a.id}`]));
  const catId = new Map(seed.categories.map((c) => [c.id, `${prefix}${c.id}`]));
  return {
    ...seed,
    attributes: seed.attributes.map((a) => ({ ...a, id: attrId.get(a.id) })),
    categories: seed.categories.map((c) => ({
      ...c,
      id: catId.get(c.id),
      parentId: c.parentId ? catId.get(c.parentId) : null,
      filterableAttributes: (c.filterableAttributes || []).map((f: string) => attrId.get(f) || f),
    })),
    products: seed.products.map((p) => ({
      ...p,
      id: `${prefix}${p.id}`,
      categoryId: catId.get(p.categoryId) || p.categoryId,
      variantAttributes: (p.variantAttributes || []).map((va: string) => attrId.get(va) || va),
    })),
  } as T;
}

/**
 * Seeds isolated child project database with category trees, attributes, and products with variants.
 */
export async function seedStoreData(
  auth: OAuth2Client,
  projectId: string,
  tenantId: string,
  verticalId: string,
  storeName?: string,
  includeMockData = true,
  bypassSafety = false,
  storeId?: string,
): Promise<void> {
  // Builds a flat Firestore path segment (multi-tenant isolation is enforced via the storeId field)
  const tp = (path: string) => path;
  const storePrefix = `${storeId ?? tenantId}-`;
  const sName = storeName ? storeName.trim() : 'Vertex';
  let rawSeed = VERTICAL_SEEDS[verticalId];
  let targetVertical = verticalId;
  if (!rawSeed) {
    logger.info(
      `[SeedEngine] No seeds defined for vertical: ${verticalId}. Falling back gracefully to "retail" seed.`,
    );
    rawSeed = VERTICAL_SEEDS['retail'];
    targetVertical = 'retail';
  }

  // Helper to customize dynamic seed values
  function customizeSeed(obj: any, val: string): any {
    if (typeof obj === 'string') {
      return obj.replace(/Vertex/g, val);
    }
    if (Array.isArray(obj)) {
      return obj.map((x) => customizeSeed(x, val));
    }
    if (obj !== null && typeof obj === 'object') {
      const res: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k] = customizeSeed(v, val);
      }
      return res;
    }
    return obj;
  }

  const seed = prefixSeedIds(customizeSeed(rawSeed, sName), storePrefix);

  // 1. Run Safety Check
  if (!bypassSafety) {
    await checkStoreSafety(auth, projectId, storeId ?? tenantId);
  }

  logger.info(
    `[SeedEngine] Safety check passed. Cleaning up database to begin a pristine seed on project "${projectId}"...`,
  );

  // 2. Clear Database Collections (store-scoped so other tenants on the shared shard are untouched)
  const collectionsToClear = ['products', 'categories', 'clients', 'orders', 'attributes'];
  for (const col of collectionsToClear) {
    await clearCollection(auth, projectId, tp(col), storeId ?? tenantId);
  }
  await deleteDocumentPath(auth, projectId, tp(`banners/home_${storeId}`));
  await deleteDocumentPath(auth, projectId, tp(`pages/aboutUs_${storeId}`));
  await deleteDocumentPath(auth, projectId, tp(`configuracion/store_${storeId}`));
  await deleteDocumentPath(auth, projectId, tp(`configuracion/footer_${storeId}`));
  await deleteDocumentPath(auth, projectId, tp(`configuracion/hero_${storeId}`));

  logger.info(
    `[SeedEngine] Clean-up complete. Starting database seeding for vertical: "${targetVertical}"`,
  );

  // Seed default Mercado Pago test credentials in store_payments
  const defaultMpConfig = {
    payments: {
      mercadoPago: {
        accessTokenSecret: 'mp-access-token-default',
        accessTokenMasked: 'TEST-****-****',
        accountEmail: 'test_user_vertex@testuser.com',
        accountUserId: '123456789',
        validationStatus: 'valid',
        validationMessage: 'Credenciales de prueba predeterminadas de plataforma',
        validatedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  };

  const paymentDocId = storeId ?? tenantId;
  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`store_payments/${paymentDocId}`)}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(defaultMpConfig),
          quotaProject: projectId,
        },
      ),
    5,
    6000,
  );

  // 3. Seed Attributes
  for (const attr of seed.attributes) {
    const docData = {
      storeId: storeId ?? tenantId,
      name: attr.name,
      values: attr.values,
    };
    await retry(
      () =>
        apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`attributes/${attr.id}`)}`,
          {
            method: 'PATCH',
            body: toFirestoreFields(docData),
            quotaProject: projectId,
          },
        ),
      5,
      6000,
    );
  }
  logger.info(`[SeedEngine] Seeded ${seed.attributes.length} attributes.`);

  // 4. Seed Categories
  for (const cat of seed.categories) {
    const categoryImages: Record<string, string> = {
      remeras: '1521572163474-6864f9cf17ab',
      pantalones: '1542272604-787c3835535d',
      zapatillas: '1542291026-7eec264c27ff',
      accesorios: '1511499767150-a48a237f0083',
      camperas: '1551028719-00167b16eac5',
      hamburguesas: '1568901346375-23c9450c58cd',
      acompanamientos: '1573080496219-bb080dd4f877',
      bebidas: '1513558161293-cdaf765ed2fd',
      hogar: '1507473885765-e6ed057f782c',
      tecnologia: '1595225476474-87563907a212',
      papeleria: '1531346878377-a5be20888e57',
    };
    const photoId = categoryImages[cat.slug] || '1521572163474-6864f9cf17ab';
    const docData = {
      storeId: storeId ?? tenantId,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      filterableAttributes: cat.filterableAttributes,
      imageUrl: u(photoId, 400, 400),
      createdAt: new Date(),
    };
    await retry(
      () =>
        apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`categories/${cat.id}`)}`,
          {
            method: 'PATCH',
            body: toFirestoreFields(docData),
            quotaProject: projectId,
          },
        ),
      5,
      6000,
    );
  }
  logger.info(`[SeedEngine] Seeded ${seed.categories.length} categories.`);

  // 5. Seed Products and their Variants
  const seededProducts: Array<{
    id: string;
    name: string;
    finalPrice: number;
    image: string;
    variantAttributes: string[];
  }> = [];

  // Products are always seeded as they are editable catalog data
  const productsToSeed = seed.products;
  for (const prod of productsToSeed) {
    const discount = prod.discount ?? 0;
    const finalPrice = discount > 0 ? Math.round(prod.price * (1 - discount / 100)) : prod.price;

    let totalStock = 0;
    const inStockAttributes: Record<string, string[]> = {};

    // Initial write of the product
    const initialProdData = {
      storeId: storeId ?? tenantId,
      name: prod.name,
      description: prod.description,
      categoryId: prod.categoryId,
      price: prod.price,
      discount,
      finalPrice,
      image: prod.image,
      images: prod.images ?? [prod.image],
      totalStock: 0,
      variantAttributes: prod.variantAttributes,
      inStockAttributes: {},
      featured: true,
      active: true,
      createdAt: new Date(),
    };

    await retry(
      () =>
        apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`products/${prod.id}`)}`,
          {
            method: 'PATCH',
            body: toFirestoreFields(initialProdData),
            quotaProject: projectId,
          },
        ),
      5,
      6000,
    );

    // If product has variants, generate them
    if (prod.variantAttributes.length > 0) {
      const combinations = generateVariantCombinations(seed.attributes, prod.variantAttributes);
      let varIdx = 0;
      for (const combo of combinations) {
        const stock = Math.floor(Math.random() * 80) + 5;
        totalStock += stock;

        Object.entries(combo).forEach(([attrId, value]) => {
          if (!inStockAttributes[attrId]) {
            inStockAttributes[attrId] = [];
          }
          if (!inStockAttributes[attrId].includes(value)) {
            inStockAttributes[attrId].push(value);
          }
        });

        const variantDocId = `${storeId ?? tenantId}-var-${varIdx}`;
        const variantData = {
          storeId: storeId ?? tenantId,
          productId: prod.id,
          sku: `${prod.id.toUpperCase()}-${varIdx++}`,
          attributes: combo,
          stock,
        };

        await retry(
          () =>
            apiFetch(
              auth,
              `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`products/${prod.id}/variants/${variantDocId}`)}`,
              {
                method: 'PATCH',
                body: toFirestoreFields(variantData),
                quotaProject: projectId,
              },
            ),
          5,
          6000,
        );
      }

      // Update the main product with variant aggregation (total stock, in-stock sizes/colors)
      const updatedProdData = {
        totalStock,
        inStockAttributes,
      };

      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`products/${prod.id}`)}`,
            {
              method: 'PATCH',
              body: toFirestoreFields({
                ...initialProdData,
                ...updatedProdData,
              }),
              quotaProject: projectId,
            },
          ),
        5,
        6000,
      );
    } else {
      // Products without variants get a standard stock
      totalStock = 50;
      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`products/${prod.id}`)}`,
            {
              method: 'PATCH',
              body: toFirestoreFields({
                ...initialProdData,
                totalStock,
              }),
              quotaProject: projectId,
            },
          ),
        5,
        6000,
      );
    }

    seededProducts.push({
      id: prod.id,
      name: prod.name,
      finalPrice,
      image: prod.image,
      variantAttributes: prod.variantAttributes,
    });
  }
  logger.info(`[SeedEngine] Seeded ${seededProducts.length} products and their variants.`);

  if (includeMockData) {
    // 6. Seed Clients (from CLIENT_DATA)
    const seededClients: Array<{ id: string; fullName: string; email: string; phone: string }> = [];
    let clientIdx = 0;
    // Seed all clients from CLIENT_DATA
    for (const client of CLIENT_DATA) {
      const days = CLIENT_DAYS_LIST[clientIdx] ?? 30;
      const clientDocId = `${storeId ?? tenantId}-cli-${clientIdx}`;
      const clientPayload = {
        storeId: storeId ?? tenantId,
        fullName: client.fullName,
        email: client.email,
        phone: client.phone,
        firstOrderDate: new Date(Date.now() - days * 86_400_000),
        lastOrderDate: new Date(Date.now() - Math.max(1, Math.floor(days / 4)) * 86_400_000),
        numberOfOrders: CLIENT_ORDER_COUNTS[clientIdx] ?? 1,
        createdAt: new Date(),
      };

      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`clients/${clientDocId}`)}`,
            {
              method: 'PATCH',
              body: toFirestoreFields(clientPayload),
              quotaProject: projectId,
            },
          ),
        5,
        6000,
      );

      seededClients.push({
        id: clientDocId,
        fullName: client.fullName,
        email: client.email,
        phone: client.phone,
      });
      clientIdx++;
    }
    logger.info(`[SeedEngine] Seeded ${seededClients.length} clients.`);

    // 7. Seed Orders (Dynamic mapping using catalog lines & modulo for products)
    let orderIdx = 0;
    // Seed all orders from ORDER_DATA
    for (const order of ORDER_DATA) {
      const cl = seededClients[order.clientIdx % seededClients.length];
      const orderDate = new Date(Date.now() - order.daysAgo * 86_400_000);
      const orderDocId = `${storeId ?? tenantId}-ord-${orderIdx++}`;

      let subtotal = 0;
      const items = order.lines.map((line) => {
        const p = seededProducts[line.prodIdx % seededProducts.length];
        const attrs: Record<string, string> = {};

        // Dyn-map variants
        if (p.variantAttributes.includes('color')) {
          attrs['color'] = line.color;
        } else if (p.variantAttributes.includes('coccion')) {
          attrs['coccion'] = 'A punto';
        }

        if (p.variantAttributes.includes('talle-ropa') && line.talle) {
          attrs['talle-ropa'] = line.talle;
        } else if (p.variantAttributes.includes('talle-pantalon') && line.talle) {
          attrs['talle-pantalon'] = line.talle;
        } else if (p.variantAttributes.includes('talle-calzado') && line.talle) {
          attrs['talle-calzado'] = line.talle;
        }

        const linePrice = p.finalPrice;
        subtotal += linePrice * line.qty;

        return {
          productId: p.id,
          variantId: `var-${p.id}`,
          productName: p.name,
          quantity: line.qty,
          price: linePrice,
          productImage: p.image,
          attributes: attrs,
        };
      });

      const orderPayload = {
        storeId: storeId ?? tenantId,
        userId: `user-${cl.id}`,
        clientName: cl.fullName,
        clientEmail: cl.email,
        clientPhone: cl.phone,
        orderDate,
        total: subtotal + order.shippingCost,
        status: order.status,
        items,
        shippingAddress: {
          street: order.street,
          city: order.city,
          state: order.state,
          zipCode: order.zip,
          country: 'Argentina',
        },
        paymentDetails: {
          paymentMethod: order.paymentMethod,
          shippingCost: order.shippingCost,
          taxAmount: Math.round(subtotal * 0.21),
          subtotal,
        },
        stockDecremented: order.status !== 'cancelled',
        notes: orderIdx % 5 === 0 ? 'Cliente solicitó embalaje de regalo.' : null,
      };

      await retry(
        () =>
          apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`orders/${orderDocId}`)}`,
            {
              method: 'PATCH',
              body: toFirestoreFields(orderPayload),
              quotaProject: projectId,
            },
          ),
        5,
        6000,
      );
    }
    logger.info(`[SeedEngine] Seeded ${orderIdx} orders.`);
  } else {
    logger.info('[SeedEngine] includeMockData is false. Skipping clients and orders seeding.');
  }

  // 8. Seed Site Banners (siteContent/homePage)
  const isIndumentaria = targetVertical === 'indumentaria';
  const isGastronomia = targetVertical === 'gastronomia';

  const heroImages = isIndumentaria
    ? [
        u('1558769132-cb1aea458c5e', 1920, 700),
        u('1483985988355-763728e1935b', 1920, 700),
        u('1469334031218-e382a71b716b', 1920, 700),
        u('1445205170230-053b83016050', 1920, 700),
        u('1490481651871-ab68de25d43d', 1920, 700),
      ]
    : isGastronomia
      ? [
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&h=700&fit=crop&q=80',
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&h=700&fit=crop&q=80',
          'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1920&h=700&fit=crop&q=80',
        ]
      : [
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1920&h=700&fit=crop&q=80',
          'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=700&fit=crop&q=80',
          'https://images.unsplash.com/photo-1449247709967-d4461a6857f3?w=1920&h=700&fit=crop&q=80',
        ];

  const bannerTitle = isIndumentaria
    ? 'Nueva Colección 2026'
    : isGastronomia
      ? `Sabores Únicos ${sName}`
      : 'Espacios con Identidad';

  const featuredCategories = isIndumentaria
    ? [
        {
          categoryId: 'remeras',
          name: 'Remeras',
          slug: 'remeras',
          imageUrl: u('1521572163474-6864f9cf17ab', 600, 400),
        },
        {
          categoryId: 'camperas',
          name: 'Camperas',
          slug: 'camperas',
          imageUrl: u('1551537482-f2075a1d41f2', 600, 400),
        },
        {
          categoryId: 'zapatillas',
          name: 'Zapatillas',
          slug: 'zapatillas',
          imageUrl: u('1491553895911-0055eca6402d', 600, 400),
        },
      ]
    : isGastronomia
      ? [
          {
            categoryId: 'hamburguesas',
            name: 'Hamburguesas',
            slug: 'hamburguesas',
            imageUrl:
              'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop&q=80',
          },
          {
            categoryId: 'acompanamientos',
            name: 'Acompañamientos',
            slug: 'acompanamientos',
            imageUrl:
              'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop&q=80',
          },
          {
            categoryId: 'bebidas',
            name: 'Bebidas',
            slug: 'bebidas',
            imageUrl:
              'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&h=400&fit=crop&q=80',
          },
        ]
      : [
          {
            categoryId: 'hogar',
            name: 'Hogar & Decoración',
            slug: 'hogar-y-decoracion',
            imageUrl:
              'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=400&fit=crop&q=80',
          },
          {
            categoryId: 'tecnologia',
            name: 'Tecnología',
            slug: 'tecnologia',
            imageUrl:
              'https://images.unsplash.com/photo-1595225476474-87563907a212?w=600&h=400&fit=crop&q=80',
          },
          {
            categoryId: 'papeleria',
            name: 'Oficina & Papelería',
            slug: 'oficina-y-papeleria',
            imageUrl:
              'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=400&fit=crop&q=80',
          },
        ];

  const homePagePayload = {
    storeId: storeId ?? tenantId,
    heroImages: heroImages.map((url) => ({ imageUrl: url })),
    carouselSettings: { interval: 4500, showIndicators: true },
    title: bannerTitle,
    buttonText: 'Explorar todo',
    buttonLink: '/shop/catalog',
    featuredCategories,
    lastUpdated: new Date(),
  };

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`banners/home_${storeId}`)}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(homePagePayload),
          quotaProject: projectId,
        },
      ),
    5,
    6000,
  );
  logger.info(`[SeedEngine] Seeded banners/home_${storeId} successfully.`);

  // 8.5 Seed Base Hero Config (configuracion/hero_{storeId})
  const heroPayload = {
    storeId: storeId ?? tenantId,
    tenantId,
    title: bannerTitle,
    buttonText: 'Explorar todo',
    buttonLink: '/shop/catalog',
    heroImages: heroImages.map((url) => ({ imageUrl: url })),
    carouselSettings: { interval: 4500, showIndicators: true },
    lastUpdated: new Date(),
  };

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`configuracion/hero_${storeId}`)}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(heroPayload),
          quotaProject: projectId,
        },
      ),
    5,
    6000,
  );
  logger.info(`[SeedEngine] Seeded configuracion/hero_${storeId} successfully.`);

  // 9. Seed About Us (pages/aboutUs)
  const aboutUsSubtitle = isIndumentaria
    ? 'Moda argentina con identidad propia desde 2015.'
    : isGastronomia
      ? 'Pasión por la cocina y el buen servicio desde 2018.'
      : 'Diseño minimalista y calidad para tu vida diaria desde 2016.';

  const centralDescription = isIndumentaria
    ? `${sName} nació en 2015 en el barrio de Palermo (Buenos Aires) con un objetivo claro: ` +
      'democratizar la moda de calidad. Trabajamos exclusivamente con proveedores certificados, ' +
      'materiales de primera línea y diseños propios que reflejan la identidad urbana argentina.\n\n' +
      'Hoy somos un equipo de 30 personas, despachamos a todo el país y contamos con más de 50.000 ' +
      'clientes activos que nos eligen por la calidad, el servicio y los precios justos.'
    : isGastronomia
      ? `${sName} comenzó como un pequeño bistró en San Telmo y se convirtió en el ` +
        'punto de encuentro de los amantes de la comida real. Seleccionamos ingredientes locales frescos ' +
        'y preparamos cada plato con técnicas artesanales y un toque de innovación constante.\n\n' +
        'Servicio impecable, un ambiente cálido y la obsesión por el sabor definen nuestra filosofía diaria.'
      : `${sName} nació para ayudarte a construir espacios que inspiren paz, productividad y bienestar. ` +
        'Curamos minuciosamente cada producto combinando estética minimalista y funcionalidad atemporal.\n\n' +
        'Creemos en el consumo consciente y en que cada objeto de tu entorno debe sumar valor real y durabilidad.';

  const aboutUsBannerUrl = isIndumentaria
    ? u('1558769132-cb1aea458c5e', 1920, 600)
    : isGastronomia
      ? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&h=600&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1920&h=600&fit=crop&q=80';

  const aboutUsCentralUrl = isIndumentaria
    ? u('1483985988355-763728e1935b', 800, 600)
    : isGastronomia
      ? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop&q=80';

  const aboutUsPayload = {
    storeId: storeId ?? tenantId,
    bannerTitle: 'Quiénes Somos',
    bannerSubtitle: aboutUsSubtitle,
    bannerImageUrl: aboutUsBannerUrl,
    centralTitle: 'Nuestra Historia',
    centralImageUrl: aboutUsCentralUrl,
    centralDescription,
    cardsSectionTitle: '¿Por qué elegirnos?',
    featureCards: [
      {
        title: 'Calidad sin compromiso',
        content:
          'Cada producto pasa por tres etapas de control de calidad antes de llegar a tus manos. Solo trabajamos con materiales de primera línea y proveedores certificados.',
      },
      {
        title: 'Envíos en 24-72 hs',
        content:
          'Despachamos a cualquier punto de Argentina en 24 a 72 horas hábiles con seguimiento en tiempo real. Envío express sin demoras.',
      },
      {
        title: 'Cambios sin burocracia',
        content:
          'Si la selección no fue la correcta o algo no te convenció, gestionamos el cambio o devolución en menos de 48 horas sin preguntas ni costos adicionales.',
      },
      {
        title: 'Producción responsable',
        content:
          'Embalajes 100% reciclables, tintas ecológicas y apoyo activo a marcas locales y talleres de producción justa.',
      },
    ],
  };

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`pages/aboutUs_${storeId}`)}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(aboutUsPayload),
          quotaProject: projectId,
        },
      ),
    5,
    6000,
  );
  logger.info(`[SeedEngine] Seeded pages/aboutUs_${storeId} successfully.`);

  // 10. Seed Footer (configuracion/footer_{storeId})
  const normalizedSlug = sName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const footerPayload = {
    tenantId,
    storeId: storeId || tenantId,
    storeName: sName,
    tagline: 'Tu tienda de moda de marca blanca',
    strapline: '',
    logoUrl: '',
    faviconUrl: '',
    colors: {
      primary: '#ea580c',
      accent: '#ef4444',
      background: '#ffffff',
    },
    contact: {
      phone: '+54 11 4567-8900',
      email: `hola@${normalizedSlug || 'mi-tienda'}.com.ar`,
      whatsApp: 'https://wa.me/5491145678900',
      instagram: `https://instagram.com/${normalizedSlug || 'mi-tienda'}`,
      facebook: `https://facebook.com/${normalizedSlug || 'mi-tienda'}`,
    },
    seo: {
      metaTitle: sName,
      metaDescription: `Bienvenido a nuestra tienda online ${sName}.`,
    },
    features: {
      reviewsEnabled: false,
      wishlistEnabled: false,
      blogEnabled: false,
    },
    payments: {
      mercadoPagoPublicKey: '',
      mercadoPago: {
        publicKey: '',
        accessTokenSecret: 'mp-access-token',
        accessTokenMasked: '',
        webhookUrl: '',
        validationStatus: 'pending',
        validationMessage: 'Sin token configurado.',
      },
    },
    currency: 'ARS',
    currencySymbol: '$',
    country: 'AR',
    setupCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),

    // Legacy fields mapping for backwards compatibility
    contactPhone: '+54 11 4567-8900',
    contactEmail: `hola@${normalizedSlug || 'mi-tienda'}.com.ar`,
    socialInstagramUrl: `https://instagram.com/${normalizedSlug || 'mi-tienda'}`,
    socialFacebookUrl: `https://facebook.com/${normalizedSlug || 'mi-tienda'}`,
    socialWhatsAppUrl: 'https://wa.me/5491145678900',
    copyrightText: `© 2026 ${sName}. Todos los derechos reservados.`,
  };

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`configuracion/footer_${storeId}`)}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(footerPayload),
          quotaProject: projectId,
        },
      ),
    5,
    6000,
  );

  // Re-write configuracion/store_{storeId} with the store config data
  // (seedStoreData deletes this document earlier; the storefront reads from this path)
  const storeConfigPayload = {
    ...footerPayload,
    setupCompleted: true,
  };

  await retry(
    () =>
      apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${tp(`configuracion/store_${storeId}`)}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(storeConfigPayload),
          quotaProject: projectId,
        },
      ),
    5,
    6000,
  );

  logger.info(`[SeedEngine] Seeded configuracion/store_${storeId} successfully.`);
  logger.info(`[SeedEngine] Seeded configuracion/footer_${storeId} successfully.`);
  logger.info(`[SeedEngine] Seeding completed successfully for project "${projectId}".`);
}
