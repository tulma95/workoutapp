// Mirrors usernameSchema in backend/src/lib/routeHelpers.ts — must stay in sync.
export function validateUsername(
  value: string,
  options?: { required?: boolean }
): string {
  const required = options?.required ?? true;
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return required ? 'Username is required' : '';
  }

  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters';
  }

  if (trimmed.length > 30) {
    return 'Username must be at most 30 characters';
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Username may only contain letters, numbers, and underscores';
  }

  return '';
}
