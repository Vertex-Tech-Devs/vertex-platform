import type {
  BusinessVerticalDefinition,
  BusinessVerticalId,
  BusinessVerticalSummary,
} from '../types/verticals.types';

import { TECNOLOGIA_ELECTRONICA_PRESET } from './presets/tecnologia-electronica';
import { INDUMENTARIA_CALZADO_PRESET } from './presets/indumentaria-calzado';
import { GASTRONOMIA_RESTAURANTE_PRESET } from './presets/gastronomia-restaurante';
import { HOGAR_MUEBLES_DECO_PRESET } from './presets/hogar-muebles-deco';
import { BELLEZA_COSMETICA_PRESET } from './presets/belleza-cosmetica';
import { FARMACIA_SALUD_PRESET } from './presets/farmacia-salud';
import { SUPERMERCADO_ALMACEN_PRESET } from './presets/supermercado-almacen';
import { FERRETERIA_CONSTRUCCION_PRESET } from './presets/ferreteria-construccion';
import { DEPORTES_FITNESS_PRESET } from './presets/deportes-fitness';
import { AUTOMOTRIZ_REPUESTOS_PRESET } from './presets/automotriz-repuestos';
import { PET_SHOP_VETERINARIA_PRESET } from './presets/pet-shop-veterinaria';
import { JOYERIA_RELOJERIA_PRESET } from './presets/joyeria-relojeria';
import { LIBRERIA_PAPELERIA_PRESET } from './presets/libreria-papeleria';
import { JUGUETERIA_BEBES_PRESET } from './presets/jugueteria-bebes';
import { VINOTECA_LICORERIA_PRESET } from './presets/vinoteca-licoreria';
import { OPTICA_ACCESORIOS_PRESET } from './presets/optica-accesorios';
import { INSTRUMENTOS_MUSICALES_PRESET } from './presets/instrumentos-musicales';
import { VIVEROS_JARDINERIA_PRESET } from './presets/viveros-jardineria';
import { DIETETICA_NATURISTA_PRESET } from './presets/dietetica-naturista';
import { BIJOUTERIE_ACCESORIOS_PRESET } from './presets/bijouterie-accesorios';
import { IMPRENTA_MERCHANDISING_PRESET } from './presets/imprenta-merchandising';

const PRESETS_MAP: Record<BusinessVerticalId, BusinessVerticalDefinition> = {
  TECNOLOGIA_ELECTRONICA: TECNOLOGIA_ELECTRONICA_PRESET,
  INDUMENTARIA_CALZADO: INDUMENTARIA_CALZADO_PRESET,
  GASTRONOMIA_RESTAURANTE: GASTRONOMIA_RESTAURANTE_PRESET,
  HOGAR_MUEBLES_DECO: HOGAR_MUEBLES_DECO_PRESET,
  BELLEZA_COSMETICA: BELLEZA_COSMETICA_PRESET,
  FARMACIA_SALUD: FARMACIA_SALUD_PRESET,
  SUPERMERCADO_ALMACEN: SUPERMERCADO_ALMACEN_PRESET,
  FERRETERIA_CONSTRUCCION: FERRETERIA_CONSTRUCCION_PRESET,
  DEPORTES_FITNESS: DEPORTES_FITNESS_PRESET,
  AUTOMOTRIZ_REPUESTOS: AUTOMOTRIZ_REPUESTOS_PRESET,
  PET_SHOP_VETERINARIA: PET_SHOP_VETERINARIA_PRESET,
  JOYERIA_RELOJERIA: JOYERIA_RELOJERIA_PRESET,
  LIBRERIA_PAPELERIA: LIBRERIA_PAPELERIA_PRESET,
  JUGUETERIA_BEBES: JUGUETERIA_BEBES_PRESET,
  VINOTECA_LICORERIA: VINOTECA_LICORERIA_PRESET,
  OPTICA_ACCESORIOS: OPTICA_ACCESORIOS_PRESET,
  INSTRUMENTOS_MUSICALES: INSTRUMENTOS_MUSICALES_PRESET,
  VIVEROS_JARDINERIA: VIVEROS_JARDINERIA_PRESET,
  DIETETICA_NATURISTA: DIETETICA_NATURISTA_PRESET,
  BIJOUTERIE_ACCESORIOS: BIJOUTERIE_ACCESORIOS_PRESET,
  IMPRENTA_MERCHANDISING: IMPRENTA_MERCHANDISING_PRESET,
};

