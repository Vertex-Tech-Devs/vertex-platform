import type { OAuth2Client } from 'google-auth-library';
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
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
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
export function toFirestoreFields(obj: Record<string, unknown>): { fields: Record<string, unknown> } {
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
  { fullName: 'Tomás Pérez', email: 'tomas.perez@gmail.com', phone: '+54 9 11 5512-8890' },
  { fullName: 'Sofía Sánchez', email: 'sofia.sanchez@icloud.com', phone: '+54 9 11 4401-7723' },
  { fullName: 'Nicolás Romero', email: 'nico.romero@gmail.com', phone: '+54 9 11 6623-4415' },
  { fullName: 'Isabella Torres', email: 'isabella.torres@gmail.com', phone: '+54 9 11 7745-1122' },
  { fullName: 'Facundo Flores', email: 'facu.flores@hotmail.com', phone: '+54 9 11 5500-3389' },
  { fullName: 'Agustina Díaz', email: 'agus.diaz@gmail.com', phone: '+54 9 11 4489-6634' },
  { fullName: 'Ignacio Moreno', email: 'nacho.moreno@gmail.com', phone: '+54 9 11 3367-8812' },
  { fullName: 'Martina Álvarez', email: 'marti.alvarez@outlook.com', phone: '+54 9 11 6645-2278' },
  { fullName: 'Joaquín Ruiz', email: 'joaco.ruiz@gmail.com', phone: '+54 9 11 5523-9001' },
  { fullName: 'Florencia Jiménez', email: 'flor.jimenez@yahoo.com.ar', phone: '+54 9 11 4478-5563' },
  { fullName: 'Benjamín Herrera', email: 'benja.herrera@gmail.com', phone: '+54 9 11 7712-0044' },
  { fullName: 'Milagros Castro', email: 'mili.castro@gmail.com', phone: '+54 9 11 3390-7789' },
  { fullName: 'Lautaro Vargas', email: 'lauta.vargas@hotmail.com', phone: '+54 9 11 5567-3312' },
  { fullName: 'Renata Medina', email: 'renata.medina@gmail.com', phone: '+54 9 11 4434-8856' },
  { fullName: 'Ezequiel Acosta', email: 'ezequiel.acosta@gmail.com', phone: '+54 9 11 6601-2245' },
];

const CLIENT_DAYS_LIST = [
  340, 280, 210, 180, 150, 120, 95, 70, 50, 30, 25, 20, 15, 12, 10, 8, 6, 5, 3, 1,
];

