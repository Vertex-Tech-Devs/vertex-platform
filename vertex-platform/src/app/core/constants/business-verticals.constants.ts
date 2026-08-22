export interface VerticalOption {
  id: string;
  icon: string;
  name: string;
  description: string;
  isCustom?: boolean;
  categories?: string[];
  themeColors?: {
    primary?: string;
    accent?: string;
    background?: string;
  };
}

export interface CreateCustomVerticalPayload {
  name: string;
  slug?: string;
  icon: string;
  description: string;
  categories?: string[];
  attributes?: Array<{
    name: string;
    code: string;
    type: 'select' | 'color' | 'button' | 'text';
    values: string[];
  }>;
  themeColors?: {
    primary: string;
    accent: string;
    background: string;
  };
  bannerTitle?: string;
  bannerSubtitle?: string;
}

export const PLATFORM_BUSINESS_VERTICALS: VerticalOption[] = [
  { id: 'TECNOLOGIA_ELECTRONICA', icon: '💻', name: 'Tecnología & Electrónica', description: 'Smartphones, notebooks, periféricos, gaming y electrodomésticos.' },
  { id: 'INDUMENTARIA_CALZADO', icon: '👗', name: 'Indumentaria & Calzado', description: 'Ropa urbana, calzado deportivo, camperas y accesorios con variantes.' },
  { id: 'GASTRONOMIA_RESTAURANTE', icon: '🍔', name: 'Gastronomía & Restaurante', description: 'Platos gourmet, hamburgueserías, cafetería de especialidad y pastelería.' },
  { id: 'HOGAR_MUEBLES_DECO', icon: '🛋️', name: 'Hogar & Decoración', description: 'Muebles de madera, iluminación, textiles y objetos de diseño.' },
  { id: 'BELLEZA_COSMETICA', icon: '💄', name: 'Belleza & Cosmética', description: 'Skincare, maquillaje, cuidado capilar y perfumería.' },
  { id: 'FARMACIA_SALUD', icon: '💊', name: 'Farmacia & Salud', description: 'Suplementos nutricionales, primeros auxilios y cuidado médico preventivo.' },
  { id: 'SUPERMERCADO_ALMACEN', icon: '🛒', name: 'Supermercado & Almacén', description: 'Alimentos secos, bebidas, frescos y productos de limpieza.' },
  { id: 'FERRETERIA_CONSTRUCCION', icon: '🔨', name: 'Ferretería & Construcción', description: 'Herramientas eléctricas y manuales, fijaciones y pintura.' },
  { id: 'DEPORTES_FITNESS', icon: '🏋️', name: 'Deportes & Fitness', description: 'Equipamiento de entrenamiento, mancuernas, indumentaria deportiva y running.' },
  { id: 'AUTOMOTRIZ_REPUESTOS', icon: '🚗', name: 'Automotriz & Repuestos', description: 'Lubricantes, baterías, filtros y accesorios vehiculares.' },
  { id: 'PET_SHOP_VETERINARIA', icon: '🐾', name: 'Pet Shop & Veterinaria', description: 'Alimentos premium, juguetes, camas y accesorios para mascotas.' },
  { id: 'JOYERIA_RELOJERIA', icon: '💎', name: 'Joyería & Relojería', description: 'Anillos de plata 925, oro, relojes automáticos y accesorios finos.' },
  { id: 'LIBRERIA_PAPELERIA', icon: '📚', name: 'Librería & Papelería', description: 'Libros, cuadernos artesanales, útiles escolares y artística.' },
  { id: 'JUGUETERIA_BEBES', icon: '🧸', name: 'Juguetería & Bebés', description: 'Juguetes didácticos de madera, primera infancia y juegos de mesa.' },
  { id: 'VINOTECA_LICORERIA', icon: '🍷', name: 'Vinoteca & Licorería', description: 'Vinos de autor, espumantes, destilados premium y gins artesanales.' },
  { id: 'OPTICA_ACCESORIOS', icon: '👓', name: 'Óptica & Accesorios', description: 'Armazones recetados, anteojos de sol polarizados y lentes.' },
  { id: 'INSTRUMENTOS_MUSICALES', icon: '🎸', name: 'Instrumentos Musicales', description: 'Guitarras, teclados sintetizadores y audio profesional.' },
  { id: 'VIVEROS_JARDINERIA', icon: '🌿', name: 'Viveros & Jardinería', description: 'Plantas de interior, suculentas, macetas de diseño y sustratos.' },
  { id: 'DIETETICA_NATURISTA', icon: '🥑', name: 'Dietética & Naturista', description: 'Frutos secos, harinas integrales, semillas y productos sin TACC.' },
  { id: 'BIJOUTERIE_ACCESORIOS', icon: '👜', name: 'Bijouterie & Accesorios', description: 'Carteras de cuero, mochilas urbanas, billeteras y marroquinería.' },
  { id: 'IMPRENTA_MERCHANDISING', icon: '🖨️', name: 'Imprenta & Merchandising', description: 'Impresión digital, gigantografías, remeras personalizadas y packaging.' },
];
