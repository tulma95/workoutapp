import { apiFetch } from './client'
import { UserSchema } from './schemas'

export async function getMe() {
  const data = await apiFetch('/users/me')
  return UserSchema.parse(data)
}

export async function updateMe(updates: { displayName?: string }) {
  const data = await apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return UserSchema.parse(data)
}
