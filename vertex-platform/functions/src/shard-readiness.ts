import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ALLOWED_ORIGINS, PLATFORM_PROJECT } from './helpers';
import { resolvePlatformEnvironment } from './runtime';
import { checkRateLimit, logAuditAction } from './stores';
import type { StoreShard } from './types';

/**
 * getShardReadiness — Estado de "listo para recibir tiendas" de cada shard del pool.
 *
 * Un shard está LISTO cuando puede recibir tiendas nuevas sin configuración:
 *   1. status es WARMUP_READY o ACTIVE (no WARMUP_PROVISIONING / FULL).
 *   2. tiene billingAccountId asociado (billing vinculado).
 *   3. su redirect URI está registrado en el client OAuth master (el login Google
 *      de la primera tienda lo requiere — paso manual, verificado en vivo).
 *
 * El check del redirect URI se cachea en memoria (1h) y se persiste en el doc del
 * shard (redirectUriStatus / redirectUriCheckedAt) para sobrevivir cold starts sin
 * hacer N llamadas lentas a accounts.google.com en cada load del panel.
 */

const REDIRECT_URI_TTL_MS = 60 * 60 * 1000; // 1h

const MASTER_CLIENT_ID = '988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com';

const inMemoryCache = new Map<string, { ok: boolean; at: number }>();

export type ShardReadinessReason = 'status' | 'billing' | 'redirect_uri';

export interface ShardReadiness {
  id: string;
  projectId: string;
  status: StoreShard['status'];
  billingAccountId: string;
  redirectUri: string;
  ready: boolean;
  missing: ShardReadinessReason[];
  checkedAt: string;
}

async function verifyRedirectUri(clientId: string, redirectUri: string): Promise<boolean> {
  try {
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=openid%20email%20profile&prompt=select_account`;
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const location = res.headers.get('location') ?? '';
    // Éxito → redirige al redirect_uri registrado (con ?code=...).
    if (location.startsWith(redirectUri)) return true;
    // Fallo inequívoco: redirect a la página de error de OAuth.
    if (location.includes('/signin/oauth/error') || location.includes('error=')) return false;
    // Sin sesión Google puede responder 200 (consentimiento) sin Location, o 302 a
    // un interstitial de login: leer el body para detectar redirect_uri_mismatch.
    const body = await res.text();
    const hasErrorPage =
      body.includes('redirect_uri_mismatch') ||
      body.includes('signin/oauth/error') ||
      (body.includes('Error 400') && body.includes('redirect_uri'));
    return !hasErrorPage;
  } catch {
    return false;
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function checkShardReadiness(
  db: FirebaseFirestore.Firestore,
  shard: StoreShard & { id: string },
): Promise<ShardReadiness> {
  const missing: ShardReadinessReason[] = [];
  const checkedAt = new Date();

  if (shard.status !== 'WARMUP_READY' && shard.status !== 'ACTIVE') {
    missing.push('status');
  }

  const billingAccountId = String(shard.billingAccountId ?? '').trim();
  if (!billingAccountId) {
    missing.push('billing');
  }

  let redirectUri = '';
  if (shard.projectId) {
    redirectUri = `https://${shard.projectId}.firebaseapp.com/__/auth/handler`;
  }

  let redirectOk = false;
  if (redirectUri) {
    const cached = inMemoryCache.get(redirectUri);
    const cachedFresh = cached !== undefined && Date.now() - cached.at < REDIRECT_URI_TTL_MS;
    const persistedStatus = shard['redirectUriStatus'] as string | undefined;
    const persistedAt = toDate(shard['redirectUriCheckedAt']);
    const persistedFresh =
      persistedAt !== null && Date.now() - persistedAt.getTime() < REDIRECT_URI_TTL_MS;

    if (cachedFresh) {
      redirectOk = cached.ok;
    } else if (persistedFresh) {
      redirectOk = persistedStatus === 'registered';
    } else {
      redirectOk = await verifyRedirectUri(MASTER_CLIENT_ID, redirectUri);
      inMemoryCache.set(redirectUri, { ok: redirectOk, at: Date.now() });
      // Persistir para evitar re-verificar en cada cold start del panel.
      try {
        await db
          .collection('infrastructure_shards')
          .doc(shard.id)
          .update({
            redirectUriStatus: redirectOk ? 'registered' : 'missing',
            redirectUriCheckedAt: checkedAt,
          });
      } catch {
        /* best-effort: si falla la persistencia, el cache en memoria alcanza */
      }
    }
    if (!redirectOk) {
      missing.push('redirect_uri');
    }
  }

  return {
    id: shard.id,
    projectId: shard.projectId ?? '',
    status: shard.status,
    billingAccountId,
    redirectUri,
    ready: missing.length === 0,
    missing,
    checkedAt: checkedAt.toISOString(),
  };
}

export const getShardReadiness = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError(
        'permission-denied',
        'Only platform admins can inspect shard readiness.',
      );
    }
    await checkRateLimit(request.auth.uid, 'getShardReadiness', 30, 5);

    const db = getFirestore();
    const env = resolvePlatformEnvironment(PLATFORM_PROJECT);

    const snap = await db.collection('infrastructure_shards').where('environment', '==', env).get();

    const shards = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as StoreShard & { id: string })
      .filter((shard) => shard.runtimeMode === 'shared-shard');

    const results = await Promise.all(shards.map((shard) => checkShardReadiness(db, shard)));

    results.sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? 1 : -1;
      return a.id.localeCompare(b.id);
    });

    // Escribir el audit log para que checkRateLimit tenga un contador real
    // (el rate limit cuenta entradas de auditLog con la misma action).
    const readyCount = results.filter((r) => r.ready).length;
    await logAuditAction(
      request.auth.uid,
      request.auth.token.email,
      'getShardReadiness',
      'pool',
      'success',
      { total: results.length, readyCount },
    );

    return {
      environment: env,
      total: results.length,
      readyCount,
      checkedAt: new Date().toISOString(),
      shards: results,
    };
  },
);
