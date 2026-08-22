export interface DemoClient {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  storeId: string;
  city?: string;
  address?: string;
  firstOrderDate: Date;
  lastOrderDate: Date;
  numberOfOrders: number;
  totalSpent?: number;
}

export interface DemoOrder {
  id: string;
  storeId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  orderDate: Date;
  status: 'pending' | 'processing' | 'ready_for_pickup' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  subtotal?: number;
  shippingCost?: number;
  paymentMethod: string;
  paymentStatus?: 'approved' | 'in_process' | 'pending';
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  deliverySelection?: {
    type: 'store_pickup' | 'home_delivery';
    pickupAddressFormatted?: string;
  };
}

const RAW_CLIENTS = [
  { fullName: 'Valentina García', email: 'valenti.garcia@gmail.com', phone: '+54 9 11 4523-8801', city: 'CABA', address: 'Av. Santa Fe 3421, Palermo', daysAgoFirst: 90, daysAgoLast: 2, orders: 4, spent: 245000 },
  { fullName: 'Mateo Rodríguez', email: 'mateo.rodriguez@gmail.com', phone: '+54 9 11 5634-9912', city: 'CABA', address: 'Av. Corrientes 4531, Almagro', daysAgoFirst: 60, daysAgoLast: 5, orders: 3, spent: 189000 },
  { fullName: 'Camila López', email: 'camila.lopez@outlook.com', phone: '+54 9 351 471-2334', city: 'Córdoba Capital', address: 'Bv. San Juan 840, Nueva Córdoba', daysAgoFirst: 45, daysAgoLast: 8, orders: 2, spent: 120000 },
  { fullName: 'Santiago Martínez', email: 'santi.martinez@gmail.com', phone: '+54 9 341 678-9220', city: 'Rosario', address: 'Bv. Oroño 1245, Centro', daysAgoFirst: 30, daysAgoLast: 1, orders: 2, spent: 98000 },
  { fullName: 'Lucía Benítez', email: 'lucia.benitez@gmail.com', phone: '+54 9 261 554-1123', city: 'Mendoza', address: 'Av. San Martín 750, Godoy Cruz', daysAgoFirst: 25, daysAgoLast: 12, orders: 1, spent: 65000 },
  { fullName: 'Agustín Morales', email: 'agustin.morales@yahoo.com.ar', phone: '+54 9 221 489-0012', city: 'La Plata', address: 'Calle 7 N° 1120', daysAgoFirst: 20, daysAgoLast: 3, orders: 2, spent: 142000 },
  { fullName: 'Florencia Díaz', email: 'flor.diaz@gmail.com', phone: '+54 9 223 512-8877', city: 'Mar del Plata', address: 'Güemes 2840', daysAgoFirst: 15, daysAgoLast: 6, orders: 1, spent: 78000 },
  { fullName: 'Joaquín Navarro', email: 'joaco.navarro@gmail.com', phone: '+54 9 11 6321-4455', city: 'San Isidro', address: 'Av. Centenario 450', daysAgoFirst: 10, daysAgoLast: 0, orders: 1, spent: 85000 },
];

export function generateDemoClients(storeId: string): DemoClient[] {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  return RAW_CLIENTS.map((c) => ({
    id: `${storeId}_${c.email}`,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    storeId,
    city: c.city,
    address: c.address,
    firstOrderDate: new Date(now - c.daysAgoFirst * DAY_MS),
    lastOrderDate: new Date(now - c.daysAgoLast * DAY_MS),
    numberOfOrders: c.orders,
    totalSpent: c.spent,
  }));
}

