import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedStoreData } from './seeds';
import * as helpers from './helpers';

describe('Seed Engine', () => {
  const mockAuth = {} as any;
  const mockApiFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(helpers, 'apiFetch').mockImplementation(mockApiFetch);
    mockApiFetch.mockResolvedValue({ documents: [] });
  });

  it('should seed only singleton configs in EMPTY mode', async () => {
    await seedStoreData(
      mockAuth,
      'test-project',
      'store-slug',
      'TECNOLOGIA_ELECTRONICA',
      'Tech Store',
      false,
      true,
      'store-123',
      'EMPTY',
    );

    const calls = mockApiFetch.mock.calls.map((c) => c[1]);
    expect(calls.some((url: string) => url.includes('banners/home_store-123'))).toBe(true);
    expect(calls.some((url: string) => url.includes('pages/home_store-123'))).toBe(true);
    expect(calls.some((url: string) => url.includes('pages/aboutUs_store-123'))).toBe(true);
    expect(calls.some((url: string) => url.includes('configuracion/store_store-123'))).toBe(true);
    expect(calls.some((url: string) => url.includes('configuracion/footer_store-123'))).toBe(true);
    expect(calls.some((url: string) => url.includes('settings/emailTemplates_store-123'))).toBe(
      true,
    );
    // Categories and products should NOT be seeded in EMPTY mode
    expect(calls.some((url: string) => url.includes('categories/store-123-cat-'))).toBe(false);
    expect(calls.some((url: string) => url.includes('products/store-123-prod-'))).toBe(false);
  });

  it('should seed categories, attributes and products in CATALOG_ONLY mode without clients or orders', async () => {
    await seedStoreData(
      mockAuth,
      'test-project',
      'store-slug',
      'TECNOLOGIA_ELECTRONICA',
      'Tech Store',
      false,
      true,
      'store-123',
      'CATALOG_ONLY',
    );

    const calls = mockApiFetch.mock.calls.map((c) => c[1]);
    expect(calls.some((url: string) => url.includes('categories/store-123-cat-'))).toBe(true);
    expect(calls.some((url: string) => url.includes('attributes/store-123-attr-'))).toBe(true);
    expect(calls.some((url: string) => url.includes('products/store-123-prod-'))).toBe(true);
    // No clients or orders in CATALOG_ONLY
    expect(calls.some((url: string) => url.includes('clients/store-123_'))).toBe(false);
    expect(calls.some((url: string) => url.includes('orders/store-123-ORD-'))).toBe(false);
  });

  it('should seed complete demo data in FULL_DEMO mode', async () => {
    await seedStoreData(
      mockAuth,
      'test-project',
      'store-slug',
      'TECNOLOGIA_ELECTRONICA',
      'Tech Store',
      true,
      true,
      'store-123',
      'FULL_DEMO',
    );

    const calls = mockApiFetch.mock.calls.map((c) => c[1]);
    expect(calls.some((url: string) => url.includes('categories/store-123-cat-'))).toBe(true);
    expect(calls.some((url: string) => url.includes('products/store-123-prod-'))).toBe(true);
    expect(calls.some((url: string) => url.includes('clients/store-123_'))).toBe(true);
    expect(calls.some((url: string) => url.includes('orders/store-123-ORD-'))).toBe(true);
  });
});
