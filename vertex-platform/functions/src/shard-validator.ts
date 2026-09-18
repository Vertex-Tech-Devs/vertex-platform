import type { StoreShard, ShardReadinessChecklist } from './types';
import {
  PLATFORM_PROJECT,
  getOwnerOAuthClient,
  getPlatformServiceAccountOAuthClient,
  apiFetch,
} from './helpers';
import { getMasterOAuthClientId } from './shard-readiness';
import { resolvePlatformEnvironment } from './runtime';

export const CANONICAL_SHARD_APIS = [
  'cloudresourcemanager.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebase.googleapis.com',
  'firestore.googleapis.com',
  'secretmanager.googleapis.com',
  'cloudbuild.googleapis.com',
  'iam.googleapis.com',
];

export const REQUIRED_IAM_ROLES = [
  'roles/secretmanager.admin',
  'roles/secretmanager.secretAccessor',
  'roles/datastore.owner',
  'roles/firebase.admin',
  'roles/iam.serviceAccountUser',
  'roles/editor',
];

export interface ShardEvaluationResult {
  isReady: boolean;
  checklist: ShardReadinessChecklist;
  missingSteps: string[];
  fixes: string[];
  recommendedStatus: StoreShard['status'];
  errorReason?: string;
}

export async function verifyOAuthRedirectUrl(
  clientId: string,
  redirectUri: string,
): Promise<boolean> {
  try {
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=openid%20email%20profile&prompt=select_account`;
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const location = res.headers.get('location') ?? '';
    if (location.startsWith(redirectUri)) return true;
    if (location.includes('/signin/oauth/error') || location.includes('error=')) return false;
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

/**
 * Valida de forma exhaustiva los 6 pilares de preparación de un shard:
 * 1. GCP Project accesible vía Cloud Resource Manager
 * 2. APIs Canónicas (7 APIs clave habilitadas)
 * 3. Roles IAM (Service Account de plataforma con bindings requeridos)
 * 4. OAuth Redirect Handler registrado en Web Client OAuth
 * 5. Auth Domains autorizados en Identity Toolkit
 * 6. Firestore DB (default) operativa
 */
export async function evaluateShardReadiness(shard: StoreShard): Promise<ShardEvaluationResult> {
  const projectId =
    shard.projectId || (shard as unknown as { gcpProjectId?: string }).gcpProjectId || '';
  const env = shard.environment || resolvePlatformEnvironment(PLATFORM_PROJECT);
  const checklist: ShardReadinessChecklist = {
    gcpProjectAccessible: false,
    canonicalApisReady: false,
    iamRolesBound: false,
    oauthRedirectConfigured: false,
    authDomainsWhitelisted: false,
    firestoreReady: false,
  };
  const missingSteps: string[] = [];
  const fixes: string[] = [];

  if (!projectId) {
    missingSteps.push('projectId_missing');
    fixes.push('El shard no tiene projectId asignado en Firestore.');
    return {
      isReady: false,
      checklist,
      missingSteps,
      fixes,
      recommendedStatus: 'DECOMMISSIONED',
      errorReason: 'No projectId configured for shard',
    };
  }

  let auth;
  try {
    auth = await getOwnerOAuthClient();
  } catch {
    try {
      auth = await getPlatformServiceAccountOAuthClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      missingSteps.push('auth_client_failed');
      fixes.push(`No se pudieron obtener credenciales para autenticar con GCP: ${msg}`);
      return {
        isReady: false,
        checklist,
        missingSteps,
        fixes,
        recommendedStatus: 'PARTIALLY_CONFIGURED',
        errorReason: msg,
      };
    }
  }

  // 1. GCP Project Accessible Check
  try {
    const res = (await apiFetch(
      auth,
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
    )) as { projectNumber?: string; lifecycleState?: string } | undefined;
    if (res && res.lifecycleState !== 'DELETE_REQUESTED') {
      checklist.gcpProjectAccessible = true;
    } else {
      missingSteps.push('gcp_project_deleted');
      fixes.push(
        `El proyecto GCP ${projectId} se encuentra en estado DELETE_REQUESTED o inaccesible.`,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNotFoundOrDenied =
      msg.includes('403') ||
      msg.includes('404') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('RESOURCES_NOT_FOUND') ||
      msg.includes('not found');
    missingSteps.push('gcp_project_inaccessible');
    fixes.push(
      `El proyecto GCP ${projectId} no existe o no tiene permisos de acceso (${msg.slice(0, 120)}).`,
    );
    if (isNotFoundOrDenied) {
      return {
        isReady: false,
        checklist,
        missingSteps,
        fixes,
        recommendedStatus: 'DECOMMISSIONED',
        errorReason: msg,
      };
    }
  }

  // 2. Canonical APIs Check
  try {
    const serviceSnap = (await apiFetch(
      auth,
      `https://serviceusage.googleapis.com/v1/projects/${projectId}/services?filter=state:ENABLED&pageSize=100`,
    )) as { services?: Array<{ config?: { name?: string }; name?: string }> } | undefined;

    const enabledServices = new Set<string>();
    (serviceSnap?.services || []).forEach((s) => {
      const name = s.config?.name || s.name?.split('/').pop();
      if (name) enabledServices.add(name);
    });

    const missingApis = CANONICAL_SHARD_APIS.filter((api) => !enabledServices.has(api));
    if (missingApis.length === 0) {
      checklist.canonicalApisReady = true;
    } else {
      missingSteps.push('canonical_apis_missing');
      fixes.push(
        `Habilitar APIs faltantes en ${projectId}: ${missingApis.join(', ')}. Ejecutar: gcloud services enable ${missingApis.join(' ')} --project ${projectId}`,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    missingSteps.push('canonical_apis_check_failed');
    fixes.push(`No se pudo verificar el estado de las APIs en ${projectId}: ${msg.slice(0, 100)}`);
  }

  // 3. IAM Roles Check
  try {
    const crm = `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`;
    const policy = (await apiFetch(auth, `${crm}:getIamPolicy`, {
      method: 'POST',
      body: {},
      quotaProject: projectId,
    })) as { bindings?: Array<{ role: string; members: string[] }> };

    const platformSA = `${PLATFORM_PROJECT}@appspot.gserviceaccount.com`;
    const saMember = `serviceAccount:${platformSA}`;
    const boundRoles = new Set(
      (policy.bindings || []).filter((b) => b.members?.includes(saMember)).map((b) => b.role),
    );

    const missingRoles = REQUIRED_IAM_ROLES.filter((r) => !boundRoles.has(r));
    if (
      missingRoles.length === 0 ||
      boundRoles.has('roles/owner') ||
      boundRoles.has('roles/editor')
    ) {
      checklist.iamRolesBound = true;
    } else {
      missingSteps.push('iam_roles_missing');
      fixes.push(
        `Asignar roles IAM faltantes a ${platformSA} en ${projectId}: ${missingRoles.join(', ')}.`,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    missingSteps.push('iam_roles_check_failed');
    fixes.push(`Error consultando política IAM de ${projectId}: ${msg.slice(0, 100)}`);
  }

  // 4. OAuth Redirect Handler Check
  const redirectUri = `https://${projectId}.firebaseapp.com/__/auth/handler`;
  const masterClientId = getMasterOAuthClientId(env);
  try {
    const isRedirectValid = await verifyOAuthRedirectUrl(masterClientId, redirectUri);
    if (isRedirectValid) {
      checklist.oauthRedirectConfigured = true;
    } else {
      missingSteps.push('oauth_redirect_missing');
      fixes.push(
        `Registrar el Authorized Redirect URI '${redirectUri}' en Google Cloud Console -> APIs y Servicios -> Credenciales -> Cliente OAuth 2.0 Web maestro.`,
      );
    }
  } catch {
    missingSteps.push('oauth_redirect_check_failed');
    fixes.push(`No se pudo validar el redirect URI ${redirectUri}`);
  }

  // 5. Auth Domains Whitelisted Check
  try {
    const url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
    const res = (await apiFetch(auth, url, { quotaProject: projectId })) as
      | {
          authorizedDomains?: string[];
        }
      | undefined;
    const currentDomains = new Set(res?.authorizedDomains || []);
    const requiredDomains = ['localhost', `${projectId}.firebaseapp.com`, `${projectId}.web.app`];
    const missingDomains = requiredDomains.filter((d) => !currentDomains.has(d));
    if (missingDomains.length === 0) {
      checklist.authDomainsWhitelisted = true;
    } else {
      missingSteps.push('auth_domains_missing');
      fixes.push(
        `Autorizar dominios en Identity Toolkit para ${projectId}: ${missingDomains.join(', ')}.`,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    missingSteps.push('auth_domains_check_failed');
    fixes.push(`Error comprobando dominios autorizados en Identity Toolkit: ${msg.slice(0, 100)}`);
  }

  // 6. Firestore Ready Check
  try {
    const dbUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
    const dbInfo = (await apiFetch(auth, dbUrl, { quotaProject: projectId })) as
      | {
          name?: string;
          type?: string;
        }
      | undefined;
    if (dbInfo && dbInfo.name && dbInfo.type !== 'DATASTORE_MODE') {
      checklist.firestoreReady = true;
    } else if (dbInfo?.type === 'DATASTORE_MODE') {
      missingSteps.push('firestore_datastore_mode');
      fixes.push(
        `La base de datos Firestore en ${projectId} está en DATASTORE_MODE en lugar de FIRESTORE_NATIVE.`,
      );
    } else {
      missingSteps.push('firestore_not_initialized');
      fixes.push(
        `Base de datos (default) de Firestore no encontrada en ${projectId}. Inicializar en modo NATIVE.`,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    missingSteps.push('firestore_check_failed');
    fixes.push(`Error al conectar con Firestore en ${projectId}: ${msg.slice(0, 100)}`);
  }

  const isReady =
    checklist.gcpProjectAccessible &&
    checklist.canonicalApisReady &&
    checklist.iamRolesBound &&
    checklist.oauthRedirectConfigured &&
    checklist.authDomainsWhitelisted &&
    checklist.firestoreReady;

  let recommendedStatus: StoreShard['status'] = shard.status;
  if (isReady) {
    if (shard.status === 'PARTIALLY_CONFIGURED' || shard.status === 'FULL') {
      recommendedStatus = (shard.currentStores || 0) > 0 ? 'ACTIVE' : 'WARMUP_READY';
    }
  } else {
    recommendedStatus = 'PARTIALLY_CONFIGURED';
  }

  return {
    isReady,
    checklist,
    missingSteps,
    fixes,
    recommendedStatus,
    errorReason: missingSteps.length > 0 ? missingSteps.join(', ') : undefined,
  };
}
