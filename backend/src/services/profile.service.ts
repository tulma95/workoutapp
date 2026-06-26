import prisma from '../lib/db';
import { calculateStreak } from '../lib/streak';
import { getPersonalRecords } from './progress.service';

export interface UserProfile {
  currentStreak: number;
  totalWorkouts: number;
  achievementCount: number;
  topPRs: Array<{ exercise: string; e1rm: number }>;
}

// Public-ish profile stats for a user (used for self + friends' profiles).
export async function getUserProfile(userId: number): Promise<UserProfile> {
  const [workouts, achievementCount, prs] = await Promise.all([
    prisma.workout.findMany({
      where: { userId, status: 'completed', completedAt: { not: null } },
      select: { completedAt: true },
    }),
    prisma.userAchievement.count({ where: { userId } }),
    getPersonalRecords(userId),
  ]);

  const dates = workouts.map((w) => (w.completedAt as Date).toISOString().slice(0, 10));
  const topPRs = [...prs]
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 3)
    .map((p) => ({ exercise: p.name, e1rm: p.e1rm }));

  return {
    currentStreak: calculateStreak(dates),
    totalWorkouts: workouts.length,
    achievementCount,
    topPRs,
  };
}
