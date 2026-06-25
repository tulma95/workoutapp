import { apiFetch, apiFetchParsed } from './client'
import { BodyweightHistoryResponseSchema, BodyweightEntrySchema } from './schemas'
export type { BodyweightEntry } from './schemas'

export async function getBodyweightHistory() {
  return apiFetchParsed('/bodyweight', BodyweightHistoryResponseSchema)
}

export async function logBodyweight(weight: number) {
  return apiFetchParsed('/bodyweight', BodyweightEntrySchema, {
    method: 'POST',
    body: JSON.stringify({ weight }),
  })
}

export async function deleteBodyweightEntry(id: number): Promise<void> {
  await apiFetch(`/bodyweight/${id}`, { method: 'DELETE' })
}
