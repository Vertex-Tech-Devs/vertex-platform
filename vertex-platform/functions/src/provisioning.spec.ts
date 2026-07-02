import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing provisionStore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn(),
}));
vi.mock('./helpers', () => ({
  ALLOWED_ORIGINS: [],
  PLATFORM_PROJECT: 'vertex-platform-dev',
  pickBillingAccount: vi.fn().mockResolvedValue('billing-1'),
  listProvisioningOwnerCandidates: vi.fn().mockResolvedValue([
    {
      id: 'owner-1',
      client_id: 'client',
      client_secret: 'secret',
      refresh_token: 'refresh',
    },
  ]),
  getOwnerOAuthClient: vi.fn(),
  getGitHubPat: vi.fn(),
  apiFetch: vi.fn(),
  retry: vi.fn(),
  pollOperation: vi.fn(),
}));

import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const VALID_PAYLOAD = {
  name: 'Test Store',
  slug: 'my-store',
  ownerEmail: 'owner@test.com',
};

function makeRequest(data: Record<string, unknown>, isAdmin = true) {
  return {
    auth: isAdmin ? { token: { platformAdmin: true } } : { token: {} },
    data,
  };
}

function makeDb(slugExists = false, mockShards: any[] = []) {
  const docMock = {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ exists: false }),
  };
  return {
    collection: vi.fn((colName) => {
      if (colName === 'stores') {
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: !slugExists }),
          doc: vi.fn(() => docMock),
        };
      }
      if (colName === 'shards') {
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({
            empty: mockShards.length === 0,
            docs: mockShards.map((s) => ({
              id: s.id,
              data: () => s,
            })),
          }),
          doc: vi.fn(() => docMock),
        };
      }
      return {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true }),
        doc: vi.fn(() => docMock),
        add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
      };
    }),
  };
}

describe('provisionStore handler', () => {
  let handler: (req: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./provisioning');
    // provisionStore is exported as the handler function (after vi.mock of onCall)
    handler = mod.provisionStore as unknown as (req: unknown) => Promise<unknown>;
  });

  it('rejects non-admin callers', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as unknown as ReturnType<typeof getFirestore>);
    await expect(handler(makeRequest(VALID_PAYLOAD, false))).rejects.toThrow(HttpsError);
  });

  it('rejects missing required fields', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as unknown as ReturnType<typeof getFirestore>);
    await expect(handler(makeRequest({ ...VALID_PAYLOAD, name: '' }))).rejects.toThrow(HttpsError);
  });

  it('rejects invalid slug — too short', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as unknown as ReturnType<typeof getFirestore>);
    await expect(handler(makeRequest({ ...VALID_PAYLOAD, slug: 'ab' }))).rejects.toThrow(
      HttpsError,
    );
  });

  it('rejects invalid slug — uppercase', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as unknown as ReturnType<typeof getFirestore>);
    await expect(handler(makeRequest({ ...VALID_PAYLOAD, slug: 'MyStore' }))).rejects.toThrow(
      HttpsError,
    );
  });

  it('rejects invalid slug — starts with hyphen', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as unknown as ReturnType<typeof getFirestore>);
    await expect(handler(makeRequest({ ...VALID_PAYLOAD, slug: '-mystore' }))).rejects.toThrow(
      HttpsError,
    );
  });

  it('rejects duplicate slug', async () => {
    vi.mocked(getFirestore).mockReturnValue(
      makeDb(true) as unknown as ReturnType<typeof getFirestore>,
    );
    await expect(handler(makeRequest(VALID_PAYLOAD))).rejects.toThrow(HttpsError);
  });

  it('accepts valid slug — lowercase alphanumeric', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as unknown as ReturnType<typeof getFirestore>);
    const result = await handler(makeRequest({ ...VALID_PAYLOAD, slug: 'mystore123' }));
    expect(result).toHaveProperty('storeId');
    expect(result).toHaveProperty('projectId');
  });

  it('accepts valid slug — with hyphens', async () => {
    vi.mocked(getFirestore).mockReturnValue(makeDb() as unknown as ReturnType<typeof getFirestore>);
    const result = await handler(makeRequest({ ...VALID_PAYLOAD, slug: 'my-store-name' }));
    expect(result).toHaveProperty('storeId');
  });

  it('sets dedicated projectId as vtx-{slug} when dedicatedProject is true', async () => {
    const docMock = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ exists: false }),
    };
    const dbMock = {
      collection: vi.fn((colName) => {
        if (colName === 'stores') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
            doc: vi.fn(() => docMock),
            add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
          };
        }
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
          doc: vi.fn(() => docMock),
          add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
        };
      }),
    };
    vi.mocked(getFirestore).mockReturnValue(dbMock as unknown as ReturnType<typeof getFirestore>);

    const result = (await handler(makeRequest({ ...VALID_PAYLOAD, dedicatedProject: true }))) as {
      projectId: string;
    };
    expect(result.projectId).toBe('vtx-my-store');

    expect(docMock.set).toHaveBeenCalled();
    const savedData = docMock.set.mock.calls[0][0] as any;
    expect(savedData.runtimeMode).toBe('dedicated-project');
    expect(savedData.runtimeProjectId).toBe('vtx-my-store');
  });

  it('selects an active shard with available capacity if available', async () => {
    const docMock = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ exists: false }),
    };
    const mockShards = [
      {
        id: 'shard-dev-1',
        environment: 'development',
        runtimeMode: 'shared-shard',
        projectId: 'vtx-shard-project-1',
        siteId: 'default',
        status: 'active',
        maxStores: 100,
        activeStores: 10,
        reservedStores: 2,
      },
    ];
    const dbMock = {
      collection: vi.fn((colName) => {
        if (colName === 'stores') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
            doc: vi.fn(() => docMock),
            add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
          };
        }
        if (colName === 'shards') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: mockShards.map((s) => ({
                id: s.id,
                data: () => s,
              })),
            }),
            doc: vi.fn(() => docMock),
            add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
          };
        }
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
          doc: vi.fn(() => docMock),
          add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
        };
      }),
    };
    vi.mocked(getFirestore).mockReturnValue(dbMock as unknown as ReturnType<typeof getFirestore>);

    const result = (await handler(makeRequest(VALID_PAYLOAD))) as { projectId: string };
    expect(result.projectId).toBe('vtx-shard-project-1');

    expect(docMock.set).toHaveBeenCalled();
    const savedData = docMock.set.mock.calls[0][0] as any;
    expect(savedData.runtimeMode).toBe('shared-shard');
    expect(savedData.shardId).toBe('shard-dev-1');
  });

  it('autonomously generates a new shard if no active shards are available', async () => {
    const docMock = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ exists: false }),
    };
    const dbMock = {
      collection: vi.fn((colName) => {
        if (colName === 'stores') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
            doc: vi.fn(() => docMock),
            add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
          };
        }
        if (colName === 'shards') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            doc: vi.fn(() => docMock),
            add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
          };
        }
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
          doc: vi.fn(() => docMock),
          add: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
        };
      }),
    };
    vi.mocked(getFirestore).mockReturnValue(dbMock as unknown as ReturnType<typeof getFirestore>);

    const result = (await handler(makeRequest(VALID_PAYLOAD))) as { projectId: string };
    expect(result.projectId).toContain('vtx-sd-');

    expect(docMock.set).toHaveBeenCalled();
    const savedData = docMock.set.mock.calls[0][0] as any;
    expect(savedData.runtimeMode).toBe('shared-shard');
    expect(savedData.shardId).toContain('shard-development-');
    expect(savedData.isNewShard).toBe(true);
  });
});
