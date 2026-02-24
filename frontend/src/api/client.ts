export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;

export async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const headers: Record<string, string> = {};

  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (res.status === 401 && !isRefreshing) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          isRefreshing = false;

          // Retry original request with new token
          return apiFetch(path, options);
        }
      } catch {
        // refresh failed
      }
      isRefreshing = false;
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new ApiError(body.error?.message || res.statusText, res.status);
  }

  return res.json();
}

export async function apiFetchParsed<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
  options?: RequestInit,
): Promise<T> {
  const data = await apiFetch(path, options);
  return schema.parse(data);
}