const CLIENT_ORDER_COUNTS = [
  12, 9, 7, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1,
];

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
      { prodIdx: 5, qty: 1, talle: '32', color: 'Azul' },
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
    lines: [{ prodIdx: 10, qty: 1, talle: '42', color: 'Blanco' }],
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
      { prodIdx: 15, qty: 1, color: 'Negro' },
      { prodIdx: 17, qty: 1, color: 'Marrón' },
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
      { prodIdx: 1, qty: 1, talle: 'L', color: 'Blanco' },
      { prodIdx: 12, qty: 1, talle: '41', color: 'Negro' },
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
    lines: [{ prodIdx: 7, qty: 1, talle: '34', color: 'Negro' }],
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
const VERTICAL_SEEDS: Record<string, {
  categories: Array<{ id: string; name: string; slug: string; parentId: string | null; filterableAttributes: string[] }>;
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
}> = {
  indumentaria: {
    categories: [
      { id: 'remeras', name: 'Remeras', slug: 'remeras', parentId: null, filterableAttributes: ['talle-ropa', 'color'] },
      { id: 'pantalones', name: 'Pantalones', slug: 'pantalones', parentId: null, filterableAttributes: ['talle-pantalon', 'color'] },
      { id: 'zapatillas', name: 'Zapatillas', slug: 'zapatillas', parentId: null, filterableAttributes: ['talle-calzado', 'color'] },
      { id: 'accesorios', name: 'Accesorios', slug: 'accesorios', parentId: null, filterableAttributes: ['color'] },
      { id: 'camperas', name: 'Camperas', slug: 'camperas', parentId: null, filterableAttributes: ['talle-ropa', 'color'] }
    ],
    attributes: [
      { id: 'talle-ropa', name: 'Talle (ropa)', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
      { id: 'talle-calzado', name: 'Talle (calzado)', values: ['36', '37', '38', '39', '40', '41', '42', '43', '44'] },
      { id: 'talle-pantalon', name: 'Talle (pantalón)', values: ['28', '30', '32', '34', '36', '38'] },
      { id: 'color', name: 'Color', values: ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Verde', 'Beige', 'Marrón', 'Rosa', 'Caqui'] },
      { id: 'material', name: 'Material', values: ['Algodón', 'Poliéster', 'Lino', 'Cuero', 'Denim', 'Lana'] }
    ],
    products: [
      {
        id: 'remera-pima',
        name: 'Remera Básica Pima 180g',
        description: 'Confeccionada en algodón Pima 180 g/m² con certificado GOTS. Costuras reforzadas, cuello canalé y lavados garantizados sin deformación. La base ideal para cualquier look.',
        categoryId: 'remeras',
        price: 8500,
        discount: 0,
        image: u('1521572163474-6864f9cf17ab', 600, 600),
        images: [
          u('1521572163474-6864f9cf17ab', 600, 600),
          u('1503342217505-b0a15ec3261c', 600, 600),
          u('1523381240423-59b6e0c53abe', 600, 600),
          u('1576566588028-4147f3842f27', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'remera-oversize',
        name: 'Remera Oversize Drop Shoulder',
        description: 'Corte oversize con hombro caído y largo extendido. Tela jersey 220 g/m², efecto delavado suave. Ideal para combinar con joggers o jeans baggy.',
        categoryId: 'remeras',
        price: 10900,
        discount: 15,
        image: u('1567113463300-102a7eb3cb26', 600, 600),
        images: [
          u('1567113463300-102a7eb3cb26', 600, 600),
          u('1503342217505-b0a15ec3261c', 600, 600),
          u('1571945153237-4929e783af4a', 600, 600),
          u('1523381240423-59b6e0c53abe', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'remera-polo',
        name: 'Remera Polo Piqué Premium',
        description: 'Polo de tela piqué doble torsión 240 g/m². Cuello y puños acanalados, botones de nácar en frente. Corte slim fit que moldea sin apretar. Disponible en cinco colores clásicos.',
        categoryId: 'remeras',
        price: 15200,
        discount: 10,
        image: u('1576566588028-4147f3842f27', 600, 600),
        images: [
          u('1576566588028-4147f3842f27', 600, 600),
          u('1521572163474-6864f9cf17ab', 600, 600),
          u('1503342217505-b0a15ec3261c', 600, 600),
          u('1571945153237-4929e783af4a', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'remera-termica',
        name: 'Remera Manga Larga Térmica',
        description: 'Tejido térmico de doble cara (algodón exterior, poliéster termoaislante interior). Puños ajustados antipilling. La capa base perfecta para días fríos o actividades outdoor.',
        categoryId: 'remeras',
        price: 13800,
        discount: 0,
        image: u('1571945153237-4929e783af4a', 600, 600),
        images: [
          u('1571945153237-4929e783af4a', 600, 600),
          u('1567113463300-102a7eb3cb26', 600, 600),
          u('1521572163474-6864f9cf17ab', 600, 600),
          u('1576566588028-4147f3842f27', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'remera-estampada',
        name: 'Remera Estampada Artesanal',
        description: 'Serigrafía artesanal de cuatro colores sobre tela 100% algodón ring spun. Cada estampado es numerado. Diseños exclusivos de artistas locales en colaboración con nuestra tienda.',
        categoryId: 'remeras',
        price: 12400,
        discount: 0,
        image: u('1523381240423-59b6e0c53abe', 600, 600),
        images: [
          u('1523381240423-59b6e0c53abe', 600, 600),
          u('1521572163474-6864f9cf17ab', 600, 600),
          u('1567113463300-102a7eb3cb26', 600, 600),
          u('1503342217505-b0a15ec3261c', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'jean-indigo',
        name: 'Jean Slim Fit Índigo 12oz',
        description: 'Denim selvático 100% algodón 12 oz con lavado índigo profundo. Corte slim que abraza la silueta sin limitar el movimiento. Cinco bolsillos clásicos, costura naranja característica.',
        categoryId: 'pantalones',
        price: 22500,
        discount: 0,
        image: u('1542272604-787c3835535d', 600, 600),
        images: [
          u('1542272604-787c3835535d', 600, 600),
          u('1541099649105-f69ad21f3246', 600, 600),
          u('1604176354204-9268737828e4', 600, 600),
          u('1624378439575-d8705ad7ae80', 600, 600)
        ],
        variantAttributes: ['talle-pantalon', 'color']
      },
      {
        id: 'jean-recto',
        name: 'Jean Recto Wide Leg',
        description: 'Corte recto amplio desde la cadera hasta el tobillo. Tela denim 380 g/m² de alta estabilidad. Versátil: queda bien con zapatillas, botas o mocasines.',
        categoryId: 'pantalones',
        price: 24800,
        discount: 0,
        image: u('1604176354204-9268737828e4', 600, 600),
        images: [
          u('1604176354204-9268737828e4', 600, 600),
          u('1542272604-787c3835535d', 600, 600),
          u('1624378439575-d8705ad7ae80', 600, 600),
          u('1541099649105-f69ad21f3246', 600, 600)
        ],
        variantAttributes: ['talle-pantalon', 'color']
      },
      {
        id: 'jogger-premium',
        name: 'Jogger Premium Fleece 320g',
        description: 'Interior de felpa de algodón 320 g/m², exterior liso antipilling. Pretina ancha con cordón plano, puños con elástico doble. Dos bolsillos laterales profundos y bolsillo trasero con cierre.',
        categoryId: 'pantalones',
        price: 18900,
        discount: 20,
        image: u('1624378439575-d8705ad7ae80', 600, 600),
        images: [
          u('1624378439575-d8705ad7ae80', 600, 600),
          u('1541099649105-f69ad21f3246', 600, 600),
          u('1604176354204-9268737828e4', 600, 600),
          u('1542272604-787c3835535d', 600, 600)
        ],
        variantAttributes: ['talle-pantalon', 'color']
      },
      {
        id: 'chino-gabardina',
        name: 'Pantalón Chino Gabardina Slim',
        description: 'Gabardina de algodón-elastano 260 g/m² con 4% stretch para mayor comodidad. Corte slim levemente cónico. Ideal para looks business casual o smart-casual. Cinco bolsillos.',
        categoryId: 'pantalones',
        price: 19500,
        discount: 0,
        image: u('1541099649105-f69ad21f3246', 600, 600),
        images: [
          u('1541099649105-f69ad21f3246', 600, 600),
          u('1604176354204-9268737828e4', 600, 600),
          u('1542272604-787c3835535d', 600, 600),
          u('1624378439575-d8705ad7ae80', 600, 600)
        ],
        variantAttributes: ['talle-pantalon', 'color']
      },
      {
        id: 'pantalón-cargo',
        name: 'Pantalón Cargo Ripstop',
        description: 'Tela ripstop 65/35 poliéster-algodón, resistente al desgarro y a la humedad. Seis bolsillos funcionales con cierre YKK. Pretina elástica trasera. El utilitario que no sacrifica el estilo.',
        categoryId: 'pantalones',
        price: 26500,
        discount: 10,
        image: u('1624378439575-d8705ad7ae80', 600, 600),
        images: [
          u('1624378439575-d8705ad7ae80', 600, 600),
          u('1604176354204-9268737828e4', 600, 600),
          u('1541099649105-f69ad21f3246', 600, 600),
          u('1542272604-787c3835535d', 600, 600)
        ],
        variantAttributes: ['talle-pantalon', 'color']
      },
      {
        id: 'running-air-zoom',
        name: 'Zapatilla Running Air Zoom V3',
        description: 'Mediasuela de espuma EVA + cámara de aire en talón y antepié. Upper de malla 3D ultraliviana con refuerzos de TPU. Suela de goma con canales multidireccionales. Peso: 285 g (talle 42).',
        categoryId: 'zapatillas',
        price: 52000,
        discount: 0,
        image: u('1542291026-7eec264c27ff', 600, 600),
        images: [
          u('1542291026-7eec264c27ff', 600, 600),
          u('1491553895911-0055eca6402d', 600, 600),
          u('1539185441755-769473a23570', 600, 600),
          u('1525966222134-fcfa99b8ae77', 600, 600)
        ],
        variantAttributes: ['talle-calzado', 'color']
      },
      {
        id: 'urbana-canvas',
        name: 'Zapatilla Urbana Canvas Vulc',
        description: 'Upper de lona canvas 100% algodón con refuerzo en puntera. Suela vulcanizada clásica con textura cuadriculada. La base del armario urbano desde 1960. Disponible en 5 colores.',
        categoryId: 'zapatillas',
        price: 32000,
        discount: 15,
        image: u('1525966222134-fcfa99b8ae77', 600, 600),
        images: [
          u('1525966222134-fcfa99b8ae77', 600, 600),
          u('1542291026-7eec264c27ff', 600, 600),
          u('1491553895911-0055eca6402d', 600, 600),
          u('1539185441755-769473a23570', 600, 600)
        ],
        variantAttributes: ['talle-calzado', 'color']
      },
      {
        id: 'retro-94-leather',
        name: 'Zapatilla Retro 94 Leather',
        description: 'Reedición limitada inspirada en clásicos de los 90. Upper de cuero full grain + panel de nylon. Amortiguación con tecnología vintage foam. Logo bordado lateral. Caja de edición coleccionable.',
        categoryId: 'zapatillas',
        price: 58000,
        discount: 0,
        image: u('1491553895911-0055eca6402d', 600, 600),
        images: [
          u('1491553895911-0055eca6402d', 600, 600),
          u('1539185441755-769473a23570', 600, 600),
          u('1525966222134-fcfa99b8ae77', 600, 600),
          u('1542291026-7eec264c27ff', 600, 600)
        ],
        variantAttributes: ['talle-calzado', 'color']
      },
      {
        id: 'training-functional',
        name: 'Zapatilla Training Functional',
        description: 'Construida para HIIT, functional training y crossfit. Suela plana de 4 mm para máxima estabilidad en sentadillas. Upper de malla de ventilación zonal. Cordones planos preatados.',
        categoryId: 'zapatillas',
        price: 46000,
        discount: 0,
        image: u('1539185441755-769473a23570', 600, 600),
        images: [
          u('1539185441755-769473a23570', 600, 600),
          u('1491553895911-0055eca6402d', 600, 600),
          u('1542291026-7eec264c27ff', 600, 600),
          u('1525966222134-fcfa99b8ae77', 600, 600)
        ],
        variantAttributes: ['talle-calzado', 'color']
      },
      {
        id: 'chunky-platform',
        name: 'Zapatilla Chunky Platform 4cm',
        description: 'Plataforma de 4 cm en suela de goma inyectada. Upper de cuero sintético premium con costuras decorativas. El modelo favorito del streetwear contemporáneo. Sin cordones, cierre velcro oculto.',
        categoryId: 'zapatillas',
        price: 44000,
        discount: 25,
        image: u('1525966222134-fcfa99b8ae77', 600, 600),
        images: [
          u('1525966222134-fcfa99b8ae77', 600, 600),
          u('1542291026-7eec264c27ff', 600, 600),
          u('1539185441755-769473a23570', 600, 600),
          u('1491553895911-0055eca6402d', 600, 600)
        ],
        variantAttributes: ['talle-calzado', 'color']
      },
      {
        id: 'snapback-6-paneles',
        name: 'Gorra Snapback 6 Paneles',
        description: 'Six-panel en twill de algodón 100%. Visera plana pre-curvada. Panel frontal con bordado 3D. Cierre snapback metálico ajustable talla única. Transpirabilidad garantizada por malla lateral.',
        categoryId: 'accesorios',
        price: 7500,
        discount: 0,
        image: u('1534307671554-9a6d81f4d629', 600, 600),
        images: [
          u('1534307671554-9a6d81f4d629', 600, 600),
          u('1511499767150-a48a237f0083', 600, 600),
          u('1548036328-c9fa89d128fa', 600, 600),
          u('1553062407-98eeb64c6a62', 600, 600)
        ],
        variantAttributes: ['color']
      },
      {
        id: 'rinonera-crossbody',
        name: 'Riñonera Crossbody 2L',
        description: 'Cuerpo principal + bolsillo frontal con cierre YKK y organizador interior. Correa ajustable doble uso: cintura o bandolera. Tela ripstop resistente al agua con cremalleras plastificadas.',
        categoryId: 'accesorios',
        price: 9800,
        discount: 10,
        image: u('1548036328-c9fa89d128fa', 600, 600),
        images: [
          u('1548036328-c9fa89d128fa', 600, 600),
          u('1553062407-98eeb64c6a62', 600, 600),
          u('1534307671554-9a6d81f4d629', 600, 600),
          u('1511499767150-a48a237f0083', 600, 600)
        ],
        variantAttributes: ['color']
      },
      {
        id: 'cinturon-cuero',
        name: 'Cinturón Cuero Full Grain 35mm',
        description: 'Cuero full grain primera selección curtido al vegetal. Hebilla de zamak con acabado matte. Ancho 35 mm, largo ajustable hasta 120 cm. Incluye pasacinturón extra. Garantía de 3 años.',
        categoryId: 'accesorios',
        price: 14500,
        discount: 0,
        image: u('1553062407-98eeb64c6a62', 600, 600),
        images: [
          u('1553062407-98eeb64c6a62', 600, 600),
          u('1534307671554-9a6d81f4d629', 600, 600),
          u('1548036328-c9fa89d128fa', 600, 600),
          u('1511499767150-a48a237f0083', 600, 600)
        ],
        variantAttributes: ['color']
      },
      {
        id: 'mochila-urban-tech',
        name: 'Mochila Urban Tech 25L',
        description: 'Compartimento laptop hasta 16" con espuma protectora. Bolsa delantera organizada con 8 divisiones. Puerto USB integrado. Espalda ergonómica con malla 3D transpirable. Peso: 820 g.',
        categoryId: 'accesorios',
        price: 38000,
        discount: 0,
        image: u('1553062407-98eeb64c6a62', 600, 600),
        images: [
          u('1553062407-98eeb64c6a62', 600, 600),
          u('1548036328-c9fa89d128fa', 600, 600),
          u('1511499767150-a48a237f0083', 600, 600),
          u('1534307671554-9a6d81f4d629', 600, 600)
        ],
        variantAttributes: ['color']
      },
      {
        id: 'gafas-polarizadas',
        name: 'Gafas de Sol Polarizadas Wayfarer',
        description: 'Lentes polarizados CAT 3 con filtro UV400. Montura wayfarer de acetato italiano inyectado. Bisagras de primavera reforzadas. Incluye estuche rígido, paño microfibra y certificado de autenticidad.',
        categoryId: 'accesorios',
        price: 19500,
        discount: 20,
        image: u('1511499767150-a48a237f0083', 600, 600),
        images: [
          u('1511499767150-a48a237f0083', 600, 600),
          u('1534307671554-9a6d81f4d629', 600, 600),
          u('1553062407-98eeb64c6a62', 600, 600),
          u('1548036328-c9fa89d128fa', 600, 600)
        ],
        variantAttributes: ['color']
      },
      {
        id: 'campera-rompevientos',
        name: 'Campera Rompevientos Packable',
        description: 'Membrana impermeabilizante 3.000 mm de presión hídrica. Costuras termoselladas. Empacable en su propio bolsillo trasero formando una pochette de 20×15 cm. Peso total: 340 g.',
        categoryId: 'camperas',
        price: 38000,
        discount: 0,
        image: u('1551028719-00167b16eac5', 600, 600),
        images: [
          u('1551028719-00167b16eac5', 600, 600),
          u('1551537482-f2075a1d41f2', 600, 600),
          u('1495105787522-5334e3ffa0ef', 600, 600),
          u('1520975661595-6453be3f7070', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'campera-cuero',
        name: 'Campera Cuero Biker Matte',
        description: 'Cuero sintético PU de alta densidad con acabado matte. Forro de satín con bolsillos internos. Cierres metálicos YKK en diagonal, mangas y cuello. Hombros estructurados con padding.',
        categoryId: 'camperas',
        price: 72000,
        discount: 10,
        image: u('1520975661595-6453be3f7070', 600, 600),
        images: [
          u('1520975661595-6453be3f7070', 600, 600),
          u('1551028719-00167b16eac5', 600, 600),
          u('1551537482-f2075a1d41f2', 600, 600),
          u('1495105787522-5334e3ffa0ef', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'bomber-classic',
        name: 'Bomber Classic MA-1 Reversible',
        description: 'Reversible: cara exterior en nylon ripstop, cara interior en satín naranja. Inspirada en el MA-1 original. Puños, cuello y dobladillo trenzados. Logo bordado en pecho. Icónica y atemporal.',
        categoryId: 'camperas',
        price: 45000,
        discount: 0,
        image: u('1551537482-f2075a1d41f2', 600, 600),
        images: [
          u('1551537482-f2075a1d41f2', 600, 600),
          u('1495105787522-5334e3ffa0ef', 600, 600),
          u('1520975661595-6453be3f7070', 600, 600),
          u('1551028719-00167b16eac5', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'campera-puffer',
        name: 'Campera Puffer 600 Fill DWR',
        description: 'Relleno de pluma sintética 600 fill power con tratamiento DWR (repelente al agua). Costuras de canalón para distribución uniforme del calor. Cremallera YKK doble tirador. Peso: 520 g.',
        categoryId: 'camperas',
        price: 62000,
        discount: 15,
        image: u('1547949003-9792a18a2601', 600, 600),
        images: [
          u('1547949003-9792a18a2601', 600, 600),
          u('1551028719-00167b16eac5', 600, 600),
          u('1551537482-f2075a1d41f2', 600, 600),
          u('1495105787522-5334e3ffa0ef', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      },
      {
        id: 'campera-denim',
        name: 'Campera Denim Sherpa Contrast',
        description: 'Denim 14 oz lavado a la piedra con cuello, solapa y forro de sherpa de 300 g/m². Botones metálicos envejecidos. Bolsillos pecho y laterales funcionales. El clásico que nunca se va.',
        categoryId: 'camperas',
        price: 52000,
        discount: 0,
        image: u('1495105787522-5334e3ffa0ef', 600, 600),
        images: [
          u('1495105787522-5334e3ffa0ef', 600, 600),
          u('1520975661595-6453be3f7070', 600, 600),
          u('1547949003-9792a18a2601', 600, 600),
          u('1551028719-00167b16eac5', 600, 600)
        ],
        variantAttributes: ['talle-ropa', 'color']
      }
    ]
  },
  gastronomia: {
    categories: [
      { id: 'hamburguesas', name: 'Hamburguesas', slug: 'hamburguesas', parentId: null, filterableAttributes: ['coccion'] },
      { id: 'acompanamientos', name: 'Acompañamientos', slug: 'acompanamientos', parentId: null, filterableAttributes: [] },
      { id: 'bebidas', name: 'Bebidas', slug: 'bebidas', parentId: null, filterableAttributes: [] }
    ],
    attributes: [
      { id: 'coccion', name: 'Cocción', values: ['Jugosa', 'A punto', 'Cocida'] }
    ],
    products: [
      {
        id: 'burger-deluxe',
        name: 'Burger Deluxe Vertex',
        description: 'Medallón de carne 100% de novillo seleccionado (180g), cheddar fundido, lechuga, tomate y salsa ahumada Vertex en pan de papa.',
        categoryId: 'hamburguesas',
        price: 8900,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
        variantAttributes: ['coccion']
      },
      {
        id: 'papas-rusticas',
        name: 'Papas Rústicas de la Casa',
        description: 'Bastones de papa rústica fritos en doble cocción para mayor crocancia por fuera y suavidad por dentro. Acompañados de alioli casero.',
        categoryId: 'acompanamientos',
        price: 3500,
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800',
        variantAttributes: []
      },
      {
        id: 'limonada-casa',
        name: 'Limonada de la Casa',
        description: 'Limonada fresca con menta fresca, jengibre y almíbar de limón casero. Servida con hielo.',
        categoryId: 'bebidas',
        price: 2200,
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800',
        variantAttributes: []
      }
    ]
  },
  retail: {
    categories: [
      { id: 'hogar', name: 'Hogar & Decoración', slug: 'hogar-y-decoracion', parentId: null, filterableAttributes: ['color'] },
      { id: 'tecnologia', name: 'Tecnología', slug: 'tecnologia', parentId: null, filterableAttributes: [] },
      { id: 'papeleria', name: 'Oficina & Papelería', slug: 'oficina-y-papeleria', parentId: null, filterableAttributes: [] }
    ],
    attributes: [
      { id: 'color', name: 'Color', values: ['Madera', 'Negro', 'Blanco'] }
    ],
    products: [
      {
        id: 'lampara-minimalista',
        name: 'Lámpara Minimalista Vertex',
        description: 'Lámpara de mesa moderna con base de madera natural, pantalla cilíndrica y luz cálida regulable. Ideal para escritorios o mesas de luz.',
        categoryId: 'hogar',
        price: 19500,
        image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
        variantAttributes: ['color']
      },
      {
        id: 'teclado-mecanico-rgb',
        name: 'Teclado Mecánico 60% RGB',
        description: 'Teclado mecánico ultra-compacto con switches táctiles, retroiluminación RGB configurable y cable USB-C desmontable.',
        categoryId: 'tecnologia',
        price: 45000,
        image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800',
        variantAttributes: []
      },
      {
        id: 'cuaderno-de-cuero',
        name: 'Cuaderno Cuero Ecológico A5',
        description: 'Cuaderno con tapa de cuero ecológico, hojas rayadas de papel ahuesado de 90g y cierre con banda elástica premium.',
        categoryId: 'papeleria',
        price: 7800,
        image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800',
        variantAttributes: []
      }
    ]
  }
};

// Deletion helper for clear-all operations
async function clearCollection(auth: OAuth2Client, projectId: string, collectionName: string): Promise<void> {
  try {
    const res = (await apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`,
      { method: 'GET', quotaProject: projectId }
    )) as { documents?: Array<{ name: string }> };

    if (res && res.documents && res.documents.length > 0) {
      for (const doc of res.documents) {
        // doc.name is projects/{projectId}/databases/(default)/documents/{collectionName}/{docId}
        const docPath = doc.name.split('/documents/')[1];
        
        // If it's a product, we should also clean its subcollection 'variants' first
        if (collectionName === 'products') {
          await clearCollection(auth, projectId, `${docPath}/variants`);
        }

        await apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`,
          { method: 'DELETE', quotaProject: projectId }
        );
      }
    }
  } catch (err: any) {
    const isNotFound = err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
    if (!isNotFound) {
      console.warn(`[SeedEngine] Error clearing collection ${collectionName}:`, err);
    }
  }
}

async function deleteDocumentPath(auth: OAuth2Client, projectId: string, docPath: string): Promise<void> {
  try {
    await apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`,
      { method: 'DELETE', quotaProject: projectId }
    );
  } catch (err: any) {
    const isNotFound = err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
    if (!isNotFound) {
      console.warn(`[SeedEngine] Error deleting document ${docPath}:`, err);
    }
  }
}

// Check if store has existing products or orders to prevent overwriting production stores
async function checkStoreSafety(auth: OAuth2Client, projectId: string): Promise<void> {
  console.log(`[SeedEngine] Safety validation: Checking products and orders in project "${projectId}"...`);
  try {
    const productsRes = (await apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?pageSize=1`,
      { method: 'GET', quotaProject: projectId }
    )) as { documents?: Array<unknown> };

    const ordersRes = (await apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders?pageSize=1`,
      { method: 'GET', quotaProject: projectId }
    )) as { documents?: Array<unknown> };

    const hasProducts = productsRes && productsRes.documents && productsRes.documents.length > 0;
    const hasOrders = ordersRes && ordersRes.documents && ordersRes.documents.length > 0;

    if (hasProducts || hasOrders) {
      throw new Error('La tienda ya contiene productos o pedidos activos. Se canceló la regeneración para proteger la base de datos de producción.');
    }
  } catch (err: any) {
    const isNotFound = err.message && (err.message.includes('NOT_FOUND') || err.message.includes('404'));
    if (!isNotFound) {
      throw err;
    }
  }
}


// Multi-dimension variant combinations generator
function generateVariantCombinations(
  attributesList: Array<{ id: string; name: string; values: string[] }>,
  variantAttrIds: string[]
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

/**
 * Seeds isolated child project database with category trees, attributes, and products with variants.
 */
export async function seedStoreData(
  auth: OAuth2Client,
  projectId: string,
  verticalId: string,
  storeName?: string,
  includeMockData = true,
  bypassSafety = false
): Promise<void> {
  const sName = storeName ? storeName.trim() : 'Vertex';
  let rawSeed = VERTICAL_SEEDS[verticalId];
  let targetVertical = verticalId;
  if (!rawSeed) {
    console.log(`[SeedEngine] No seeds defined for vertical: ${verticalId}. Falling back gracefully to "retail" seed.`);
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

  const seed = customizeSeed(rawSeed, sName);

  // 1. Run Safety Check
  if (!bypassSafety) {
    await checkStoreSafety(auth, projectId);
  }

  console.log(`[SeedEngine] Safety check passed. Cleaning up database to begin a pristine seed on project "${projectId}"...`);

  // 2. Clear Database Collections
  const collectionsToClear = ['products', 'categories', 'clients', 'orders', 'attributes'];
  for (const col of collectionsToClear) {
    await clearCollection(auth, projectId, col);
  }
  await deleteDocumentPath(auth, projectId, 'siteContent/homePage');
  await deleteDocumentPath(auth, projectId, 'pages/aboutUs');
  await deleteDocumentPath(auth, projectId, 'configuracion/footer');

  console.log(`[SeedEngine] Clean-up complete. Starting database seeding for vertical: "${targetVertical}"`);

  // 3. Seed Attributes
  for (const attr of seed.attributes) {
    const docData = {
      name: attr.name,
      values: attr.values
    };
    await retry(
      () => apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/attributes/${attr.id}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(docData),
          quotaProject: projectId
        }
      ),
      5,
      6000
    );
  }
  console.log(`[SeedEngine] Seeded ${seed.attributes.length} attributes.`);

  // 4. Seed Categories
  for (const cat of seed.categories) {
    const docData = {
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      filterableAttributes: cat.filterableAttributes,
      imageUrl: cat.slug ? u(cat.slug, 400, 400) : null,
      createdAt: new Date()
    };
    await retry(
      () => apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/categories/${cat.id}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(docData),
          quotaProject: projectId
        }
      ),
      5,
      6000
    );
  }
  console.log(`[SeedEngine] Seeded ${seed.categories.length} categories.`);

  // 5. Seed Products and their Variants
  const seededProducts: Array<{
    id: string;
    name: string;
    finalPrice: number;
    image: string;
    variantAttributes: string[];
  }> = [];

  for (const prod of seed.products) {
    const discount = prod.discount ?? 0;
    const finalPrice = discount > 0 ? Math.round(prod.price * (1 - discount / 100)) : prod.price;

    let totalStock = 0;
    const inStockAttributes: Record<string, string[]> = {};

    // Initial write of the product
    const initialProdData = {
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
      createdAt: new Date()
    };

    await retry(
      () => apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prod.id}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(initialProdData),
          quotaProject: projectId
        }
      ),
      5,
      6000
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

        const variantData = {
          productId: prod.id,
          sku: `${prod.id.toUpperCase()}-${varIdx++}`,
          attributes: combo,
          stock
        };

        await retry(
          () => apiFetch(
            auth,
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prod.id}/variants/v${varIdx}`,
            {
              method: 'PATCH',
              body: toFirestoreFields(variantData),
              quotaProject: projectId
            }
          ),
          5,
          6000
        );
      }

      // Update the main product with variant aggregation (total stock, in-stock sizes/colors)
      const updatedProdData = {
        totalStock,
        inStockAttributes
      };

      await retry(
        () => apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prod.id}`,
          {
            method: 'PATCH',
            body: toFirestoreFields({
              ...initialProdData,
              ...updatedProdData
            }),
            quotaProject: projectId
          }
        ),
        5,
        6000
      );
    } else {
      // Products without variants get a standard stock
      totalStock = 50;
      await retry(
        () => apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prod.id}`,
          {
            method: 'PATCH',
            body: toFirestoreFields({
              ...initialProdData,
              totalStock
            }),
            quotaProject: projectId
          }
        ),
        5,
        6000
      );
    }

    seededProducts.push({
      id: prod.id,
      name: prod.name,
      finalPrice,
      image: prod.image,
      variantAttributes: prod.variantAttributes
    });
  }
  console.log(`[SeedEngine] Seeded ${seededProducts.length} products and their variants.`);

  if (includeMockData) {
    // 6. Seed Clients (from CLIENT_DATA)
    const seededClients: Array<{ id: string; fullName: string; email: string; phone: string }> = [];
    let clientIdx = 0;
    for (const client of CLIENT_DATA) {
      const days = CLIENT_DAYS_LIST[clientIdx] ?? 30;
      const clientDocId = `cli-${clientIdx}`;
      const clientPayload = {
        fullName: client.fullName,
        email: client.email,
        phone: client.phone,
        firstOrderDate: new Date(Date.now() - days * 86_400_000),
        lastOrderDate: new Date(Date.now() - Math.max(1, Math.floor(days / 4)) * 86_400_000),
        numberOfOrders: CLIENT_ORDER_COUNTS[clientIdx] ?? 1,
        createdAt: new Date()
      };

      await retry(
        () => apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/clients/${clientDocId}`,
          {
            method: 'PATCH',
            body: toFirestoreFields(clientPayload),
            quotaProject: projectId
          }
        ),
        5,
        6000
      );

      seededClients.push({
        id: clientDocId,
        fullName: client.fullName,
        email: client.email,
        phone: client.phone
      });
      clientIdx++;
    }
    console.log(`[SeedEngine] Seeded ${seededClients.length} clients.`);

    // 7. Seed Orders (Dynamic mapping using catalog lines & modulo for products)
    let orderIdx = 0;
    for (const order of ORDER_DATA) {
      const cl = seededClients[order.clientIdx % seededClients.length];
      const orderDate = new Date(Date.now() - order.daysAgo * 86_400_000);
      const orderDocId = `ord-${orderIdx++}`;

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
          attributes: attrs
        };
      });

      const orderPayload = {
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
          country: 'Argentina'
        },
        paymentDetails: {
          paymentMethod: order.paymentMethod,
          shippingCost: order.shippingCost,
          taxAmount: Math.round(subtotal * 0.21),
          subtotal
        },
        stockDecremented: order.status !== 'cancelled',
        notes: orderIdx % 5 === 0 ? 'Cliente solicitó embalaje de regalo.' : null
      };

      await retry(
        () => apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${orderDocId}`,
          {
            method: 'PATCH',
            body: toFirestoreFields(orderPayload),
            quotaProject: projectId
          }
        ),
        5,
        6000
      );
    }
    console.log(`[SeedEngine] Seeded ${ORDER_DATA.length} orders.`);
  } else {
    console.log('[SeedEngine] includeMockData is false. Skipping clients and orders seeding.');
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
        { categoryId: 'remeras', name: 'Remeras', slug: 'remeras', imageUrl: u('1523381240423-59b6e0c53abe', 600, 400) },
        { categoryId: 'camperas', name: 'Camperas', slug: 'camperas', imageUrl: u('1551537482-f2075a1d41f2', 600, 400) },
        { categoryId: 'zapatillas', name: 'Zapatillas', slug: 'zapatillas', imageUrl: u('1491553895911-0055eca6402d', 600, 400) },
      ]
    : isGastronomia
    ? [
        { categoryId: 'hamburguesas', name: 'Hamburguesas', slug: 'hamburguesas', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop&q=80' },
        { categoryId: 'acompanamientos', name: 'Acompañamientos', slug: 'acompanamientos', imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop&q=80' },
        { categoryId: 'bebidas', name: 'Bebidas', slug: 'bebidas', imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&h=400&fit=crop&q=80' },
      ]
    : [
        { categoryId: 'hogar', name: 'Hogar & Decoración', slug: 'hogar-y-decoracion', imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=400&fit=crop&q=80' },
        { categoryId: 'tecnologia', name: 'Tecnología', slug: 'tecnologia', imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=600&h=400&fit=crop&q=80' },
        { categoryId: 'papeleria', name: 'Oficina & Papelería', slug: 'oficina-y-papeleria', imageUrl: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=400&fit=crop&q=80' },
      ];

  const homePagePayload = {
    heroImages,
    carouselSettings: { interval: 4500, showIndicators: true },
    title: bannerTitle,
    buttonText: 'Explorar todo',
    buttonLink: '/shop/catalog',
    featuredCategories,
    lastUpdated: new Date()
  };

  await retry(
    () => apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/siteContent/homePage`,
      {
        method: 'PATCH',
        body: toFirestoreFields(homePagePayload),
        quotaProject: projectId
      }
    ),
    5,
    6000
  );
  console.log(`[SeedEngine] Seeded siteContent/homePage successfully.`);

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
        content: 'Cada producto pasa por tres etapas de control de calidad antes de llegar a tus manos. Solo trabajamos con materiales de primera línea y proveedores certificados.'
      },
      {
        title: 'Envíos en 24-72 hs',
        content: 'Despachamos a cualquier punto de Argentina en 24 a 72 horas hábiles con seguimiento en tiempo real. Envío express sin demoras.'
      },
      {
        title: 'Cambios sin burocracia',
        content: 'Si la selección no fue la correcta o algo no te convenció, gestionamos el cambio o devolución en menos de 48 horas sin preguntas ni costos adicionales.'
      },
      {
        title: 'Producción responsable',
        content: 'Embalajes 100% reciclables, tintas ecológicas y apoyo activo a marcas locales y talleres de producción justa.'
      }
    ]
  };

  await retry(
    () => apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pages/aboutUs`,
      {
        method: 'PATCH',
        body: toFirestoreFields(aboutUsPayload),
        quotaProject: projectId
      }
    ),
    5,
    6000
  );
  console.log(`[SeedEngine] Seeded pages/aboutUs successfully.`);

  // 10. Seed Footer (configuracion/footer)
  const normalizedSlug = sName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const footerPayload = {
    contactPhone: '+54 11 4567-8900',
    contactEmail: `hola@${normalizedSlug || 'mi-tienda'}.com.ar`,
    socialInstagramUrl: `https://instagram.com/${normalizedSlug || 'mi-tienda'}`,
    socialFacebookUrl: `https://facebook.com/${normalizedSlug || 'mi-tienda'}`,
    socialWhatsAppUrl: 'https://wa.me/5491145678900',
    copyrightText: `© 2026 ${sName}. Todos los derechos reservados.`
  };

  await retry(
    () => apiFetch(
      auth,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/configuracion/footer`,
      {
        method: 'PATCH',
        body: toFirestoreFields(footerPayload),
        quotaProject: projectId
      }
    ),
    5,
    6000
  );
  console.log(`[SeedEngine] Seeded configuracion/footer successfully.`);
  console.log(`[SeedEngine] Seeding completed successfully for project "${projectId}".`);
}
