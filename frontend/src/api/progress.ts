import { apiFetchParsed } from './client';
import { ProgressResponseSchema, PersonalRecordsResponseSchema } from './schemas';
export type { ProgressResponse, ProgressExercise, PersonalRecord } from './schemas';

export async function getProgress() {
  return apiFetchParsed('/progress', ProgressResponseSchema);
}

export async function getPersonalRecords() {
  return apiFetchParsed('/progress/records', PersonalRecordsResponseSchema);
}
