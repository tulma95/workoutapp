import { apiFetch } from './client';
import { ProgressResponseSchema } from './schemas';
export type { ProgressResponse, ProgressExercise } from './schemas';

export async function getProgress() {
  const data = await apiFetch('/progress');
  return ProgressResponseSchema.parse(data);
}
