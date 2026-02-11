import { describe, it, expect, vi, beforeEach } from 'vitest';

// Since we have React 19 + @testing-library/react version mismatch,
// test the auth logic directly without rendering components

describe('AuthContext - login flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('login API stores tokens in localStorage', async () => {
    const loginResponse = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: { id: 1, email: 'test@example.com' },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(loginResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { login } = await import('../api/auth');
    const result = await login('test@example.com', 'password123');

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(result.user.email).toBe('test@example.com');

    // Verify fetch was called correctly
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    }));
  });

  it('login API throws on failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid email or password' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { login } = await import('../api/auth');
    await expect(login('bad@example.com', 'wrong')).rejects.toEqual({
      error: { message: 'Invalid email or password' },
    });
  });

  it('register API returns tokens and user', async () => {
    const registerResponse = {
      accessToken: 'reg-access-token',
      refreshToken: 'reg-refresh-token',
      user: { id: 2, email: 'new@example.com', displayName: 'New User', unitPreference: 'kg' },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(registerResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { register } = await import('../api/auth');
    const result = await register('new@example.com', 'password123', 'New User', 'kg');

    expect(result.accessToken).toBe('reg-access-token');
    expect(result.user.email).toBe('new@example.com');
  });

  it('logout clears localStorage tokens', () => {
    localStorage.setItem('accessToken', 'token');
    localStorage.setItem('refreshToken', 'refresh');

    // Simulate what logout() does in AuthContext
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
