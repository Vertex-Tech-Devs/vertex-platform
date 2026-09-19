/**
 * Capacidad real de un shard medida en SITIOS de Firebase Hosting.
 * Cada dominio `.web.app` (principal, alias o leftover) consume 1 de los
 * 36 sitios por proyecto, por lo que contar tiendas subestima el uso.
 */
import type { OAuth2Client } from 'google-auth-library';

const HOSTING_API = 'https://firebasehosting.googleapis.com/v1beta1';

/** Límite de Firebase Hosting por proyecto (incluye el sitio DEFAULT del proyecto). */
export const HOSTING_SITE_LIMIT = 36;
/** Umbral de aviso temprano (85%). */
export const HOSTING_SITE_ALERT_RATIO = 0.85;
/** Umbral de alerta temprana: 31 sitios (85% de 36). */
export const HOSTING_SITE_ALERT_THRESHOLD = Math.ceil(
  HOSTING_SITE_LIMIT * HOSTING_SITE_ALERT_RATIO,
);

const CACHE_TTL_MS = 60_000;
const sitesCache = new Map<string, { count: number; at: number }>();

/** Devuelve la cantidad de sitios (incluye el DEFAULT_SITE) o `null` si no se pudo medir. */
export async function countHostingSites(
  auth: OAuth2Client,
  projectId: string,
): Promise<number | null> {
  if (!projectId) return null;
  const cached = sitesCache.get(projectId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.count;
  try {
    const token = (await auth.getAccessToken()).token;
    const res = await fetch(`${HOSTING_API}/projects/${projectId}/sites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { sites?: unknown[] };
    const count = Array.isArray(body.sites) ? body.sites.length : 0;
    sitesCache.set(projectId, { count, at: Date.now() });
    return count;
  } catch {
    return null;
  }
}

/** True si el shard ya no tiene cupo real para un sitio adicional. */
export async function isShardSiteCapacityFull(
  auth: OAuth2Client,
  projectId: string,
  currentStores: number,
  maxStores: number,
): Promise<{ full: boolean; sitesUsed: number | null }> {
  const sitesUsed = await countHostingSites(auth, projectId);
  if (sitesUsed === null) {
    // Sin medición: fallback conservador al conteo de tiendas.
    return { full: currentStores >= maxStores, sitesUsed: null };
  }
  // Capacidad para tiendas = sitios totales - 1 (sitio DEFAULT del proyecto).
  const usable = Math.max(0, HOSTING_SITE_LIMIT - 1);
  return { full: sitesUsed - 1 >= usable, sitesUsed };
}
