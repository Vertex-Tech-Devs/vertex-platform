import { describe, it, expect } from 'vitest';
import {
  getBusinessVerticalPreset,
  getAllBusinessVerticalsSummary,
  resolveVerticalKey,
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

  it('should return complete definition for TECNOLOGIA_ELECTRONICA', () => {
    const preset = getBusinessVerticalPreset('TECNOLOGIA_ELECTRONICA');
    expect(preset.name).toContain('Tecnología');
    expect(preset.categories.length).toBeGreaterThan(0);
    expect(preset.attributes.length).toBeGreaterThan(0);
    expect(preset.sampleProducts.length).toBeGreaterThan(0);
    expect(preset.sampleProducts[0].variants?.length).toBeGreaterThan(0);
  });
});
