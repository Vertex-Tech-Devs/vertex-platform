import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./helpers', () => ({
  ALLOWED_ORIGINS: [],
  PLATFORM_PROJECT: 'vertex-platform-dev',
  getOwnerOAuthClient: vi.fn(),
  getPlatformServiceAccountOAuthClient: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock('./shard-readiness', () => ({
  getMasterOAuthClientId: vi.fn(() => 'mock-client-id.apps.googleusercontent.com'),
}));

vi.mock('./runtime', () => ({
  resolvePlatformEnvironment: vi.fn(() => 'development'),
}));

import {
  evaluateShardReadiness,
  verifyOAuthRedirectUrl,
  CANONICAL_SHARD_APIS,
} from './shard-validator';
import { getOwnerOAuthClient, apiFetch } from './helpers';
import type { StoreShard } from './types';

describe('verifyOAuthRedirectUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna true si la redirección comienza con redirectUri', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: {
        get: (h: string) =>
          h === 'location' ? 'https://my-shard.firebaseapp.com/__/auth/handler?code=123' : null,
      },
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await verifyOAuthRedirectUrl(
      'client-id',
      'https://my-shard.firebaseapp.com/__/auth/handler',
    );
    expect(ok).toBe(true);
  });

  it('retorna false si la redirección contiene error de oauth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: {
        get: (h: string) =>
          h === 'location'
            ? 'https://accounts.google.com/signin/oauth/error?issue=redirect_uri_mismatch'
            : null,
      },
      text: vi.fn().mockResolvedValue('redirect_uri_mismatch'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await verifyOAuthRedirectUrl(
      'client-id',
      'https://my-shard.firebaseapp.com/__/auth/handler',
    );
    expect(ok).toBe(false);
  });

  it('retorna false si fetch arroja una excepción', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const ok = await verifyOAuthRedirectUrl(
      'client-id',
      'https://my-shard.firebaseapp.com/__/auth/handler',
    );
    expect(ok).toBe(false);
  });
});