export function resolveVerticalKey(input?: string): BusinessVerticalId {
  if (!input) {
    return 'TECNOLOGIA_ELECTRONICA';
  }

  const normalized = input.trim().toUpperCase().replace(/[-\s]/g, '_');

  if (normalized in PRESETS_MAP) {
    return normalized as BusinessVerticalId;
  }

  if (normalized.includes('TEC') || normalized.includes('ELECTRO')) {
    return 'TECNOLOGIA_ELECTRONICA';
  }
  if (
    normalized.includes('INDUMENTARIA') ||
    normalized.includes('ROPA') ||
    normalized.includes('MODA')
  ) {
    return 'INDUMENTARIA_CALZADO';
  }
  if (normalized.includes('GASTRO') || normalized.includes('REST') || normalized.includes('CAF')) {
    return 'GASTRONOMIA_RESTAURANTE';
  }
  if (
    normalized.includes('HOGAR') ||
    normalized.includes('MUEBLE') ||
    normalized.includes('DECO')
  ) {
    return 'HOGAR_MUEBLES_DECO';
  }
  if (normalized.includes('BELLEZA') || normalized.includes('COSMETICA')) {
    return 'BELLEZA_COSMETICA';
  }
  if (normalized.includes('FARMACIA') || normalized.includes('SALUD')) {
    return 'FARMACIA_SALUD';
  }
  if (normalized.includes('SUPER') || normalized.includes('ALMACEN')) {
    return 'SUPERMERCADO_ALMACEN';
  }
  if (normalized.includes('FERRETERIA') || normalized.includes('CONST')) {
    return 'FERRETERIA_CONSTRUCCION';
  }
  if (normalized.includes('DEPORT') || normalized.includes('FITNESS')) {
    return 'DEPORTES_FITNESS';
  }
  if (normalized.includes('AUTO') || normalized.includes('REPUESTO')) {
    return 'AUTOMOTRIZ_REPUESTOS';
  }
  if (normalized.includes('PET') || normalized.includes('VET')) {
    return 'PET_SHOP_VETERINARIA';
  }
  if (normalized.includes('JOY') || normalized.includes('RELOJ')) {
    return 'JOYERIA_RELOJERIA';
  }
  if (normalized.includes('LIBRO') || normalized.includes('LIBRERIA')) {
    return 'LIBRERIA_PAPELERIA';
  }
  if (normalized.includes('JUGUETE') || normalized.includes('BEBE')) {
    return 'JUGUETERIA_BEBES';
  }
  if (normalized.includes('VINO') || normalized.includes('LICOR')) {
    return 'VINOTECA_LICORERIA';
  }
  if (normalized.includes('OPTIC')) {
    return 'OPTICA_ACCESORIOS';
  }
  if (normalized.includes('MUSIC') || normalized.includes('INSTRUMENT')) {
    return 'INSTRUMENTOS_MUSICALES';
  }
  if (normalized.includes('VIVERO') || normalized.includes('JARDIN')) {
    return 'VIVEROS_JARDINERIA';
  }
  if (normalized.includes('DIET') || normalized.includes('NATUR')) {
    return 'DIETETICA_NATURISTA';
  }
  if (normalized.includes('BIJOU') || normalized.includes('ACCESORIO')) {
    return 'BIJOUTERIE_ACCESORIOS';
  }
  if (normalized.includes('IMP') || normalized.includes('GRAFIC') || normalized.includes('MERCH')) {
    return 'IMPRENTA_MERCHANDISING';
  }

  return 'TECNOLOGIA_ELECTRONICA';
}

