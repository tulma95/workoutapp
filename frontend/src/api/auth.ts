import { LoginResponseSchema } from './schemas';
import { ApiError } from './client';
export type { User, LoginResponse } from './schemas';

export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'Login failed' } }));
    throw new ApiError(body.error?.message || res.statusText, res.status, body.error?.code);
  }

  const data = await res.json();
  return LoginResponseSchema.parse(data);
}

export async function register(
  email: string,
  password: string,
  username: string,
) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'Registration failed' } }));
    throw new ApiError(body.error?.message || res.statusText, res.status, body.error?.code);
  }

  const data = await res.json();
  return LoginResponseSchema.parse(data);
}