describe('evaluateShardReadiness', () => {
  const mockAuth = { token: 'mock-token' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOwnerOAuthClient).mockResolvedValue(mockAuth as any);
  });

  function makeShard(overrides: Partial<StoreShard> = {}): StoreShard {
    return {
      id: 'shard-development-vtx-sd-test01',
      environment: 'development',
      runtimeMode: 'shared-shard',
      projectId: 'vtx-sd-test01',
      siteId: 'default',
      region: 'us-central1',
      status: 'WARMUP_READY',
      maxCapacity: 35,
      currentStores: 0,
      reservedStores: 0,
      billingAccountId: '016AC2-299E39-51C8BF',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it('retorna DECOMMISSIONED si el shard no tiene projectId', async () => {
    const shard = makeShard({ projectId: '' });
    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(false);
    expect(result.recommendedStatus).toBe('DECOMMISSIONED');
    expect(result.missingSteps).toContain('projectId_missing');
  });

  it('retorna DECOMMISSIONED si el proyecto GCP no existe (404/PERMISSION_DENIED)', async () => {
    const shard = makeShard();
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('404 NOT_FOUND: Project not found'));

    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(false);
    expect(result.recommendedStatus).toBe('DECOMMISSIONED');
    expect(result.missingSteps).toContain('gcp_project_inaccessible');
    expect(result.checklist.gcpProjectAccessible).toBe(false);
  });

  it('evalúa shard 100% configurado con currentStores=0 y recomienda WARMUP_READY', async () => {
    const shard = makeShard({ status: 'PARTIALLY_CONFIGURED', currentStores: 0 });

    vi.mocked(apiFetch).mockImplementation(async (_auth, url: string) => {
      if (url.includes('cloudresourcemanager.googleapis.com/v1/projects')) {
        return { projectNumber: '12345', lifecycleState: 'ACTIVE' };
      }
      if (url.includes('serviceusage.googleapis.com/v1/projects')) {
        return {
          services: CANONICAL_SHARD_APIS.map((api) => ({ name: `projects/123/services/${api}` })),
        };
      }
      if (url.includes(':getIamPolicy')) {
        return {
          bindings: [
            {
              role: 'roles/editor',
              members: ['serviceAccount:vertex-platform-dev@appspot.gserviceaccount.com'],
            },
          ],
        };
      }
      if (url.includes('identitytoolkit.googleapis.com/v2/projects')) {
        return {
          authorizedDomains: [
            'localhost',
            'vtx-sd-test01.firebaseapp.com',
            'vtx-sd-test01.web.app',
          ],
        };
      }
      if (url.includes('firestore.googleapis.com/v1/projects')) {
        return { name: 'projects/vtx-sd-test01/databases/(default)', type: 'FIRESTORE_NATIVE' };
      }
      return {};
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: {
          get: (h: string) =>
            h === 'location'
              ? 'https://vtx-sd-test01.firebaseapp.com/__/auth/handler?code=xyz'
              : null,
        },
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(true);
    expect(result.recommendedStatus).toBe('WARMUP_READY');
    expect(result.checklist.gcpProjectAccessible).toBe(true);
    expect(result.checklist.canonicalApisReady).toBe(true);
    expect(result.checklist.iamRolesBound).toBe(true);
    expect(result.checklist.oauthRedirectConfigured).toBe(true);
    expect(result.checklist.authDomainsWhitelisted).toBe(true);
    expect(result.checklist.firestoreReady).toBe(true);
    expect(result.missingSteps).toEqual([]);
    expect(result.fixes).toEqual([]);
  });

  it('evalúa shard 100% configurado con currentStores > 0 y recomienda ACTIVE', async () => {
    const shard = makeShard({ status: 'PARTIALLY_CONFIGURED', currentStores: 5 });

    vi.mocked(apiFetch).mockImplementation(async (_auth, url: string) => {
      if (url.includes('cloudresourcemanager.googleapis.com/v1/projects')) {
        return { projectNumber: '12345', lifecycleState: 'ACTIVE' };
      }
      if (url.includes('serviceusage.googleapis.com/v1/projects')) {
        return {
          services: CANONICAL_SHARD_APIS.map((api) => ({ name: `projects/123/services/${api}` })),
        };
      }
      if (url.includes(':getIamPolicy')) {
        return {
          bindings: [
            {
              role: 'roles/editor',
              members: ['serviceAccount:vertex-platform-dev@appspot.gserviceaccount.com'],
            },
          ],
        };
      }
      if (url.includes('identitytoolkit.googleapis.com/v2/projects')) {
        return {
          authorizedDomains: [
            'localhost',
            'vtx-sd-test01.firebaseapp.com',
            'vtx-sd-test01.web.app',
          ],
        };
      }
      if (url.includes('firestore.googleapis.com/v1/projects')) {
        return { name: 'projects/vtx-sd-test01/databases/(default)', type: 'FIRESTORE_NATIVE' };
      }
      return {};
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: {
          get: (h: string) =>
            h === 'location'
              ? 'https://vtx-sd-test01.firebaseapp.com/__/auth/handler?code=xyz'
              : null,
        },
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(true);
    expect(result.recommendedStatus).toBe('ACTIVE');
  });

  it('marca PARTIALLY_CONFIGURED cuando solo falta el redirect URI de OAuth', async () => {
    const shard = makeShard({ status: 'ACTIVE', currentStores: 1 });

    vi.mocked(apiFetch).mockImplementation(async (_auth, url: string) => {
      if (url.includes('cloudresourcemanager.googleapis.com/v1/projects')) {
        return { projectNumber: '12345', lifecycleState: 'ACTIVE' };
      }
      if (url.includes('serviceusage.googleapis.com/v1/projects')) {
        return {
          services: CANONICAL_SHARD_APIS.map((api) => ({ name: `projects/123/services/${api}` })),
        };
      }
      if (url.includes(':getIamPolicy')) {
        return {
          bindings: [
            {
              role: 'roles/editor',
              members: ['serviceAccount:vertex-platform-dev@appspot.gserviceaccount.com'],
            },
          ],
        };
      }
      if (url.includes('identitytoolkit.googleapis.com/v2/projects')) {
        return {
          authorizedDomains: [
            'localhost',
            'vtx-sd-test01.firebaseapp.com',
            'vtx-sd-test01.web.app',
          ],
        };
      }
      if (url.includes('firestore.googleapis.com/v1/projects')) {
        return { name: 'projects/vtx-sd-test01/databases/(default)', type: 'FIRESTORE_NATIVE' };
      }
      return {};
    });

    // Simula fallo en OAuth redirect
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: {
          get: (h: string) =>
            h === 'location'
              ? 'https://accounts.google.com/signin/oauth/error?error=redirect_uri_mismatch'
              : null,
        },
        text: vi.fn().mockResolvedValue('redirect_uri_mismatch'),
      }),
    );

    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(false);
    expect(result.recommendedStatus).toBe('PARTIALLY_CONFIGURED');
    expect(result.checklist.oauthRedirectConfigured).toBe(false);
    expect(result.checklist.gcpProjectAccessible).toBe(true);
    expect(result.checklist.canonicalApisReady).toBe(true);
    expect(result.missingSteps).toContain('oauth_redirect_missing');
    expect(result.fixes.some((f) => f.includes('Authorized Redirect URI'))).toBe(true);
  });

  it('detecta APIs canónicas faltantes y genera fixes detallados', async () => {
    const shard = makeShard();

    vi.mocked(apiFetch).mockImplementation(async (_auth, url: string) => {
      if (url.includes('cloudresourcemanager.googleapis.com/v1/projects')) {
        return { projectNumber: '12345', lifecycleState: 'ACTIVE' };
      }
      if (url.includes('serviceusage.googleapis.com/v1/projects')) {
        return {
          services: [
            { name: 'projects/123/services/cloudresourcemanager.googleapis.com' },
            // Faltan el resto
          ],
        };
      }
      return {};
    });

    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(false);
    expect(result.checklist.canonicalApisReady).toBe(false);
    expect(result.missingSteps).toContain('canonical_apis_missing');
    expect(result.fixes.some((f) => f.includes('gcloud services enable'))).toBe(true);
  });

  it('detecta roles IAM faltantes para la Service Account', async () => {
    const shard = makeShard();

    vi.mocked(apiFetch).mockImplementation(async (_auth, url: string) => {
      if (url.includes('cloudresourcemanager.googleapis.com/v1/projects')) {
        return { projectNumber: '12345', lifecycleState: 'ACTIVE' };
      }
      if (url.includes('serviceusage.googleapis.com/v1/projects')) {
        return {
          services: CANONICAL_SHARD_APIS.map((api) => ({ name: `projects/123/services/${api}` })),
        };
      }
      if (url.includes(':getIamPolicy')) {
        return {
          bindings: [
            {
              role: 'roles/viewer', // Rol insuficiente
              members: ['serviceAccount:vertex-platform-dev@appspot.gserviceaccount.com'],
            },
          ],
        };
      }
      return {};
    });

    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(false);
    expect(result.checklist.iamRolesBound).toBe(false);
    expect(result.missingSteps).toContain('iam_roles_missing');
  });

  it('detecta dominios autorizados de Identity Toolkit faltantes', async () => {
    const shard = makeShard();

    vi.mocked(apiFetch).mockImplementation(async (_auth, url: string) => {
      if (url.includes('cloudresourcemanager.googleapis.com/v1/projects')) {
        return { projectNumber: '12345', lifecycleState: 'ACTIVE' };
      }
      if (url.includes('serviceusage.googleapis.com/v1/projects')) {
        return {
          services: CANONICAL_SHARD_APIS.map((api) => ({ name: `projects/123/services/${api}` })),
        };
      }
      if (url.includes(':getIamPolicy')) {
        return {
          bindings: [
            {
              role: 'roles/editor',
              members: ['serviceAccount:vertex-platform-dev@appspot.gserviceaccount.com'],
            },
          ],
        };
      }
      if (url.includes('identitytoolkit.googleapis.com/v2/projects')) {
        return {
          authorizedDomains: ['localhost'], // Faltan los dominios firebaseapp.com y web.app
        };
      }
      return {};
    });

    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(false);
    expect(result.checklist.authDomainsWhitelisted).toBe(false);
    expect(result.missingSteps).toContain('auth_domains_missing');
  });

  it('detecta Firestore no inicializado o en DATASTORE_MODE', async () => {
    const shard = makeShard();

    vi.mocked(apiFetch).mockImplementation(async (_auth, url: string) => {
      if (url.includes('cloudresourcemanager.googleapis.com/v1/projects')) {
        return { projectNumber: '12345', lifecycleState: 'ACTIVE' };
      }
      if (url.includes('serviceusage.googleapis.com/v1/projects')) {
        return {
          services: CANONICAL_SHARD_APIS.map((api) => ({ name: `projects/123/services/${api}` })),
        };
      }
      if (url.includes(':getIamPolicy')) {
        return {
          bindings: [
            {
              role: 'roles/editor',
              members: ['serviceAccount:vertex-platform-dev@appspot.gserviceaccount.com'],
            },
          ],
        };
      }
      if (url.includes('identitytoolkit.googleapis.com/v2/projects')) {
        return {
          authorizedDomains: [
            'localhost',
            'vtx-sd-test01.firebaseapp.com',
            'vtx-sd-test01.web.app',
          ],
        };
      }
      if (url.includes('firestore.googleapis.com/v1/projects')) {
        return { name: 'projects/vtx-sd-test01/databases/(default)', type: 'DATASTORE_MODE' };
      }
      return {};
    });

    const result = await evaluateShardReadiness(shard);

    expect(result.isReady).toBe(false);
    expect(result.checklist.firestoreReady).toBe(false);
    expect(result.missingSteps).toContain('firestore_datastore_mode');
  });
});
