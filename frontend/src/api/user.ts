import { apiFetch, apiFetchParsed } from './client'
import { UserSchema } from './schemas'

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
  await apiFetch('/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
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
