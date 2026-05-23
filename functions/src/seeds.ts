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
    // Firestore REST API requires doubleValue or integerValue. Using doubleValue for safety with floats.
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

// Seed structures for our 3 verticals
const VERTICAL_SEEDS: Record<string, {
  categories: Array<{ id: string; name: string; slug: string; parentId: string | null; filterableAttributes: string[] }>;
  attributes: Array<{ id: string; name: string; values: string[] }>;
  products: Array<{
    id: string;
    name: string;
    description: string;
    categoryId: string;
    price: number;
    image: string;
    images?: string[];
    totalStock: number;
    variantAttributes: string[];
    inStockAttributes: Record<string, string[]>;
    variants: Array<{
      id: string;
      sku: string;
      attributes: Record<string, string>;
      stock: number;
      image?: string;
    }>;
  }>;
}> = {
  indumentaria: {
    categories: [
      { id: 'remeras', name: 'Remeras & Tops', slug: 'remeras-y-tops', parentId: null, filterableAttributes: ['talle', 'color'] },
      { id: 'pantalones', name: 'Pantalones & Jeans', slug: 'pantalones-y-jeans', parentId: null, filterableAttributes: ['talle'] },
      { id: 'accesorios', name: 'Accesorios', slug: 'accesorios', parentId: null, filterableAttributes: [] }
    ],
    attributes: [
      { id: 'talle', name: 'Talle', values: ['S', 'M', 'L', 'XL'] },
      { id: 'color', name: 'Color', values: ['Negro', 'Blanco', 'Azul', 'Gris'] }
    ],
    products: [
      {
        id: 'remera-basica-vertex',
        name: 'Remera Básica Vertex',
        description: 'Remera de algodón 100% peinado premium. Textura ultrasuave y calce moderno para uso diario.',
        categoryId: 'remeras',
        price: 14900,
        image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800',
        images: [
          'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800',
          'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800'
        ],
        totalStock: 45,
        variantAttributes: ['talle', 'color'],
        inStockAttributes: {
          talle: ['S', 'M', 'L'],
          color: ['Negro', 'Blanco']
        },
        variants: [
          { id: 'v1', sku: 'REM-BLK-S', attributes: { talle: 'S', color: 'Negro' }, stock: 15 },
          { id: 'v2', sku: 'REM-BLK-M', attributes: { talle: 'M', color: 'Negro' }, stock: 10 },
          { id: 'v3', sku: 'REM-WHT-M', attributes: { talle: 'M', color: 'Blanco' }, stock: 12 },
          { id: 'v4', sku: 'REM-WHT-L', attributes: { talle: 'L', color: 'Blanco' }, stock: 8 }
        ]
      },
      {
        id: 'jean-slim-fit',
        name: 'Jean Slim Fit Premium',
        description: 'Jean clásico confeccionado con denim elástico de alta resistencia. Comodidad y flexibilidad en cada movimiento.',
        categoryId: 'pantalones',
        price: 34900,
        image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800',
        images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
        totalStock: 30,
        variantAttributes: ['talle'],
        inStockAttributes: {
          talle: ['S', 'M', 'L']
        },
        variants: [
          { id: 'v5', sku: 'JEAN-SLIM-S', attributes: { talle: 'S' }, stock: 10 },
          { id: 'v6', sku: 'JEAN-SLIM-M', attributes: { talle: 'M' }, stock: 12 },
          { id: 'v7', sku: 'JEAN-SLIM-L', attributes: { talle: 'L' }, stock: 8 }
        ]
      },
      {
        id: 'gorra-trucker-vertex',
        name: 'Gorra Trucker Vertex',
        description: 'Gorra con visera curva, frente acolchado y malla transpirable trasera. Talle regulable snapback.',
        categoryId: 'accesorios',
        price: 9500,
        image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800',
        totalStock: 20,
        variantAttributes: [],
        inStockAttributes: {},
        variants: []
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
        totalStock: 999,
        variantAttributes: ['coccion'],
        inStockAttributes: {
          coccion: ['Jugosa', 'A punto', 'Cocida']
        },
        variants: [
          { id: 'v8', sku: 'BURGER-DELUXE-JUG', attributes: { coccion: 'Jugosa' }, stock: 333 },
          { id: 'v9', sku: 'BURGER-DELUXE-APU', attributes: { coccion: 'A punto' }, stock: 333 },
          { id: 'v10', sku: 'BURGER-DELUXE-COC', attributes: { coccion: 'Cocida' }, stock: 333 }
        ]
      },
      {
        id: 'papas-rusticas',
        name: 'Papas Rústicas de la Casa',
        description: 'Bastones de papa rústica fritos en doble cocción para mayor crocancia por fuera y suavidad por dentro. Acompañados de alioli casero.',
        categoryId: 'acompanamientos',
        price: 3500,
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800',
        totalStock: 999,
        variantAttributes: [],
        inStockAttributes: {},
        variants: []
      },
      {
        id: 'gaseosa-linea',
        name: 'Limonada de la Casa',
        description: 'Limonada fresca con menta fresca, jengibre y almíbar de limón casero. Servida con hielo.',
        categoryId: 'bebidas',
        price: 2200,
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800',
        totalStock: 500,
        variantAttributes: [],
        inStockAttributes: {},
        variants: []
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
        totalStock: 15,
        variantAttributes: ['color'],
        inStockAttributes: {
          color: ['Madera', 'Negro']
        },
        variants: [
          { id: 'v11', sku: 'LAMP-MIN-MAD', attributes: { color: 'Madera' }, stock: 8 },
          { id: 'v12', sku: 'LAMP-MIN-BLK', attributes: { color: 'Negro' }, stock: 7 }
        ]
      },
      {
        id: 'teclado-mecanico-rgb',
        name: 'Teclado Mecánico 60% RGB',
        description: 'Teclado mecánico ultra-compacto con switches táctiles, retroiluminación RGB configurable y cable USB-C desmontable.',
        categoryId: 'tecnologia',
        price: 45000,
        image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800',
        totalStock: 10,
        variantAttributes: [],
        inStockAttributes: {},
        variants: []
      },
      {
        id: 'cuaderno-de-cuero',
        name: 'Cuaderno Cuero Ecológico A5',
        description: 'Cuaderno con tapa de cuero ecológico, hojas rayadas de papel ahuesado de 90g y cierre con banda elástica premium.',
        categoryId: 'papeleria',
        price: 7800,
        image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800',
        totalStock: 30,
        variantAttributes: [],
        inStockAttributes: {},
        variants: []
      }
    ]
  }
};

