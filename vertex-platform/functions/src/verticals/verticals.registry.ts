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
  if (normalized.includes('INDUMENTARIA') || normalized.includes('ROPA') || normalized.includes('MODA')) {
    return 'INDUMENTARIA_CALZADO';
  }
  if (normalized.includes('GASTRO') || normalized.includes('REST') || normalized.includes('CAF')) {
    return 'GASTRONOMIA_RESTAURANTE';
  }
  if (normalized.includes('HOGAR') || normalized.includes('MUEBLE') || normalized.includes('DECO')) {
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

export function getBusinessVerticalPreset(id: string): BusinessVerticalDefinition {
  const resolvedId = resolveVerticalKey(id);
  return PRESETS_MAP[resolvedId] ?? TECNOLOGIA_ELECTRONICA_PRESET;
}

export function getAllBusinessVerticalsSummary(): BusinessVerticalSummary[] {
  return Object.values(PRESETS_MAP).map((preset) => ({
    id: preset.id,
    name: preset.name,
    icon: preset.icon,
    description: preset.description,
  }));
}
