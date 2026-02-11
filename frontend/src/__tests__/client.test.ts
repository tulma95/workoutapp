import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '../api/client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('attaches Authorization Bearer header when token in localStorage', async () => {
    localStorage.setItem('accessToken', 'test-token-123');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/users/me');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
        }),
      }),
    );
  });

  it('does not attach Authorization header when no token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/health');

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it('sets Content-Type for POST requests with body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/test', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws on non-OK responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { message: 'Bad request' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/test')).rejects.toEqual({
      error: { message: 'Bad request' },
    });
  });
});