/**
 * Seeds isolated child project database with category trees, attributes, and products with variants.
 */
export async function seedStoreData(auth: OAuth2Client, projectId: string, verticalId: string): Promise<void> {
  let seed = VERTICAL_SEEDS[verticalId];
  let targetVertical = verticalId;
  if (!seed) {
    console.log(`[SeedEngine] No seeds defined for vertical: ${verticalId}. Falling back gracefully to "retail" seed.`);
    seed = VERTICAL_SEEDS['retail'];
    targetVertical = 'retail';
  }
  if (!seed) {
    console.warn(`[SeedEngine] Fallback "retail" seed not found. Skipping database seeding.`);
    return;
  }

  console.log(`[SeedEngine] Starting database seeding for project "${projectId}" using vertical "${targetVertical}"...`);

  // 1. Seed Categories
  for (const cat of seed.categories) {
    const docData = {
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      filterableAttributes: cat.filterableAttributes
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

  // 2. Seed Attributes
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

  // 3. Seed Products and their Variants
  for (const prod of seed.products) {
    const prodData = {
      name: prod.name,
      description: prod.description,
      categoryId: prod.categoryId,
      price: prod.price,
      image: prod.image,
      images: prod.images ?? [prod.image],
      totalStock: prod.totalStock,
      variantAttributes: prod.variantAttributes,
      inStockAttributes: prod.inStockAttributes,
      createdAt: new Date()
    };

    // Write primary product document
    await retry(
      () => apiFetch(
        auth,
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prod.id}`,
        {
          method: 'PATCH',
          body: toFirestoreFields(prodData),
          quotaProject: projectId
        }
      ),
      5,
      6000
    );

    // Write subcollection variants if any
    for (const v of prod.variants) {
      const variantData = {
        productId: prod.id,
        sku: v.sku,
        attributes: v.attributes,
        stock: v.stock,
        image: v.image ?? null
      };

      await retry(
        () => apiFetch(
          auth,
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${prod.id}/variants/${v.id}`,
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
  }
  console.log(`[SeedEngine] Seeded ${seed.products.length} products and their variants.`);
  console.log(`[SeedEngine] Seeding completed successfully for project "${projectId}".`);
}
