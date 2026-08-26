import { describe, it, expect } from 'vitest';
import {
  getAllBusinessVerticalsSummary,
  resolveVerticalKey,
  buildCustomVerticalDefinition,
  getBusinessVerticalPreset,
} from './verticals.registry';

describe('Verticals Registry', () => {
  it('should resolve aliases correctly', () => {
    expect(resolveVerticalKey('tecnologia')).toBe('TECNOLOGIA_ELECTRONICA');
    expect(resolveVerticalKey('indumentaria')).toBe('INDUMENTARIA_CALZADO');
    expect(resolveVerticalKey('ropa')).toBe('INDUMENTARIA_CALZADO');
    expect(resolveVerticalKey('gastro')).toBe('GASTRONOMIA_RESTAURANTE');
    expect(resolveVerticalKey('unknown_xyz')).toBe('TECNOLOGIA_ELECTRONICA');
    expect(resolveVerticalKey(undefined)).toBe('TECNOLOGIA_ELECTRONICA');
  });

  it('should return all 21 vertical summaries', () => {
    const summaries = getAllBusinessVerticalsSummary();
    expect(summaries.length).toBe(21);
    expect(summaries.some((s) => s.id === 'TECNOLOGIA_ELECTRONICA')).toBe(true);
    expect(summaries.some((s) => s.id === 'INDUMENTARIA_CALZADO')).toBe(true);
    expect(summaries.some((s) => s.id === 'IMPRENTA_MERCHANDISING')).toBe(true);
  });

  it('should build custom vertical definitions with at least 20 sample products', () => {
    const customDef = buildCustomVerticalDefinition({
      id: 'CERVECERIA_ARTESANAL',
      name: 'Cervecería Artesanal',
      icon: '🍺',
      description: 'Venta de cervezas artesanales y growlers',
      categories: ['IPAs', 'Stouts', 'Rubias'],
      attributes: [
        { name: 'Volumen', code: 'volumen', type: 'select', values: ['500ml', '1L', '1.9L'] },
      ],
    });

    expect(customDef.name).toBe('Cervecería Artesanal');
    expect(customDef.icon).toBe('🍺');
    expect(customDef.categories.length).toBe(3);
    expect(customDef.categories[0].name).toBe('IPAs');
    expect(customDef.attributes.length).toBe(1);
    expect(customDef.sampleProducts.length).toBeGreaterThanOrEqual(20);
  });

  it('should guarantee all 21 presets have at least 20 sample products with matching categories', () => {
    const summaries = getAllBusinessVerticalsSummary();
    for (const summary of summaries) {
      const preset = getBusinessVerticalPreset(summary.id);
      expect(preset, `Preset ${summary.id} should exist`).toBeDefined();
      expect(
        preset.sampleProducts.length,
        `Preset ${summary.id} must have >= 20 products, got ${preset.sampleProducts.length}`,
      ).toBeGreaterThanOrEqual(20);

      const catSlugs = new Set(preset.categories.map((c) => c.slug));
      for (const prod of preset.sampleProducts) {
        expect(
          catSlugs.has(prod.categorySlug),
          `Product "${prod.name}" in preset ${summary.id} has categorySlug "${prod.categorySlug}" which is not in [${Array.from(catSlugs).join(', ')}]`,
        ).toBe(true);
      }
    }
  });
});
