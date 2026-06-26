// Email addresses are case-insensitive in practice, so we store them
// trimmed-lowercased and look them up case-insensitively.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
