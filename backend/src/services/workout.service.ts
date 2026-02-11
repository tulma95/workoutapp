import prisma from '../lib/db';
import { generateWorkoutSets, NSUNS_4DAY } from '../lib/nsuns';
import { calculateProgression } from '../lib/progression';
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

export async function logSet(
  setId: number,
  userId: number,
  data: { actualReps?: number; completed?: boolean },
) {
  // Verify ownership by joining through workout
  const set = await prisma.workoutSet.findFirst({
    where: { id: setId, workout: { userId } },
  });
  if (!set) {
    return null;
  }

  const updateData: { actualReps?: number; completed?: boolean } = {};
  if (data.actualReps !== undefined) updateData.actualReps = data.actualReps;
  if (data.completed !== undefined) updateData.completed = data.completed;

  const updated = await prisma.workoutSet.update({
    where: { id: setId },
    data: updateData,
  });

  return { ...updated, prescribedWeight: decimalToNumber(updated.prescribedWeight) };
}

export async function completeWorkout(workoutId: number, userId: number) {
  // Find workout with sets, verify ownership
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
  });
  if (!workout) {
    return null;
  }

  const day = NSUNS_4DAY[workout.dayNumber - 1];

  // Find the progression AMRAP: highest percentage AMRAP set in T1
  let maxPct = 0;
  let progressionSetOrder = 0;
  for (let i = 0; i < day.t1.sets.length; i++) {
    const scheme = day.t1.sets[i];
    if (scheme.isAmrap && scheme.percentage > maxPct) {
      maxPct = scheme.percentage;
      progressionSetOrder = i + 1; // 1-based
    }
  }

  // Find the actual workout set matching the progression AMRAP
  const progressionSet = workout.sets.find(
    (s) => s.tier === 'T1' && s.setOrder === progressionSetOrder && s.isAmrap,
  );

  let progression: {
    exercise: string;
    previousTM: number;
    newTM: number;
    increase: number;
  } | null = null;

  if (progressionSet && progressionSet.actualReps !== null) {
    const exercise = day.t1.tmExercise as 'bench' | 'squat' | 'ohp' | 'deadlift';
    const { increase } = calculateProgression(progressionSet.actualReps, exercise);

    if (increase > 0) {
      // Get current TM for this exercise
      const currentTMs = await getCurrentTMs(userId);
      const currentTM = currentTMs.find((tm) => tm.exercise === exercise);

      if (currentTM) {
        const newWeight = currentTM.weight + increase;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.trainingMax.upsert({
          where: {
            userId_exercise_effectiveDate: {
              userId,
              exercise,
              effectiveDate: today,
            },
          },
          update: { weight: newWeight },
          create: {
            userId,
            exercise,
            weight: newWeight,
            effectiveDate: today,
          },
        });

        progression = {
          exercise,
          previousTM: currentTM.weight,
          newTM: newWeight,
          increase,
        };
      }
    }
  }

  // Mark workout completed
  const completed = await prisma.workout.update({
    where: { id: workoutId },
    data: { status: 'completed', completedAt: new Date() },
    include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
  });

  return { workout: formatWorkout(completed), progression };
}

export async function getHistory(userId: number, page: number, limit: number) {
  const [workouts, total] = await Promise.all([
    prisma.workout.findMany({
      where: { userId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
    }),
    prisma.workout.count({
      where: { userId, status: 'completed' },
    }),
  ]);

  return {
    workouts: workouts.map(formatWorkout),
    total,
    page,
    limit,
  };
}
