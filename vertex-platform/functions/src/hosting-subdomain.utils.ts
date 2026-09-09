/**
 * Utils deterministas para la gestión de subdominios gratuitos `.web.app`.
 * Pura (sin I/O): sanitización del candidato y generación de alternativas limpias,
 * según las reglas de Firebase Hosting (a-z0-9-, sin guiones consecutivos/duplicados,
 * sin tildes/ñ/diéresis).
 */

/** Normaliza a base ASCII: tildes → base, ñ → n, diéresis → vocal. */
function stripDiacritics(value: string): string {
  const map: Record<string, string> = {
    á: 'a',
    é: 'e',
    í: 'i',
    ó: 'o',
    ú: 'u',
    ü: 'u',
    à: 'a',
    è: 'e',
    ì: 'i',
    ò: 'o',
    ù: 'u',
    â: 'a',
    ê: 'e',
    î: 'i',
    ô: 'o',
    û: 'u',
    ä: 'a',
    ë: 'e',
    ï: 'i',
    ö: 'o',
    ÿ: 'y',
    ñ: 'n',
    ç: 'c',
  };
  return value
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('');
}

export function sanitizeSubdomainCandidate(raw: string): string {
  const lowered = stripDiacritics(
    String(raw || '')
      .trim()
      .toLowerCase(),
  );
  // espacios/underscores/puntos -> guiones
  const spaced = lowered.replace(/[\s_.]+/g, '-');
  // solo a-z0-9 y guiones
  const filtered = spaced.replace(/[^a-z0-9-]/g, '');
  // sin guiones consecutivos
  const noDouble = filtered.replace(/-{2,}/g, '-');
  // sin guiones al inicio/fin
  const trimmed = noDouble.replace(/^-+|-+$/g, '');
  // longitud Firebase Hosting: entre 4 y 30
  const safe = trimmed.slice(0, 30);
  return safe.length >= 4 ? safe : '';
}

export function buildSubdomainSuggestions(sanitized: string): string[] {
  const base = sanitizeSubdomainCandidate(sanitized);
  if (!base) {
    return [];
  }
  const candidates = [`${base}-ok`, `vtx-${base}`, `${base}-shop`];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const s = sanitizeSubdomainCandidate(c);
    if (s && s !== sanitized && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export function isSubdomainLengthValid(candidate: string): boolean {
  const s = sanitizeSubdomainCandidate(candidate);
  return s.length >= 4 && s.length <= 30;
}

/** Palabras reservadas del sistema (no registrables salvo superadmin/plataforma). */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  'admin',
  'platform',
  'api',
  'billing',
  'auth',
  'support',
  'mail',
  'dev',
  'staging',
  'vertex',
];

/**
 * Normaliza el input libre de un subdominio `.web.app` a candidato limpio:
 * quita protocolo, `www.`, sufijos de hosting y el prefijo automático `vtx-`,
 * y luego aplica el sanitizador determinista existente.
 */
export function normalizeFreeSubdomain(raw: string): string {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .replace(/\.web\.app$/, '')
    .replace(/\.firebaseapp\.com$/, '')
    .replace(/^vtx-/, '');
  return sanitizeSubdomainCandidate(v);
}
