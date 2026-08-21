export interface DemoClient {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  storeId: string;
  firstOrderDate: Date;
  lastOrderDate: Date;
  numberOfOrders: number;
}

export interface DemoOrder {
  id: string;
  storeId: string;
  clientName: string;
  clientEmail: string;
  orderDate: Date;
  status: 'pending' | 'processing' | 'ready_for_pickup' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  paymentMethod: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
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
  { fullName: 'Valentina García', email: 'valenti.garcia@gmail.com', phone: '+54 9 11 4523-8801', daysAgoFirst: 90, daysAgoLast: 5, orders: 4 },
  { fullName: 'Mateo Rodríguez', email: 'mateo.rodriguez@gmail.com', phone: '+54 9 11 5634-9912', daysAgoFirst: 60, daysAgoLast: 2, orders: 3 },
  { fullName: 'Camila López', email: 'camila.lopez@outlook.com', phone: '+54 9 11 4712-3345', daysAgoFirst: 30, daysAgoLast: 14, orders: 2 },
  { fullName: 'Santiago Martínez', email: 'santi.martinez@gmail.com', phone: '+54 9 11 6789-2200', daysAgoFirst: 10, daysAgoLast: 1, orders: 1 },
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
    firstOrderDate: new Date(now - c.daysAgoFirst * DAY_MS),
    lastOrderDate: new Date(now - c.daysAgoLast * DAY_MS),
    numberOfOrders: c.orders,
  }));
}

export function generateDemoOrders(
  storeId: string,
  seededProducts: Array<{ id: string; name: string; price: number }>,
): DemoOrder[] {
  if (seededProducts.length === 0) return [];

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const p1 = seededProducts[0];
  const p2 = seededProducts[1] ?? seededProducts[0];

  return [
    {
      id: `${storeId}-ORD-1001`,
      storeId,
      clientName: 'Valentina García',
      clientEmail: 'valenti.garcia@gmail.com',
      orderDate: new Date(now - 2 * DAY_MS),
      status: 'delivered',
      total: p1.price * 2 + 3500,
      paymentMethod: 'MercadoPago',
      items: [{ productId: p1.id, productName: p1.name, quantity: 2, price: p1.price }],
      shippingAddress: { street: 'Av. Corrientes 4531', city: 'CABA', state: 'Buenos Aires', zip: '1414' },
      deliverySelection: { type: 'home_delivery' },
    },
    {
      id: `${storeId}-ORD-1002`,
      storeId,
      clientName: 'Mateo Rodríguez',
      clientEmail: 'mateo.rodriguez@gmail.com',
      orderDate: new Date(now - 1 * DAY_MS),
      status: 'processing',
      total: p2.price,
      paymentMethod: 'MercadoPago',
      items: [{ productId: p2.id, productName: p2.name, quantity: 1, price: p2.price }],
      deliverySelection: { type: 'store_pickup', pickupAddressFormatted: 'Sucursal Central - Av. Santa Fe 2200' },
    },
    {
      id: `${storeId}-ORD-1003`,
      storeId,
      clientName: 'Santiago Martínez',
      clientEmail: 'santi.martinez@gmail.com',
      orderDate: new Date(now - 6 * 60 * 60 * 1000),
      status: 'pending',
      total: p1.price,
      paymentMethod: 'Transferencia',
      items: [{ productId: p1.id, productName: p1.name, quantity: 1, price: p1.price }],
      deliverySelection: { type: 'store_pickup' },
    },
  ];
}
