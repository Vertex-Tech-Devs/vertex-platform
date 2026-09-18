/**
 * Asegura que un dominio `*.web.app` quede autorizado en Firebase Auth
 * (Identity Toolkit `authorizedDomains`) para que el login con Google funcione
 * en sitios de Hosting no-default (multi-site por shard).
 */
import type { OAuth2Client } from 'google-auth-library';
import { apiFetch } from './helpers';

const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/admin/v2';

interface IdentityConfig {
  authorizedDomains?: string[];
}

/**
 * Agrega `domain` a `authorizedDomains` del proyecto si no está presente.
 * Idempotente y tolerante: nunca rompe el provisioning si la API falla
 * (loguea warning y sigue), salvo que se pida `strict`.
 */
export async function ensureAuthorizedDomain(
  auth: OAuth2Client,
  projectId: string,
  domain: string,
  opts: { strict?: boolean } = {},
): Promise<boolean> {
  const target = String(domain || '')
    .trim()
    .toLowerCase();
  if (!projectId || !target) return false;

  try {
    const url = `${IDENTITY_BASE}/projects/${projectId}/config`;
    const current = (await apiFetch(auth, url, { quotaProject: projectId })) as IdentityConfig;
    const domains = Array.isArray(current?.authorizedDomains) ? current.authorizedDomains : [];
    if (domains.map((d) => String(d).toLowerCase()).includes(target)) {
      return true;
    }
    await apiFetch(auth, `${url}?updateMask=authorizedDomains`, {
      method: 'PATCH',
      body: { authorizedDomains: [...domains, target] },
      quotaProject: projectId,
    });
    console.info(
      `[ensureAuthorizedDomain] Autorizado ${target} en Firebase Auth de ${projectId} (antes: ${domains.length} dominios)`,
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (opts.strict) {
      throw new Error(`No se pudo autorizar ${target} en Firebase Auth de ${projectId}: ${msg}`);
    }
    console.warn(`[ensureAuthorizedDomain] No se pudo autorizar ${target} en ${projectId}: ${msg}`);
    return false;
  }
}
