import { apiFetchParsed } from './client';
import { AchievementsResponseSchema } from './schemas';

export type { Achievement, AchievementsResponse } from './schemas';

export async function getAchievements(): Promise<typeof AchievementsResponseSchema._output> {
  return apiFetchParsed('/achievements', AchievementsResponseSchema);
}
