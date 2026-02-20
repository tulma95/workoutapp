import type { Prisma } from '../generated/prisma/client';

export type PrismaTransactionClient = Prisma.TransactionClient;

export type AchievementSlug = 'first-blood' | 'consistent-lifter' | 'century-club' | 'amrap-king';

export interface NewlyUnlockedAchievement {
  slug: string;
  name: string;
  description: string;
}

interface AchievementDef {
  slug: AchievementSlug;
  name: string;
  description: string;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    slug: 'first-blood',
    name: 'First Blood',
    description: 'Complete your first workout.',
  },
  {
    slug: 'consistent-lifter',
    name: 'Consistent Lifter',
    description: 'Complete 10 workouts.',
  },
  {
    slug: 'century-club',
    name: 'Century Club',
    description: 'Lift 100+ kg in a single set.',
  },
  {
    slug: 'amrap-king',
    name: 'AMRAP King',
    description: 'Beat your progression set by 5 or more reps.',
  },
];

export async function checkAndUnlockAchievements(
  tx: PrismaTransactionClient,
  userId: number,
  workoutId: number,
  sets: Array<{
    prescribedWeight: number | null;
    actualReps: number | null;
    prescribedReps: number | null;
    isProgression: boolean;
  }>,
): Promise<NewlyUnlockedAchievement[]> {
  // Fetch already-unlocked slugs
  const existing = await tx.userAchievement.findMany({
    where: { userId },
    select: { slug: true },
  });
  const unlockedSlugs = new Set(existing.map((a) => a.slug));

  // Determine which badges to check
  const toCheck = ACHIEVEMENT_DEFS.filter((def) => !unlockedSlugs.has(def.slug));
  if (toCheck.length === 0) return [];

  // Run detectors for each candidate
  const newlyUnlocked: AchievementSlug[] = [];

  for (const def of toCheck) {
    let unlocked = false;

    if (def.slug === 'century-club') {
      unlocked = sets.some(
        (s) => s.prescribedWeight !== null && s.prescribedWeight >= 100,
      );
    } else if (def.slug === 'amrap-king') {
      unlocked = sets.some(
        (s) =>
          s.isProgression &&
          s.actualReps !== null &&
          s.prescribedReps !== null &&
          s.actualReps >= s.prescribedReps + 5,
      );
    } else if (def.slug === 'first-blood') {
      const count = await tx.workout.count({
        where: { userId, status: 'completed' },
      });
      unlocked = count === 1;
    } else if (def.slug === 'consistent-lifter') {
      const count = await tx.workout.count({
        where: { userId, status: 'completed' },
      });
      unlocked = count >= 10;
    }

    if (unlocked) {
      newlyUnlocked.push(def.slug);
    }
  }

  if (newlyUnlocked.length === 0) return [];

  // Insert new achievement rows
  await tx.userAchievement.createMany({
    data: newlyUnlocked.map((slug) => ({
      userId,
      slug,
      workoutId,
    })),
    skipDuplicates: true,
  });

  // Return full achievement definitions for newly unlocked badges
  return newlyUnlocked.map((slug) => {
    const def = ACHIEVEMENT_DEFS.find((d) => d.slug === slug)!;
    return { slug: def.slug, name: def.name, description: def.description };
  });
}
