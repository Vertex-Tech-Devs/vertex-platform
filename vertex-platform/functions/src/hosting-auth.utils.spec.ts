import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('./helpers', () => ({ apiFetch: mockApiFetch }));

import { ensureAuthorizedDomain } from './hosting-auth.utils';

const auth = {} as never;

describe('ensureAuthorizedDomain', () => {
  beforeEach(() => mockApiFetch.mockReset());

  it('agrega el dominio cuando falta (PATCH con la lista completa)', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ authorizedDomains: ['shard.web.app', 'localhost'] })
      .mockResolvedValueOnce({
        authorizedDomains: ['shard.web.app', 'localhost', 'lo-del-chino.web.app'],
      });

    const ok = await ensureAuthorizedDomain(auth, 'vtx-sd-ejxt7h2o', 'lo-del-chino.web.app');

    expect(ok).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    const [, url, opts] = mockApiFetch.mock.calls[1] as [
      unknown,
      string,
      { method: string; body: unknown },
    ];
    expect(url).toBe(
      'https://identitytoolkit.googleapis.com/admin/v2/projects/vtx-sd-ejxt7h2o/config?updateMask=authorizedDomains',
    );
    expect(opts.method).toBe('PATCH');
    expect((opts.body as { authorizedDomains: string[] }).authorizedDomains).toEqual([
      'shard.web.app',
      'localhost',
      'lo-del-chino.web.app',
    ]);
  });

  it('no hace PATCH si el dominio ya está autorizado', async () => {
    mockApiFetch.mockResolvedValueOnce({ authorizedDomains: ['lo-del-chino.web.app'] });
    const ok = await ensureAuthorizedDomain(auth, 'p', 'lo-del-chino.web.app');
    expect(ok).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('es tolerante a fallos (no rompe) salvo strict', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('boom'));
    await expect(ensureAuthorizedDomain(auth, 'p', 'x.web.app')).resolves.toBe(false);

    mockApiFetch.mockRejectedValueOnce(new Error('boom'));
    await expect(ensureAuthorizedDomain(auth, 'p', 'x.web.app', { strict: true })).rejects.toThrow(
      /No se pudo autorizar/,
    );
  });

  it('ignora entradas vacías', async () => {
    await expect(ensureAuthorizedDomain(auth, '', 'x.web.app')).resolves.toBe(false);
    await expect(ensureAuthorizedDomain(auth, 'p', '')).resolves.toBe(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