export function generateDemoOrders(
  storeId: string,
  seededProducts: Array<{ id: string; name: string; price: number; image?: string }>,
): DemoOrder[] {
  if (seededProducts.length === 0) return [];

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;

  const p = (idx: number) => seededProducts[idx % seededProducts.length]!;

  return [
    {
      id: `${storeId}-ORD-1001`,
      storeId,
      clientName: 'Valentina García',
      clientEmail: 'valenti.garcia@gmail.com',
      clientPhone: '+54 9 11 4523-8801',
      orderDate: new Date(now - 2 * DAY_MS),
      status: 'delivered',
      subtotal: p(0).price * 2,
      shippingCost: 3500,
      total: p(0).price * 2 + 3500,
      paymentMethod: 'Mercado Pago - Tarjeta de Crédito',
      paymentStatus: 'approved',
      items: [{ productId: p(0).id, productName: p(0).name, quantity: 2, price: p(0).price, image: p(0).image }],
      shippingAddress: { street: 'Av. Santa Fe 3421, Palermo', city: 'CABA', state: 'Buenos Aires', zip: '1425' },
      deliverySelection: { type: 'home_delivery' },
    },
    {
      id: `${storeId}-ORD-1002`,
      storeId,
      clientName: 'Mateo Rodríguez',
      clientEmail: 'mateo.rodriguez@gmail.com',
      clientPhone: '+54 9 11 5634-9912',
      orderDate: new Date(now - 1 * DAY_MS),
      status: 'processing',
      subtotal: p(1).price,
      shippingCost: 0,
      total: p(1).price,
      paymentMethod: 'Mercado Pago - Dinero en Cuenta',
      paymentStatus: 'approved',
      items: [{ productId: p(1).id, productName: p(1).name, quantity: 1, price: p(1).price, image: p(1).image }],
      deliverySelection: { type: 'store_pickup', pickupAddressFormatted: 'Sucursal Central - Showroom Oficial' },
    },
    {
      id: `${storeId}-ORD-1003`,
      storeId,
      clientName: 'Camila López',
      clientEmail: 'camila.lopez@outlook.com',
      clientPhone: '+54 9 351 471-2334',
      orderDate: new Date(now - 3 * DAY_MS),
      status: 'shipped',
      subtotal: p(2).price + p(3).price,
      shippingCost: 4200,
      total: p(2).price + p(3).price + 4200,
      paymentMethod: 'Mercado Pago - Tarjeta de Débito',
      paymentStatus: 'approved',
      items: [
        { productId: p(2).id, productName: p(2).name, quantity: 1, price: p(2).price, image: p(2).image },
        { productId: p(3).id, productName: p(3).name, quantity: 1, price: p(3).price, image: p(3).image },
      ],
      shippingAddress: { street: 'Bv. San Juan 840', city: 'Córdoba Capital', state: 'Córdoba', zip: '5000' },
      deliverySelection: { type: 'home_delivery' },
    },
    {
      id: `${storeId}-ORD-1004`,
      storeId,
      clientName: 'Santiago Martínez',
      clientEmail: 'santi.martinez@gmail.com',
      clientPhone: '+54 9 341 678-9220',
      orderDate: new Date(now - 8 * HOUR_MS),
      status: 'ready_for_pickup',
      subtotal: p(4).price,
      shippingCost: 0,
      total: p(4).price,
      paymentMethod: 'Transferencia Bancaria',
      paymentStatus: 'approved',
      items: [{ productId: p(4).id, productName: p(4).name, quantity: 1, price: p(4).price, image: p(4).image }],
      deliverySelection: { type: 'store_pickup', pickupAddressFormatted: 'Sucursal Central - Showroom Oficial' },
    },
    {
      id: `${storeId}-ORD-1005`,
      storeId,
      clientName: 'Lucía Benítez',
      clientEmail: 'lucia.benitez@gmail.com',
      clientPhone: '+54 9 261 554-1123',
      orderDate: new Date(now - 5 * DAY_MS),
      status: 'delivered',
      subtotal: p(5).price * 3,
      shippingCost: 4800,
      total: p(5).price * 3 + 4800,
      paymentMethod: 'Mercado Pago',
      paymentStatus: 'approved',
      items: [{ productId: p(5).id, productName: p(5).name, quantity: 3, price: p(5).price, image: p(5).image }],
      shippingAddress: { street: 'Av. San Martín 750', city: 'Mendoza', state: 'Mendoza', zip: '5500' },
      deliverySelection: { type: 'home_delivery' },
    },
    {
      id: `${storeId}-ORD-1006`,
      storeId,
      clientName: 'Agustín Morales',
      clientEmail: 'agustin.morales@yahoo.com.ar',
      clientPhone: '+54 9 221 489-0012',
      orderDate: new Date(now - 4 * HOUR_MS),
      status: 'pending',
      subtotal: p(6).price,
      shippingCost: 3500,
      total: p(6).price + 3500,
      paymentMethod: 'Transferencia Bancaria',
      paymentStatus: 'pending',
      items: [{ productId: p(6).id, productName: p(6).name, quantity: 1, price: p(6).price, image: p(6).image }],
      shippingAddress: { street: 'Calle 7 N° 1120', city: 'La Plata', state: 'Buenos Aires', zip: '1900' },
      deliverySelection: { type: 'home_delivery' },
    },
    {
      id: `${storeId}-ORD-1007`,
      storeId,
      clientName: 'Florencia Díaz',
      clientEmail: 'flor.diaz@gmail.com',
      clientPhone: '+54 9 223 512-8877',
      orderDate: new Date(now - 7 * DAY_MS),
      status: 'delivered',
      subtotal: p(7).price + p(8).price,
      shippingCost: 0,
      total: p(7).price + p(8).price,
      paymentMethod: 'Mercado Pago - Tarjeta de Crédito',
      paymentStatus: 'approved',
      items: [
        { productId: p(7).id, productName: p(7).name, quantity: 1, price: p(7).price, image: p(7).image },
        { productId: p(8).id, productName: p(8).name, quantity: 1, price: p(8).price, image: p(8).image },
      ],
      deliverySelection: { type: 'store_pickup', pickupAddressFormatted: 'Sucursal Mar del Plata - Güemes 2840' },
    },
    {
      id: `${storeId}-ORD-1008`,
      storeId,
      clientName: 'Joaquín Navarro',
      clientEmail: 'joaco.navarro@gmail.com',
      clientPhone: '+54 9 11 6321-4455',
      orderDate: new Date(now - 1 * HOUR_MS),
      status: 'processing',
      subtotal: p(9).price * 2,
      shippingCost: 3200,
      total: p(9).price * 2 + 3200,
      paymentMethod: 'Mercado Pago - Dinero en Cuenta',
      paymentStatus: 'approved',
      items: [{ productId: p(9).id, productName: p(9).name, quantity: 2, price: p(9).price, image: p(9).image }],
      shippingAddress: { street: 'Av. Centenario 450', city: 'San Isidro', state: 'Buenos Aires', zip: '1642' },
      deliverySelection: { type: 'home_delivery' },
    },
  ];
}
