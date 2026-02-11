import prisma from '../lib/db';
import { generateWorkoutSets } from '../lib/nsuns';
import { getCurrentTMs } from './trainingMax.service';

function decimalToNumber(val: unknown): number {
  return Number(val);
}

function formatWorkout(workout: {
  id: number;
  userId: number;
  dayNumber: number;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  sets: Array<{
    id: number;
    workoutId: number;
    exercise: string;
    tier: string;
    setOrder: number;
    prescribedWeight: unknown;
    prescribedReps: number;
    isAmrap: boolean;
    actualReps: number | null;
    completed: boolean;
    createdAt: Date;
  }>;
}) {
  return {
    ...workout,
    sets: workout.sets.map((s) => ({
      ...s,
      prescribedWeight: decimalToNumber(s.prescribedWeight),
    })),
  };
}

export async function startWorkout(userId: number, dayNumber: number) {
  // Check for existing in-progress workout
  const existing = await prisma.workout.findFirst({
    where: { userId, status: 'in_progress' },
  });
  if (existing) {
    throw new Error('CONFLICT: Already have an in-progress workout');
  }

  // Get current TMs
  const tms = await getCurrentTMs(userId);
  if (tms.length < 4) {
    throw new Error('BAD_REQUEST: Training maxes not set for all exercises');
  }

  const tmMap: Record<string, number> = {};
  for (const tm of tms) {
    tmMap[tm.exercise] = tm.weight;
  }

  // Generate sets (always use 'kg' for storage rounding)
  const sets = generateWorkoutSets(dayNumber, tmMap, 'kg');

  // Create workout + sets in transaction
  const workout = await prisma.$transaction(async (tx) => {
    const w = await tx.workout.create({
      data: {
        userId,
        dayNumber,
        status: 'in_progress',
      },
    });

    for (const set of sets) {
      await tx.workoutSet.create({
        data: {
          workoutId: w.id,
          exercise: set.exercise,
          tier: set.tier,
          setOrder: set.setOrder,
          prescribedWeight: set.prescribedWeight,
          prescribedReps: set.prescribedReps,
          isAmrap: set.isAmrap,
        },
      });
    }

    return tx.workout.findUniqueOrThrow({
      where: { id: w.id },
      include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
    });
  });

  return formatWorkout(workout);
}

export async function getCurrentWorkout(userId: number) {
  const workout = await prisma.workout.findFirst({
    where: { userId, status: 'in_progress' },
    include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
  });

  return workout ? formatWorkout(workout) : null;
}

export async function getWorkout(workoutId: number, userId: number) {
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
  });

  return workout ? formatWorkout(workout) : null;
}
