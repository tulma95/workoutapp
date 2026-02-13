import prisma from '../lib/db';
import { roundWeight } from '../lib/weightRounding';
import { logger } from '../lib/logger';

const LB_TO_KG = 2.20462;

function toKg(weight: number, unit: string): number {
  return unit === 'lb' ? weight / LB_TO_KG : weight;
}

function toLb(weightKg: number): number {
  return weightKg * LB_TO_KG;
}

function convertWeightToUserUnit(weightKg: number, unit: string): number {
  if (unit === 'lb') {
    return roundWeight(toLb(weightKg), 'lb');
  }
  return weightKg;
}

function decimalToNumber(val: unknown): number {
  return Number(val);
}

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

  if (!activePlan) {
    // No active plan - return empty array
    return [];
  }

  // Get unique TM exercise IDs from plan
  const tmExerciseIds = new Set<number>();
  for (const day of activePlan.plan.days) {
    for (const ex of day.exercises) {
      tmExerciseIds.add(ex.tmExerciseId);
    }
  }

  // Fetch TMs for all required exercises (most recent TM per exercise)
  const tmRecords = await prisma.trainingMax.findMany({
    where: {
      userId,
      exerciseId: { in: Array.from(tmExerciseIds) },
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
    weight: convertWeightToUserUnit(decimalToNumber(tm.weight), user.unitPreference),
  }));
}

export async function setupFromExerciseTMs(
  userId: number,
  exerciseTMs: Array<{ exerciseId: number; oneRepMax: number }>,
  unit: string,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  logger.info('TM setup from exercise IDs', { userId, exerciseIds: exerciseTMs.map(e => e.exerciseId), unit });

  const created = await Promise.all(
    exerciseTMs.map(async ({ exerciseId, oneRepMax }) => {
      const ormKg = toKg(oneRepMax, unit);
      const tm = roundWeight(ormKg * 0.9, 'kg');

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
        weight: convertWeightToUserUnit(decimalToNumber(row.weight), unit)
      };
    }),
  );

  return created;
}

export async function updateTM(
  userId: number,
  exerciseSlug: string,
  weight: number,
  unit: string,
) {
  logger.info('Manual TM update', { userId, exerciseSlug, weight, unit });

  // Look up exerciseId from slug
  const exercise = await prisma.exercise.findUnique({ where: { slug: exerciseSlug } });
  if (!exercise) {
    throw new Error(`Exercise not found: ${exerciseSlug}`);
  }

  const weightKg = roundWeight(toKg(weight, unit), 'kg');
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
    update: { weight: weightKg },
    create: {
      userId,
      exerciseId: exercise.id,
      weight: weightKg,
      effectiveDate: today,
    },
    include: {
      exercise: true,
    },
  });

  return {
    ...row,
    exercise: row.exercise.slug,
    weight: convertWeightToUserUnit(decimalToNumber(row.weight), unit)
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
    weight: convertWeightToUserUnit(decimalToNumber(row.weight), user.unitPreference),
  }));
}
