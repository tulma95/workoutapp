import type { Decimal } from '@prisma/client/runtime/client';
import prisma from '../lib/db';
import { roundWeight } from '../lib/weightRounding';
import type { WorkoutStatus } from '../types';
import { ExistingWorkoutError } from '../types';
import { logger } from '../lib/logger';


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
      exerciseId: number;
      exercise: { slug: string; name: string };
      exerciseOrder: number;
      setOrder: number;
      prescribedWeight: Decimal;
      prescribedReps: number;
      isAmrap: boolean;
      isProgression?: boolean;
      actualReps: number | null;
      completed: boolean;
      createdAt: Date;
    }>;
  },
) {
  return {
    ...workout,
    status: workout.status as WorkoutStatus,
    sets: workout.sets.map((s) => ({
      ...s,
      exercise: s.exercise.name,
      prescribedWeight: s.prescribedWeight.toNumber(),
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

    // Fetch current TMs for these exercises
    const tmRecords = await prisma.trainingMax.findMany({
      where: {
        userId,
        exerciseId: { in: Array.from(tmExerciseIds) },
      },
      orderBy: { effectiveDate: 'desc' },
    });

    // Build TM map by exerciseId (take most recent TM for each exercise)
    const tmMapById: Record<number, number> = {};
    for (const tmExId of tmExerciseIds) {
      const tmRecord = tmRecords.find((tm) => tm.exerciseId === tmExId);
      if (tmRecord) {
        tmMapById[tmExId] = tmRecord.weight.toNumber();
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
      exerciseId: number;
      exerciseOrder: number;
      setOrder: number;
      prescribedWeight: number;
      prescribedReps: number;
      isAmrap: boolean;
      isProgression: boolean;
    }> = [];

    for (const planDayExercise of planDay.exercises) {
      const tm = tmMapById[planDayExercise.tmExerciseId]!;
      for (const planSet of planDayExercise.sets) {
        const percentage = planSet.percentage.toNumber();
        const weight = roundWeight(tm * percentage);
        setsToCreate.push({
          exerciseId: planDayExercise.exerciseId,
          exerciseOrder: planDayExercise.sortOrder,
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
            exerciseId: set.exerciseId,
            exerciseOrder: set.exerciseOrder,
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
        include: {
          sets: {
            orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
            include: { exercise: true }
          }
        },
      });
    });

    logger.info('Workout started', {
      dayNumber,
      userId,
      workoutId: workout.id,
      planId: activePlan.plan.id,
      planSlug: activePlan.plan.slug,
    });

    return formatWorkout(workout);
  }

  // No active plan - user must select a plan first
  throw new Error('BAD_REQUEST: No active workout plan. Please select a plan first.');
}

export async function getCurrentWorkout(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  const workout = await prisma.workout.findFirst({
    where: { userId, status: 'in_progress' },
    include: {
      sets: {
        orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
        include: { exercise: true }
      }
    },
  });

  return workout ? formatWorkout(workout) : null;
}

export async function getWorkout(workoutId: number, userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: {
      sets: {
        orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
        include: { exercise: true }
      }
    },
  });

  return workout ? formatWorkout(workout) : null;
}

export async function logSet(
  setId: number,
  userId: number,
  data: { actualReps?: number | null; completed?: boolean },
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

  const updateData: { actualReps?: number | null; completed?: boolean } = {};
  if (data.actualReps !== undefined) updateData.actualReps = data.actualReps;
  if (data.completed !== undefined) updateData.completed = data.completed;

  const updated = await prisma.workoutSet.update({
    where: { id: setId },
    data: updateData,
    include: { exercise: true },
  });

  return {
    ...updated,
    exercise: updated.exercise.name,
    prescribedWeight: updated.prescribedWeight.toNumber(),
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
    include: {
      sets: {
        orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
        include: { exercise: true }
      }
    },
  });
  if (!workout) {
    return null;
  }

  // Check if workout is plan-driven (has planDayId)
  if (workout.planDayId) {
    // Plan-driven progression logic
    const progressionSets = workout.sets.filter((s) => s.isProgression && s.actualReps !== null);

    const progressions: Array<{
      exercise: string;
      previousTM: number;
      newTM: number;
      increase: number;
    }> = [];

    // Hoist planDay query outside the loop — it is always the same planDayId
    const planDay = await prisma.planDay.findUnique({
      where: { id: workout.planDayId },
      include: {
        plan: {
          include: {
            progressionRules: true,
          },
        },
      },
    });

    for (const progressionSet of progressionSets) {
      const actualReps = progressionSet.actualReps;
      if (actualReps == null) continue;

      // Get the exercise details
      const exercise = await prisma.exercise.findUnique({
        where: { id: progressionSet.exerciseId },
      });
      if (!exercise) continue;

      if (!planDay) continue;

      // Find matching progression rule
      // Priority: exercise-specific rule first, then category-based rule
      let matchingRule = planDay.plan.progressionRules.find(
        (rule) =>
          rule.exerciseId === exercise.id &&
          actualReps >= rule.minReps &&
          actualReps <= rule.maxReps,
      );

      if (!matchingRule) {
        // Fallback to category-based rule
        const category = exercise.isUpperBody ? 'upper' : 'lower';
        matchingRule = planDay.plan.progressionRules.find(
          (rule) =>
            rule.category === category &&
            actualReps >= rule.minReps &&
            actualReps <= rule.maxReps,
        );
      }

      if (!matchingRule) {
        logger.warn('No matching progression rule found', {
          exerciseId: exercise.id,
          exerciseSlug: exercise.slug,
          actualReps: progressionSet.actualReps,
        });
        continue;
      }

      const increase = matchingRule.increase.toNumber();
      if (increase <= 0) continue;

      // Get current TM for this exercise
      const currentTMRow = await prisma.trainingMax.findFirst({
        where: {
          userId,
          exerciseId: exercise.id,
        },
        orderBy: { effectiveDate: 'desc' },
      });

      if (!currentTMRow) continue;

      const currentTMKg = currentTMRow.weight.toNumber();
      const newWeightKg = currentTMKg + increase;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create new TM row
      await prisma.trainingMax.upsert({
        where: {
          userId_exerciseId_effectiveDate: {
            userId,
            exerciseId: exercise.id,
            effectiveDate: today,
          },
        },
        update: { weight: newWeightKg },
        create: {
          userId,
          exerciseId: exercise.id,
          weight: newWeightKg,
          effectiveDate: today,
        },
      });

      logger.info('TM progression (plan-driven)', {
        exercise: exercise.slug,
        previousTM: currentTMKg,
        newTM: newWeightKg,
        increase,
      });

      progressions.push({
        exercise: exercise.name,
        previousTM: currentTMKg,
        newTM: newWeightKg,
        increase,
      });
    }

    // Mark workout completed
    const completed = await prisma.workout.update({
      where: { id: workoutId },
      data: { status: 'completed', completedAt: new Date() },
      include: {
        sets: {
          orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
          include: { exercise: true }
        }
      },
    });

    logger.info('Workout completed', {
      workoutId,
      dayNumber: workout.dayNumber,
      userId,
      progressionCount: progressions.length,
    });

    return { workout: formatWorkout(completed), progressions };
  }

  // No plan day ID - this workout was created without a plan (legacy data)
  // Mark it as completed without progression
  const completed = await prisma.workout.update({
    where: { id: workoutId },
    data: { status: 'completed', completedAt: new Date() },
    include: {
      sets: {
        orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
        include: { exercise: true }
      }
    },
  });

  logger.info('Workout completed (no plan)', { workoutId, dayNumber: workout.dayNumber, userId });

  return { workout: formatWorkout(completed), progressions: [] };
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
      include: {
        sets: {
          orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
          include: { exercise: true }
        }
      },
    }),
    prisma.workout.count({
      where: { userId, status: 'completed' },
    }),
  ]);

  return {
    workouts: workouts.map((w) => formatWorkout(w)),
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

  if (workout.status === 'discarded') {
    throw new Error('CONFLICT: Workout is already discarded');
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