export function buildCustomVerticalDefinition(
  data: Record<string, unknown>,
): BusinessVerticalDefinition {
  const id = String(data['id'] || data['slug'] || 'CUSTOM_VERTICAL');
  const name = String(data['name'] || 'Rubro Personalizado');
  const icon = String(data['icon'] || '🏷️');
  const description = String(data['description'] || '');
  const bannerTitle = String(data['bannerTitle'] || `¡Bienvenidos a ${name}!`);
  const bannerSubtitle = String(
    data['bannerSubtitle'] || 'Descubrí los mejores productos y promociones exclusivas.',
  );

  const rawCategories = Array.isArray(data['categories']) ? data['categories'] : [];
  const categories = rawCategories.map((c, i) => {
    if (typeof c === 'string') {
      const slug = c
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      return {
        id: slug || `cat-${i + 1}`,
        name: c,
        slug: slug || `cat-${i + 1}`,
        order: i + 1,
      };
    }
    return {
      id: String(c.id || c.slug || `cat-${i + 1}`),
      name: String(c.name || `Categoría ${i + 1}`),
      slug: String(c.slug || `cat-${i + 1}`),
      icon: c.icon ? String(c.icon) : undefined,
      description: c.description ? String(c.description) : undefined,
      order: typeof c.order === 'number' ? c.order : i + 1,
    };
  });

  if (categories.length === 0) {
    categories.push(
      { id: 'destacados', name: 'Destacados', slug: 'destacados', order: 1 },
      { id: 'ofertas', name: 'Ofertas', slug: 'ofertas', order: 2 },
    );
  }

  const rawAttrs = Array.isArray(data['attributes']) ? data['attributes'] : [];
  const attributes = rawAttrs.map((a, i) => ({
    id: String(a.id || a.code || `attr-${i + 1}`),
    name: String(a.name || `Atributo ${i + 1}`),
    code: String(a.code || `attr_${i + 1}`),
    type: (a.type as 'select' | 'color' | 'button' | 'text') || 'select',
    values: Array.isArray(a.values) ? a.values.map(String) : ['Estándar'],
    required: Boolean(a.required),
  }));

  const curatedImages = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
  ];

  const productTitles = [
    'Edición Especial Pro',
    'Premium Collection',
    'Classic Edition',
    'Ultra Slim & Confort',
    'Línea Profesional Gold',
    'Modelo Signature',
    'Edición Limitada Black',
    'Selection Deluxe',
    'Esencial Diario',
    'Pack Dúo Confort',
    'Innovación & Diseño',
    'Alta Gama Silver',
    'Master Pro Series',
    'Estilo Contemporáneo',
    'Calidad Certificada',
    'Línea Urbana Confort',
    'Versión Titanium',
    'Colección Temporada',
    'Edición de Autor',
    'Gama Superior Advance',
  ];

  let sampleProducts: Array<{
    name: string;
    categorySlug: string;
    price: number;
    stock: number;
    skuPrefix: string;
    description: string;
    image: string;
    hasVariants: boolean;
    variants?: Array<{
      sku: string;
      price: number;
      stock: number;
      attributes: Record<string, string>;
    }>;
  }>;

  if (Array.isArray(data['sampleProducts']) && data['sampleProducts'].length >= 20) {
    sampleProducts = data['sampleProducts'] as typeof sampleProducts;
  } else {
    sampleProducts = [];
    for (let i = 0; i < 20; i++) {
      const cat = categories[i % categories.length] ?? categories[0]!;
      const title = productTitles[i] ?? `Producto ${i + 1}`;
      const price = 15000 + (i + 1) * 7500;
      const image = curatedImages[i % curatedImages.length]!;
      const skuPrefix = `CUST-${(i + 1).toString().padStart(2, '0')}`;

      sampleProducts.push({
        name: `${name} ${cat.name} ${title}`,
        categorySlug: cat.slug,
        price,
        stock: 20 + ((i * 5) % 40),
        skuPrefix,
        description: `Producto seleccionado de alta calidad para la categoría ${cat.name} de la tienda ${name}. Garantía y respaldo oficial.`,
        image,
        hasVariants: false,
      });
    }
  }

  return {
    id: id as BusinessVerticalId,
    name,
    icon,
    description,
    bannerTitle,
    bannerSubtitle,
    heroImages:
      Array.isArray(data['heroImages']) && data['heroImages'].length > 0
        ? data['heroImages'].map(String)
        : [
            'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&auto=format&fit=crop&q=80',
          ],
    featuredCategories: categories.slice(0, 3).map((c) => ({
      categoryId: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl:
        'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80',
    })),
    categories,
    attributes,
    sampleProducts,
    colors: {
      primary: String(
        (data['themeColors'] as Record<string, unknown>)?.['primary'] ||
          (data['colors'] as Record<string, unknown>)?.['primary'] ||
          '#6366f1',
      ),
      accent: String(
        (data['themeColors'] as Record<string, unknown>)?.['accent'] ||
          (data['colors'] as Record<string, unknown>)?.['accent'] ||
          '#06b6d4',
      ),
      background: '#ffffff',
    },
    featureCards: [
      {
        title: 'Calidad Garantizada',
        content: `Seleccionamos rigurosamente cada producto para nuestra tienda ${name}.`,
      },
      {
        title: 'Envíos Rápidos',
        content: 'Despachamos tus pedidos con seguimiento online a todo el país.',
      },
      {
        title: 'Atención Personalizada',
        content: 'Estamos disponibles para asesorarte en cada paso de tu compra.',
      },
    ],
  };
}

export function getBusinessVerticalPreset(id: string): BusinessVerticalDefinition {
  const resolvedId = resolveVerticalKey(id);
  return PRESETS_MAP[resolvedId] ?? TECNOLOGIA_ELECTRONICA_PRESET;
}

export async function getBusinessVerticalPresetAsync(
  id: string,
): Promise<BusinessVerticalDefinition> {
  const normalized = (id || '').trim().toUpperCase().replace(/[-\s]/g, '_');
  if (normalized in PRESETS_MAP) {
    return PRESETS_MAP[normalized as BusinessVerticalId];
  }

  try {
    const { getFirestore } = require('firebase-admin/firestore');
    const db = getFirestore();
    const docSnap = await db.collection('business_verticals').doc(id).get();
    if (docSnap.exists) {
      return buildCustomVerticalDefinition({ id: docSnap.id, ...docSnap.data() });
    }
  } catch (err) {
    console.warn(`[getBusinessVerticalPresetAsync] No se pudo leer custom vertical ${id}:`, err);
  }

  return getBusinessVerticalPreset(id);
}

export function getAllBusinessVerticalsSummary(): BusinessVerticalSummary[] {
  return Object.values(PRESETS_MAP).map((preset) => ({
    id: preset.id,
    name: preset.name,
    icon: preset.icon,
    description: preset.description,
  }));
}
