import { apiFetchParsed } from './client';
import { ProgressResponseSchema } from './schemas';
export type { ProgressResponse, ProgressExercise } from './schemas';

export async function getProgress() {
  return apiFetchParsed('/progress', ProgressResponseSchema);
}
