import { apiFetch, apiFetchParsed } from './client'
import { UserSchema, TokenPairSchema } from './schemas'

export async function getMe() {
  return apiFetchParsed('/users/me', UserSchema)
}

export async function updateMe(updates: { username?: string | null }) {
  return apiFetchParsed('/users/me', UserSchema, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  // Changing the password bumps the server-side tokenVersion, invalidating
  // every previously issued token (ticket 170). The endpoint returns a fresh
  // pair so the current session stays logged in — store it, otherwise the next
  // request would 401 and bounce the user to /login.
  const tokens = await apiFetchParsed('/users/me/password', TokenPairSchema, {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  localStorage.setItem('accessToken', tokens.accessToken)
  localStorage.setItem('refreshToken', tokens.refreshToken)
}

export async function changeEmail(currentPassword: string, newEmail: string) {
  await apiFetch('/users/me/email', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newEmail }),
  })
}

export async function deleteAccount(password: string) {
  await apiFetch('/users/me', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })
}

export async function exportData() {
  return apiFetch('/users/me/export')
}
