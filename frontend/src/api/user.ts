import { apiFetchParsed } from './client'
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
