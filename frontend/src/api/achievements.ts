import { apiFetch } from './client';
import { AchievementsResponseSchema } from './schemas';

export type { Achievement, AchievementsResponse } from './schemas';

export async function getAchievements(): Promise<typeof AchievementsResponseSchema._output> {
  const data = await apiFetch('/achievements');
  return AchievementsResponseSchema.parse(data);
}
