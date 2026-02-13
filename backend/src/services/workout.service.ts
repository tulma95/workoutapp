import prisma from '../lib/db';
import { generateWorkoutSets, NSUNS_4DAY } from '../lib/nsuns';
import { calculateProgression } from '../lib/progression';
import { getCurrentTMs } from './trainingMax.service';
import { roundWeight } from '../lib/weightRounding';
import type { WorkoutStatus } from '../types';
import { ExistingWorkoutError } from '../types';
import { logger } from '../lib/logger';

const LB_TO_KG = 2.20462;

function decimalToNumber(val: unknown): number {
  return Number(val);
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

function formatWorkout(
  workout: {
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
  },
  unit: string,
) {
  return {
    ...workout,
    status: workout.status as WorkoutStatus,
    sets: workout.sets.map((s) => ({
      ...s,
      prescribedWeight: convertWeightToUserUnit(decimalToNumber(s.prescribedWeight), unit),
    })),
  };
}

export async function startWorkout(userId: number, dayNumber: number) {
  // Check for existing in-progress workout
  const existing = await prisma.workout.findFirst({
    where: { userId, status: 'in_progress' },
  });
  if (existing) {
    throw new ExistingWorkoutError(existing.id, existing.dayNumber);
  }

  // Get user for unit preference
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('BAD_REQUEST: User not found');
  }

  // Check if user has an active plan
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: {
      plan: true,
    },
  });

  // If user has active plan, use plan-driven generation
  if (activePlan) {
    // Validate dayNumber against plan's daysPerWeek
    if (dayNumber < 1 || dayNumber > activePlan.plan.daysPerWeek) {
      throw new Error(
        `BAD_REQUEST: Invalid day number ${dayNumber}. Plan has ${activePlan.plan.daysPerWeek} days per week.`,
      );
    }

    // Now load the specific day with exercises
    const planDay = await prisma.planDay.findFirst({
      where: {
        planId: activePlan.plan.id,
        dayNumber,
      },
      include: {
        exercises: {
          include: {
            exercise: true,
            tmExercise: true,
            sets: {
              orderBy: { setOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!planDay) {
      throw new Error(`BAD_REQUEST: Plan day ${dayNumber} not found`);
    }

    // Collect unique tmExercise IDs
    const tmExerciseIds = new Set<number>();
    for (const exercise of planDay.exercises) {
      tmExerciseIds.add(exercise.tmExerciseId);
    }

    // Fetch current TMs for these exercises (try by exerciseId first, fallback to exercise string)
    const tmRecords = await prisma.trainingMax.findMany({
      where: {
        userId,
        OR: [
          { exerciseId: { in: Array.from(tmExerciseIds) } },
          {
            exercise: {
              in: Array.from(tmExerciseIds)
                .map((id) => {
                  const ex = planDay.exercises.find((e) => e.tmExerciseId === id);
                  return ex?.tmExercise.slug;
                })
                .filter((s): s is string => s !== undefined),
            },
          },
        ],
      },
      orderBy: { effectiveDate: 'desc' },
    });

    // Build TM map by exerciseId
    const tmMapById: Record<number, number> = {};
    for (const tmExId of tmExerciseIds) {
      // Find TM record for this exercise ID
      const tmRecord = tmRecords.find(
        (tm) =>
          tm.exerciseId === tmExId ||
          tm.exercise === planDay.exercises.find((e) => e.tmExerciseId === tmExId)?.tmExercise.slug,
      );
      if (tmRecord) {
        tmMapById[tmExId] = decimalToNumber(tmRecord.weight);
      }
    }

    // Verify all required TMs are present
    for (const tmExId of tmExerciseIds) {
      if (tmMapById[tmExId] === undefined) {
        const exercise = planDay.exercises.find((e) => e.tmExerciseId === tmExId)?.tmExercise;
        throw new Error(`BAD_REQUEST: Training max not set for ${exercise?.name || 'exercise'}`);
      }
    }

    // Generate sets from plan structure
    const setsToCreate: Array<{
      exercise: string;
      exerciseId: number;
      tier: string;
      setOrder: number;
      prescribedWeight: number;
      prescribedReps: number;
      isAmrap: boolean;
      isProgression: boolean;
    }> = [];

    for (const planDayExercise of planDay.exercises) {
      const tm = tmMapById[planDayExercise.tmExerciseId];
      for (const planSet of planDayExercise.sets) {
        const percentage = decimalToNumber(planSet.percentage);
        const weight = roundWeight(tm * percentage, 'kg');
        setsToCreate.push({
          exercise: planDayExercise.exercise.slug,
          exerciseId: planDayExercise.exerciseId,
          tier: planDayExercise.tier,
          setOrder: planSet.setOrder,
          prescribedWeight: weight,
          prescribedReps: planSet.reps,
          isAmrap: planSet.isAmrap,
          isProgression: planSet.isProgression,
        });
      }
    }

    // Create workout + sets in transaction
    const workout = await prisma.$transaction(async (tx) => {
      const w = await tx.workout.create({
        data: {
          userId,
          dayNumber,
          status: 'in_progress',
          planDayId: planDay.id,
        },
      });

      for (const set of setsToCreate) {
        await tx.workoutSet.create({
          data: {
            workoutId: w.id,
            exercise: set.exercise,
            exerciseId: set.exerciseId,
            tier: set.tier,
            setOrder: set.setOrder,
            prescribedWeight: set.prescribedWeight,
            prescribedReps: set.prescribedReps,
            isAmrap: set.isAmrap,
            isProgression: set.isProgression,
          },
        });
      }

      return tx.workout.findUniqueOrThrow({
        where: { id: w.id },
        include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
      });
    });

    logger.info('Workout started (plan-driven)', {
      dayNumber,
      userId,
      workoutId: workout.id,
      planId: activePlan.plan.id,
      planSlug: activePlan.plan.slug,
    });

    return formatWorkout(workout, user.unitPreference);
  }

  // FALLBACK: Old hardcoded nSuns logic for users without active plan
  // Validate dayNumber for hardcoded 4-day program
  if (dayNumber < 1 || dayNumber > 4) {
    throw new Error('BAD_REQUEST: Invalid day number. Must be 1-4.');
  }

  // Get current TMs (note: getCurrentTMs now returns weights in user's unit, but we need kg for calculations)
  const tmsInUserUnit = await getCurrentTMs(userId);
  if (tmsInUserUnit.length < 4) {
    throw new Error('BAD_REQUEST: Training maxes not set for all exercises');
  }

  // Get raw TMs in kg for calculations
  const rawTms = await Promise.all(
    ['bench', 'squat', 'ohp', 'deadlift'].map(async (exercise) => {
      const tm = await prisma.trainingMax.findFirst({
        where: { userId, exercise },
        orderBy: { effectiveDate: 'desc' },
      });
      return tm ? { exercise, weight: decimalToNumber(tm.weight) } : null;
    }),
  );

  const tmMap: Record<string, number> = {};
  for (const tm of rawTms) {
    if (tm) {
      tmMap[tm.exercise] = tm.weight;
    }
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

  logger.info('Workout started (fallback)', { dayNumber, userId, workoutId: workout.id });

  return formatWorkout(workout, user.unitPreference);
}

export async function getCurrentWorkout(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  const workout = await prisma.workout.findFirst({
    where: { userId, status: 'in_progress' },
    include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
  });

  return workout ? formatWorkout(workout, user.unitPreference) : null;
}

export async function getWorkout(workoutId: number, userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
  });

  return workout ? formatWorkout(workout, user.unitPreference) : null;
}

export async function logSet(
  setId: number,
  userId: number,
  data: { actualReps?: number; completed?: boolean },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

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

  return {
    ...updated,
    prescribedWeight: convertWeightToUserUnit(decimalToNumber(updated.prescribedWeight), user.unitPreference),
  };
}

export async function completeWorkout(workoutId: number, userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

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
      // Get current TM for this exercise in kg (stored value)
      const currentTMRow = await prisma.trainingMax.findFirst({
        where: { userId, exercise },
        orderBy: { effectiveDate: 'desc' },
      });

      if (currentTMRow) {
        const currentTMKg = decimalToNumber(currentTMRow.weight);
        const newWeightKg = currentTMKg + increase;
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
          update: { weight: newWeightKg },
          create: {
            userId,
            exercise,
            weight: newWeightKg,
            effectiveDate: today,
          },
        });

        logger.info('TM progression', { exercise, previousTM: currentTMKg, newTM: newWeightKg, increase });

        // Convert to user's unit for response
        progression = {
          exercise,
          previousTM: convertWeightToUserUnit(currentTMKg, user.unitPreference),
          newTM: convertWeightToUserUnit(newWeightKg, user.unitPreference),
          increase: convertWeightToUserUnit(increase, user.unitPreference),
        };
      }
    }
  }

  logger.info('Workout completed', { workoutId, dayNumber: workout.dayNumber, userId });

  // Mark workout completed
  const completed = await prisma.workout.update({
    where: { id: workoutId },
    data: { status: 'completed', completedAt: new Date() },
    include: { sets: { orderBy: [{ tier: 'asc' }, { setOrder: 'asc' }] } },
  });

  return { workout: formatWorkout(completed, user.unitPreference), progression };
}

