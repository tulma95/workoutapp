export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'Login failed' } }));
    throw body;
  }

  return res.json();
}

export async function register(
  email: string,
  password: string,
  displayName: string,
  unitPreference: string,
) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, unitPreference }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'Registration failed' } }));
    throw body;
  }

  return res.json();
}
