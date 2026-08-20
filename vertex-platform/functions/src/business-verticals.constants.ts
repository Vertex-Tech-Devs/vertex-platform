export interface CategorySeed {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  filterableAttributes: string[];
}

export interface AttributeSeed {
  id: string;
  name: string;
  values: string[];
}

export interface ProductSeed {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  discount?: number;
  image: string;
  images?: string[];
  variantAttributes: string[];
}

export interface VerticalSeedData {
  categories: CategorySeed[];
  attributes: AttributeSeed[];
  products: ProductSeed[];
  bannerTitle: string;
  bannerSubtitle: string;
  heroImages: string[];
  featuredCategories: Array<{
    categoryId: string;
    name: string;
    slug: string;
    imageUrl: string;
  }>;
}

export const BUSINESS_VERTICAL_SEEDS: Record<string, VerticalSeedData> = {
  INDUMENTARIA_MODA: {
    bannerTitle: 'Nueva Colección 2026',
    bannerSubtitle: 'Moda argentina con identidad propia y alcance nacional.',
    heroImages: [
      'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1920&h=700&fit=crop&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&h=700&fit=crop&q=80',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1920&h=700&fit=crop&q=80',
    ],
    featuredCategories: [
      {
        categoryId: 'remeras',
        name: 'Remeras',
        slug: 'remeras',
        imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=400&fit=crop&q=80',
      },
      {
        categoryId: 'camperas',
        name: 'Camperas',
        slug: 'camperas',
        imageUrl: 'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600&h=400&fit=crop&q=80',
      },
      {
        categoryId: 'zapatillas',
        name: 'Zapatillas',
        slug: 'zapatillas',
        imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&h=400&fit=crop&q=80',
      },
    ],
    categories: [
      { id: 'remeras', name: 'Remeras', slug: 'remeras', parentId: null, filterableAttributes: ['talle-ropa', 'color'] },
      { id: 'pantalones', name: 'Pantalones', slug: 'pantalones', parentId: null, filterableAttributes: ['talle-pantalon', 'color'] },
      { id: 'zapatillas', name: 'Zapatillas', slug: 'zapatillas', parentId: null, filterableAttributes: ['talle-calzado', 'color'] },
      { id: 'camperas', name: 'Camperas', slug: 'camperas', parentId: null, filterableAttributes: ['talle-ropa', 'color'] },
      { id: 'accesorios', name: 'Accesorios', slug: 'accesorios', parentId: null, filterableAttributes: ['color'] },
    ],
    attributes: [
      { id: 'talle-ropa', name: 'Talle (ropa)', values: ['S', 'M', 'L', 'XL'] },
      { id: 'talle-pantalon', name: 'Talle (pantalón)', values: ['38', '40', '42', '44'] },
      { id: 'talle-calzado', name: 'Talle (calzado)', values: ['39', '40', '41', '42', '43'] },
      { id: 'color', name: 'Color', values: ['Negro', 'Blanco', 'Azul', 'Gris', 'Verde', 'Beige'] },
    ],
    products: [
      {
        id: 'prod-ind-01',
        name: 'Remera Oversize Vintage Acid',
        description: 'Remera 100% algodón peinado 24/1 con lavado acid wash y estampa serigráfica de alta durabilidad.',
        categoryId: 'remeras',
        price: 24999,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['talle-ropa', 'color'],
      },
      {
        id: 'prod-ind-02',
        name: 'Pantalón Cargo Baggy Ripstop',
        description: 'Pantalón cargo corte ancho confeccionado en ripstop antidesgarro con 6 bolsillos funcionales.',
        categoryId: 'pantalones',
        price: 54999,
        image: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['talle-pantalon', 'color'],
      },
      {
        id: 'prod-ind-03',
        name: 'Campera Puffer Térmica Street',
        description: 'Campera puffer ultraliviana con relleno térmico simil pluma y exterior impermeable.',
        categoryId: 'camperas',
        price: 89999,
        image: 'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['talle-ropa', 'color'],
      },
      {
        id: 'prod-ind-04',
        name: 'Zapatillas Urban Retro Low',
        description: 'Zapatillas urbanas de cuero sintético premium con suela vulcanizada antideslizante.',
        categoryId: 'zapatillas',
        price: 68999,
        image: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['talle-calzado', 'color'],
      },
    ],
  },
  GASTRONOMIA_CAFE: {
    bannerTitle: 'Sabores Artesanales y Café de Especialidad',
    bannerSubtitle: 'Ingredientes frescos seleccionados para brindarte la mejor experiencia gastronómica.',
    heroImages: [
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&h=700&fit=crop&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&h=700&fit=crop&q=80',
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1920&h=700&fit=crop&q=80',
    ],
    featuredCategories: [
      {
        categoryId: 'hamburguesas',
        name: 'Hamburguesas',
        slug: 'hamburguesas',
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop&q=80',
      },
      {
        categoryId: 'cafe-especialidad',
        name: 'Cafetería',
        slug: 'cafeteria',
        imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=400&fit=crop&q=80',
      },
      {
        categoryId: 'postres',
        name: 'Pastelería',
        slug: 'pasteleria',
        imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=400&fit=crop&q=80',
      },
    ],
    categories: [
      { id: 'hamburguesas', name: 'Hamburguesas Gourmet', slug: 'hamburguesas', parentId: null, filterableAttributes: ['tipo-pan', 'puntos-coccion'] },
      { id: 'cafe-especialidad', name: 'Café de Especialidad', slug: 'cafe-especialidad', parentId: null, filterableAttributes: ['tostado', 'leche'] },
      { id: 'postres', name: 'Postres & Pastelería', slug: 'postres', parentId: null, filterableAttributes: ['variedad'] },
      { id: 'bebidas', name: 'Bebidas & Coctelería', slug: 'bebidas', parentId: null, filterableAttributes: ['tamano'] },
    ],
    attributes: [
      { id: 'tipo-pan', name: 'Tipo de Pan', values: ['Brioche', 'Papa', 'Sin TACC'] },
      { id: 'leche', name: 'Tipo de Leche', values: ['Entera', 'Descremada', 'Almendras', 'Avena'] },
      { id: 'tostado', name: 'Tostado', values: ['Medio (Colombia)', 'Intenso (Brasil)'] },
      { id: 'tamano', name: 'Tamaño', values: ['Chico (250ml)', 'Mediano (350ml)', 'Grande (500ml)'] },
    ],
    products: [
      {
        id: 'prod-gas-01',
        name: 'Burger Doble Smash Cheddar Bacon',
        description: 'Doble medallón de 110g smash, cuádruple cheddar fundido, panceta crocante y salsa Thousand Islands.',
        categoryId: 'hamburguesas',
        price: 9800,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['tipo-pan'],
      },
      {
        id: 'prod-gas-02',
        name: 'Flat White de Especialidad',
        description: 'Doble shot de espresso de grano arábica origen Etiopía con leche emulsionada sedosa.',
        categoryId: 'cafe-especialidad',
        price: 3900,
        image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['leche', 'tostado'],
      },
      {
        id: 'prod-gas-03',
        name: 'Cheesecake Estilo Vasco con Frutos Rojos',
        description: 'Porción generosa de cheesecake horneado al estilo vasco, centro cremoso y coulis de frambuesas.',
        categoryId: 'postres',
        price: 5200,
        image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=800&fit=crop&q=80',
        variantAttributes: [],
      },
    ],
  },
  TECNOLOGIA: {
    bannerTitle: 'Tecnología de Vanguardia y Gadgets',
    bannerSubtitle: 'Equipos, periféricos y accesorios de alto rendimiento con garantía oficial.',
    heroImages: [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920&h=700&fit=crop&q=80',
      'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1920&h=700&fit=crop&q=80',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1920&h=700&fit=crop&q=80',
    ],
    featuredCategories: [
      {
        categoryId: 'audio',
        name: 'Audio & Auriculares',
        slug: 'audio',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop&q=80',
      },
      {
        categoryId: 'smartphones',
        name: 'Smartphones & Smartwatches',
        slug: 'smartphones',
        imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=400&fit=crop&q=80',
      },
      {
        categoryId: 'perifericos',
        name: 'Periféricos & Setup',
        slug: 'perifericos',
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&h=400&fit=crop&q=80',
      },
    ],
    categories: [
      { id: 'audio', name: 'Audio & Auriculares', slug: 'audio', parentId: null, filterableAttributes: ['color', 'conectividad'] },
      { id: 'smartphones', name: 'Smartphones & Wearables', slug: 'smartphones', parentId: null, filterableAttributes: ['almacenamiento', 'color'] },
      { id: 'perifericos', name: 'Teclados & Mouse', slug: 'perifericos', parentId: null, filterableAttributes: ['switch', 'color'] },
      { id: 'cargadores', name: 'Cables & Hubs', slug: 'cargadores', parentId: null, filterableAttributes: ['potencia'] },
    ],
    attributes: [
      { id: 'color', name: 'Color', values: ['Negro Matte', 'Plata', 'Gris Espacial', 'Blanco'] },
      { id: 'almacenamiento', name: 'Almacenamiento', values: ['128 GB', '256 GB', '512 GB'] },
      { id: 'conectividad', name: 'Conectividad', values: ['Bluetooth 5.3', 'Inalámbrico 2.4GHz', 'USB-C'] },
      { id: 'switch', name: 'Tipo de Switch', values: ['Red Lineal', 'Brown Táctil', 'Blue Clicky'] },
    ],
    products: [
      {
        id: 'prod-tec-01',
        name: 'Auriculares Noise Cancelling ANC Pro',
        description: 'Cancelación activa de ruido híbrida de 42dB, drivers de 40mm Hi-Res y batería de 45 horas continuas.',
        categoryId: 'audio',
        price: 139999,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['color'],
      },
      {
        id: 'prod-tec-02',
        name: 'Teclado Mecánico Custom 75% Wireless',
        description: 'Estructura gasket mount, switches prelubricados hot-swap, keycaps PBT doubleshot e iluminación RGB.',
        categoryId: 'perifericos',
        price: 114999,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['switch', 'color'],
      },
      {
        id: 'prod-tec-03',
        name: 'Smartwatch AMOLED Ultra GPS',
        description: 'Pantalla AMOLED de 1.43", sensor de ritmo cardíaco/SpO2, GPS satelital dual y resistencia 5 ATM.',
        categoryId: 'smartphones',
        price: 159999,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['color'],
      },
    ],
  },
  HOGAR_DECO: {
    bannerTitle: 'Diseño, Confort y Calidez para tu Hogar',
    bannerSubtitle: 'Muebles de madera maciza, luminarias de diseño y objetos decorativos modernos.',
    heroImages: [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1920&h=700&fit=crop&q=80',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=700&fit=crop&q=80',
      'https://images.unsplash.com/photo-1449247709967-d4461a6857f3?w=1920&h=700&fit=crop&q=80',
    ],
    featuredCategories: [
      {
        categoryId: 'iluminacion',
        name: 'Lámparas & Iluminación',
        slug: 'iluminacion',
        imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=400&fit=crop&q=80',
      },
      {
        categoryId: 'muebles',
        name: 'Muebles & Estanterías',
        slug: 'muebles',
        imageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=600&h=400&fit=crop&q=80',
      },
      {
        categoryId: 'decoracion',
        name: 'Vajilla & Decoración',
        slug: 'decoracion',
        imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=400&fit=crop&q=80',
      },
    ],
    categories: [
      { id: 'iluminacion', name: 'Iluminación de Diseño', slug: 'iluminacion', parentId: null, filterableAttributes: ['material', 'color'] },
      { id: 'muebles', name: 'Muebles & Estanterías', slug: 'muebles', parentId: null, filterableAttributes: ['madera', 'dimensiones'] },
      { id: 'decoracion', name: 'Objetos & Macetas', slug: 'decoracion', parentId: null, filterableAttributes: ['material', 'tamano'] },
      { id: 'textiles', name: 'Almohadones & Mantas', slug: 'textiles', parentId: null, filterableAttributes: ['color', 'tela'] },
    ],
    attributes: [
      { id: 'material', name: 'Material', values: ['Cerámica Esmaltada', 'Metal Laqueado', 'Vidrio Soplado'] },
      { id: 'madera', name: 'Madera', values: ['Paraíso Natural', 'Petiribí Macizo', 'Roble'] },
      { id: 'color', name: 'Color', values: ['Arena / Lino', 'Terracota', 'Negro Mate', 'Blanco Cálido'] },
      { id: 'dimensiones', name: 'Medidas', values: ['120 x 60 cm', '160 x 80 cm', '180 x 90 cm'] },
    ],
    products: [
      {
        id: 'prod-hog-01',
        name: 'Lámpara Colgante Nórdica de Madera',
        description: 'Luminaria artesanal confeccionada en láminas de guatambú curvado al vapor con cable textil regulable.',
        categoryId: 'iluminacion',
        price: 49999,
        image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['material', 'color'],
      },
      {
        id: 'prod-hog-02',
        name: 'Mesa Ratona Orgánica Petiribí',
        description: 'Mesa baja con tapa de bordes curvos suaves en madera maciza de petiribí con hidrolaca satinada.',
        categoryId: 'muebles',
        price: 129999,
        image: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['madera', 'dimensiones'],
      },
      {
        id: 'prod-hog-03',
        name: 'Set de Macetas Escultóricas de Cerámica',
        description: 'Juego de 2 macetas artesanales torneadas a mano con acabado mate rugoso color crudo.',
        categoryId: 'decoracion',
        price: 34999,
        image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=800&fit=crop&q=80',
        variantAttributes: ['color'],
      },
    ],
  },
};

export function resolveVerticalSeedKey(input?: string): string {
  const norm = (input || '').toUpperCase().trim();
  if (norm.includes('GASTRONOMIA') || norm.includes('CAFE') || norm.includes('FOOD')) {
    return 'GASTRONOMIA_CAFE';
  }
  if (norm.includes('TECNO') || norm.includes('TECH') || norm.includes('ELEC')) {
    return 'TECNOLOGIA';
  }
  if (norm.includes('HOGAR') || norm.includes('DECO') || norm.includes('RETAIL') || norm.includes('FURNITURE')) {
    return 'HOGAR_DECO';
  }
  return 'INDUMENTARIA_MODA';
}
