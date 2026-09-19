import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockGetAccessToken } = vi.hoisted(() => ({ mockGetAccessToken: vi.fn() }));
const auth = { getAccessToken: mockGetAccessToken } as never;

import {
  countHostingSites,
  isShardSiteCapacityFull,
  HOSTING_SITE_LIMIT,
  HOSTING_SITE_ALERT_THRESHOLD,
} from './hosting-sites.utils';

function mockFetchOk(count: number) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      sites: Array.from({ length: count }, (_, i) => ({ name: `sites/s${i}` })),
    }),
  })) as never;
}

describe('hosting sites capacity', () => {
  beforeEach(() => {
    mockGetAccessToken.mockReset().mockResolvedValue({ token: 't' });
  });

  it('cuenta los sitios del proyecto (incluye DEFAULT_SITE)', async () => {
    mockFetchOk(4);
    await expect(countHostingSites(auth, 'proj-count')).resolves.toBe(4);
  });

  it('devuelve null si la API falla', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as never;
    await expect(countHostingSites(auth, 'proj-fail')).resolves.toBeNull();
  });

  it('marca lleno cuando los sitios usables alcanzan el límite', async () => {
    mockFetchOk(HOSTING_SITE_LIMIT); // 36 sitios => 35 usables
    const full = await isShardSiteCapacityFull(auth, 'proj-full', 3, 35);
    expect(full.full).toBe(true);
    expect(full.sitesUsed).toBe(HOSTING_SITE_LIMIT);
  });

  it('no marca lleno con margen disponible', async () => {
    mockFetchOk(10);
    const res = await isShardSiteCapacityFull(auth, 'proj-ok', 3, 35);
    expect(res.full).toBe(false);
    expect(res.sitesUsed).toBe(10);
  });

  it('alert threshold es 85% del límite', () => {
    expect(HOSTING_SITE_ALERT_THRESHOLD).toBe(31);
  });
});