export async function getHistory(userId: number, page: number, limit: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return {
      workouts: [],
      total: 0,
      page,
      limit,
    };
  }

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
    workouts: workouts.map((w) => formatWorkout(w, user.unitPreference)),
    total,
    page,
    limit,
  };
}

export async function cancelWorkout(workoutId: number, userId: number) {
  // Find workout and verify ownership
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
  });

  if (!workout) {
    return null;
  }

  // Check if workout is in_progress
  if (workout.status !== 'in_progress') {
    throw new Error('CONFLICT: Cannot cancel a completed workout');
  }

  // Soft delete: update status to 'discarded' instead of hard deleting
  await prisma.workout.update({
    where: { id: workoutId },
    data: { status: 'discarded' },
  });

  return { success: true };
}

export async function getCalendar(userId: number, year: number, month: number) {
  // Calculate date range for the given month
  const startDate = new Date(year, month - 1, 1); // month is 0-indexed in Date constructor
  const endDate = new Date(year, month, 1); // First day of next month

  // Query workouts where completedAt or createdAt falls within the month
  // Exclude discarded workouts
  const workouts = await prisma.workout.findMany({
    where: {
      userId,
      status: { not: 'discarded' },
      OR: [
        {
          completedAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        {
          completedAt: null,
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
      ],
    },
    select: {
      id: true,
      dayNumber: true,
      status: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return { workouts };
}
