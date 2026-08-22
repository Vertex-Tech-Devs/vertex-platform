export type BusinessVerticalId =
  | 'TECNOLOGIA_ELECTRONICA'
  | 'INDUMENTARIA_CALZADO'
  | 'GASTRONOMIA_RESTAURANTE'
  | 'HOGAR_MUEBLES_DECO'
  | 'BELLEZA_COSMETICA'
  | 'FARMACIA_SALUD'
  | 'SUPERMERCADO_ALMACEN'
  | 'FERRETERIA_CONSTRUCCION'
  | 'DEPORTES_FITNESS'
  | 'AUTOMOTRIZ_REPUESTOS'
  | 'PET_SHOP_VETERINARIA'
  | 'JOYERIA_RELOJERIA'
  | 'LIBRERIA_PAPELERIA'
  | 'JUGUETERIA_BEBES'
  | 'VINOTECA_LICORERIA'
  | 'OPTICA_ACCESORIOS'
  | 'INSTRUMENTOS_MUSICALES'
  | 'VIVEROS_JARDINERIA'
  | 'DIETETICA_NATURISTA'
  | 'BIJOUTERIE_ACCESORIOS'
  | 'IMPRENTA_MERCHANDISING'
  | (string & {});

export interface VerticalCategoryPreset {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  order: number;
  parentId?: string | null;
  filterableAttributes?: string[];
  imageUrl?: string;
}

export interface VerticalAttributePreset {
  id: string;
  name: string;
  code: string;
  type: 'select' | 'color' | 'button' | 'text';
  values: string[];
  required: boolean;
}

export interface VerticalProductVariantPreset {
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface VerticalProductPreset {
  id?: string;
  name: string;
  categorySlug: string;
  price: number;
  costPrice?: number;
  discount?: number;
  stock: number;
  skuPrefix: string;
  description: string;
  image: string;
  images?: string[];
  attributes?: Record<string, string>;
  variantAttributes?: string[];
  hasVariants: boolean;
  variants?: VerticalProductVariantPreset[];
  technicalSpecs?: Record<string, string>;
  tags?: string[];
  brand?: string;
}

export interface BusinessVerticalDefinition {
  id: BusinessVerticalId;
  name: string;
  icon: string;
  description: string;
  bannerTitle: string;
  bannerSubtitle: string;
  heroImages: string[];
  featuredCategories: Array<{
    categoryId: string;
    name: string;
    slug: string;
    imageUrl: string;
  }>;
  categories: VerticalCategoryPreset[];
  attributes: VerticalAttributePreset[];
  sampleProducts: VerticalProductPreset[];
  colors?: {
    primary: string;
    accent: string;
    background: string;
  };
  featureCards?: Array<{
    title: string;
    content: string;
  }>;
  tagline?: string;
  whatsappMessage?: string;
}

export interface BusinessVerticalSummary {
  id: BusinessVerticalId;
  name: string;
  icon: string;
  description: string;
}
