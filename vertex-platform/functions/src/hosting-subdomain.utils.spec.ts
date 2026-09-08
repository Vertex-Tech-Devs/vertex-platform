import { describe, expect, it } from 'vitest';
import {
  sanitizeSubdomainCandidate,
  buildSubdomainSuggestions,
  isSubdomainLengthValid,
} from './hosting-subdomain.utils';

describe('subdomain utils', () => {
  it('sanitiza tildes, ñ, mayúsculas y caracteres extraños', () => {
    expect(sanitizeSubdomainCandidate('Mi Tienda Á é ñ ño')).toBe('mi-tienda-a-e-n-no');
  });

  it('elimina guiones consecutivos y extremos', () => {
    expect(sanitizeSubdomainCandidate('--midominio--')).toBe('midominio');
    expect(sanitizeSubdomainCandidate('a---bcde')).toBe('a-bcde');
  });

  it('respeta el largo máximo de 30 y rechaza menores a 4', () => {
    expect(sanitizeSubdomainCandidate('ab')).toBe('');
    expect(sanitizeSubdomainCandidate('x'.repeat(50)).length).toBe(30);
  });

  it('genera 3 sugerencias limpias y distintas', () => {
    const s = sanitizeSubdomainCandidate('vidrios emilia');
    expect(s).toBe('vidrios-emilia');
    const suggestions = buildSubdomainSuggestions(s);
    expect(suggestions).toEqual(['vidrios-emilia-ok', 'vtx-vidrios-emilia', 'vidrios-emilia-shop']);
  });

  it('valida longitud para Firebase Hosting', () => {
    expect(isSubdomainLengthValid('vidrios')).toBe(true);
    expect(isSubdomainLengthValid('ab')).toBe(false);
  });
});
