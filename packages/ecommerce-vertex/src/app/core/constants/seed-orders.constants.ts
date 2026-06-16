export interface ClientData {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderLine {
  readonly prodIdx: number;
  readonly qty: number;
  readonly talle?: string;
  readonly color: string;
}

export interface SeedOrderData {
  readonly clientIdx: number;
  readonly daysAgo: number;
  readonly status: OrderStatus;
  readonly lines: readonly OrderLine[];
  readonly paymentMethod: string;
  readonly shippingCost: number;
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
}

export const CLIENT_DATA: readonly ClientData[] = [
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
  {
    fullName: 'Florencia Jiménez',
    email: 'flor.jimenez@yahoo.com.ar',
    phone: '+54 9 11 4478-5563',
  },
  { fullName: 'Benjamín Herrera', email: 'benja.herrera@gmail.com', phone: '+54 9 11 7712-0044' },
  { fullName: 'Milagros Castro', email: 'mili.castro@gmail.com', phone: '+54 9 11 3390-7789' },
  { fullName: 'Lautaro Vargas', email: 'lauta.vargas@hotmail.com', phone: '+54 9 11 5567-3312' },
  { fullName: 'Renata Medina', email: 'renata.medina@gmail.com', phone: '+54 9 11 4434-8856' },
  { fullName: 'Ezequiel Acosta', email: 'ezequiel.acosta@gmail.com', phone: '+54 9 11 6601-2245' },
];

export const CLIENT_DAYS_LIST: readonly number[] = [
  340, 280, 210, 180, 150, 120, 95, 70, 50, 30, 25, 20, 15, 12, 10, 8, 6, 5, 3, 1,
];

export const CLIENT_ORDER_COUNTS: readonly number[] = [
  12, 9, 7, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1,
];

export const ORDER_DATA: readonly SeedOrderData[] = [
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
      { prodIdx: 5, qty: 1, talle: '32', color: 'Azul índigo' },
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
    lines: [{ prodIdx: 10, qty: 1, talle: '42', color: 'Blanco/Negro' }],
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
      { prodIdx: 20, qty: 1, color: 'Negro' },
      { prodIdx: 23, qty: 1, color: 'Marrón' },
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
      { prodIdx: 15, qty: 1, talle: '41', color: 'Negro total' },
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
      { prodIdx: 22, qty: 1, color: 'Azul navy' },
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
      { prodIdx: 12, qty: 1, talle: '40', color: 'Gris/Azul' },
      { prodIdx: 21, qty: 1, color: 'Negro' },
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
    lines: [{ prodIdx: 24, qty: 1, talle: 'M', color: 'Caqui' }],
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
      { prodIdx: 19, qty: 1, color: 'Oliva' },
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
      { prodIdx: 16, qty: 1, talle: '43', color: 'Rojo/Blanco' },
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
      { prodIdx: 9, qty: 1, talle: '32', color: 'Verde militar' },
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
    lines: [{ prodIdx: 11, qty: 2, talle: '39', color: 'Blanco/Negro' }],
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
      { prodIdx: 20, qty: 1, color: 'Negro' },
      { prodIdx: 23, qty: 1, color: 'Beige' },
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
    lines: [{ prodIdx: 14, qty: 1, talle: 'XXL', color: 'Negro' }],
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
      { prodIdx: 17, qty: 1, talle: '44', color: 'Negro total' },
      { prodIdx: 21, qty: 2, color: 'Marrón' },
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
    lines: [{ prodIdx: 24, qty: 1, talle: 'S', color: 'Navy' }],
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
      { prodIdx: 22, qty: 1, color: 'Azul navy' },
      { prodIdx: 10, qty: 1, talle: '38', color: 'Gris/Azul' },
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
      { prodIdx: 18, qty: 1, talle: '38', color: 'Beige/Crema' },
      { prodIdx: 3, qty: 2, talle: 'M', color: 'Blanco' },
    ],
  },
];
