import prisma from '../lib/db';
import { roundWeight } from '../lib/weightRounding';
import { logger } from '../lib/logger';


export async function getCurrentTMs(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return [];
  }

  // Check if user has an active plan
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: {
      plan: {
        include: {
          days: {
            include: {
              exercises: {
                include: {
                  tmExercise: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Build filter: if user has active plan, only return TMs for plan exercises
  const exerciseFilter: { in: number[] } | undefined = activePlan
    ? {
        in: Array.from(
          new Set(
            activePlan.plan.days.flatMap((day) =>
              day.exercises.map((ex) => ex.tmExerciseId),
            ),
          ),
        ),
      }
    : undefined;

  // Fetch TMs (most recent per exercise)
  const tmRecords = await prisma.trainingMax.findMany({
    where: {
      userId,
      ...(exerciseFilter ? { exerciseId: exerciseFilter } : {}),
    },
    include: {
      exercise: true,
    },
    orderBy: { effectiveDate: 'desc' },
  });

  // Deduplicate by exerciseId (take only the most recent TM for each exercise)
  const seenExerciseIds = new Set<number>();
  const deduplicated = tmRecords.filter((tm) => {
    if (seenExerciseIds.has(tm.exerciseId)) return false;
    seenExerciseIds.add(tm.exerciseId);
    return true;
  });

  return deduplicated.map((tm) => ({
    ...tm,
    exercise: tm.exercise.slug,
    weight: tm.weight.toNumber(),
  }));
}

export async function setupFromExerciseTMs(
  userId: number,
  exerciseTMs: Array<{ exerciseId: number; oneRepMax: number }>,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  logger.info('TM setup from exercise IDs', { userId, exerciseIds: exerciseTMs.map(e => e.exerciseId) });

  const created = await Promise.all(
    exerciseTMs.map(async ({ exerciseId, oneRepMax }) => {
      const tm = roundWeight(oneRepMax * 0.9);

      const row = await prisma.trainingMax.upsert({
        where: {
          userId_exerciseId_effectiveDate: {
            userId,
            exerciseId,
            effectiveDate: today,
          },
        },
        update: { weight: tm },
        create: {
          userId,
          exerciseId,
          weight: tm,
          effectiveDate: today,
        },
        include: {
          exercise: true,
        },
      });
      return {
        ...row,
        exercise: row.exercise.slug,
        weight: row.weight.toNumber()
      };
    }),
  );

  return created;
}

export async function updateTM(
  userId: number,
  exerciseSlug: string,
  weight: number,
  reason?: string,
) {
  logger.info('Manual TM update', { userId, exerciseSlug, weight });

  // Look up exerciseId from slug
  const exercise = await prisma.exercise.findUnique({ where: { slug: exerciseSlug } });
  if (!exercise) {
    throw new Error(`Exercise not found: ${exerciseSlug}`);
  }

  const weightKg = roundWeight(weight);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const row = await prisma.trainingMax.upsert({
    where: {
      userId_exerciseId_effectiveDate: {
        userId,
        exerciseId: exercise.id,
        effectiveDate: today,
      },
    },
    update: { weight: weightKg, reason: reason ?? null },
    create: {
      userId,
      exerciseId: exercise.id,
      weight: weightKg,
      effectiveDate: today,
      reason: reason ?? null,
    },
    include: {
      exercise: true,
    },
  });

  return {
    ...row,
    exercise: row.exercise.slug,
    weight: row.weight.toNumber()
  };
}

export async function getHistory(userId: number, exerciseSlug: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return [];
  }

  // Look up exerciseId from slug
  const exercise = await prisma.exercise.findUnique({ where: { slug: exerciseSlug } });
  if (!exercise) {
    return [];
  }

  const rows = await prisma.trainingMax.findMany({
    where: { userId, exerciseId: exercise.id },
    include: {
      exercise: true,
    },
    orderBy: { effectiveDate: 'desc' },
  });

  return rows.map((row) => ({
    ...row,
    exercise: row.exercise.slug,
    weight: row.weight.toNumber(),
  }));
}
