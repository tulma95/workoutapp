import type { Decimal } from '@prisma/client/runtime/client';
import prisma from '../lib/db';
import { roundWeight } from '../lib/weightRounding';
import type { WorkoutStatus } from '../types';
import { ExistingWorkoutError } from '../types';
import { logger } from '../lib/logger';
import { checkAndUnlockAchievements } from './achievement.service';
import { calculateStreak } from '../lib/streak';

export type ScheduledDay = {
  date: string;
  dayNumber: number;
  planDayName: string | null;
};

function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


function formatWorkout(
  workout: {
    id: number;
    userId: number;
    dayNumber: number;
    planDayId: number | null;
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
    isCustom: workout.planDayId === null,
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
      },
      progressions: {
        include: { exercise: true },
      },
    },
  });

  if (!workout) return null;

  const progressions = workout.progressions.map((tm) => ({
    exercise: tm.exercise.name,
    previousTM: tm.previousWeight ? tm.previousWeight.toNumber() : tm.weight.toNumber(),
    newTM: tm.weight.toNumber(),
    increase: tm.previousWeight
      ? tm.weight.toNumber() - tm.previousWeight.toNumber()
      : 0,
  }));

  return { ...formatWorkout(workout), progressions };
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

    // Batch-fetch current TMs for all progression exercises before the loop
    const progressionExerciseIds = new Set(progressionSets.map((s) => s.exerciseId));
    const tmRows = await prisma.trainingMax.findMany({
      where: { userId, exerciseId: { in: [...progressionExerciseIds] } },
      orderBy: { effectiveDate: 'desc' },
    });
    const tmByExerciseId = new Map<number, (typeof tmRows)[number]>();
    for (const row of tmRows) {
      if (!tmByExerciseId.has(row.exerciseId)) {
        tmByExerciseId.set(row.exerciseId, row);
      }
    }

    // Compute all TM increases to apply (reads only, no writes yet)
    type ProgressionWrite = {
      exerciseId: number;
      exerciseName: string;
      exerciseSlug: string;
      currentTM: number;
      newTM: number;
      increase: number;
    };
    const progressionWrites: ProgressionWrite[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const progressionSet of progressionSets) {
      const actualReps = progressionSet.actualReps;
      if (actualReps == null) continue;

      // Exercise is already included via workout.sets include
      const exercise = progressionSet.exercise;

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

      // Get current TM for this exercise from pre-fetched batch
      const currentTMRow = tmByExerciseId.get(exercise.id);
      if (!currentTMRow) continue;

      progressionWrites.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseSlug: exercise.slug,
        currentTM: currentTMRow.weight.toNumber(),
        newTM: currentTMRow.weight.toNumber() + increase,
        increase,
      });
    }

    // Precompute sets data for achievement checking (outside tx for efficiency)
    const setsForAchievements = workout.sets.map((s) => ({
      prescribedWeight: s.prescribedWeight.toNumber(),
      actualReps: s.actualReps,
      prescribedReps: s.prescribedReps,
      isProgression: s.isProgression ?? false,
    }));

    // Wrap all writes (TM upserts + workout status update + feed events + achievements) in a single transaction
    const { completed, progressions, newAchievements } = await prisma.$transaction(async (tx) => {
      const progressions: Array<{
        exercise: string;
        previousTM: number;
        newTM: number;
        increase: number;
      }> = [];

      for (const pw of progressionWrites) {
        await tx.trainingMax.upsert({
          where: {
            userId_exerciseId_effectiveDate: {
              userId,
              exerciseId: pw.exerciseId,
              effectiveDate: today,
            },
          },
          update: { weight: pw.newTM, previousWeight: pw.currentTM, workoutId },
          create: {
            userId,
            exerciseId: pw.exerciseId,
            weight: pw.newTM,
            previousWeight: pw.currentTM,
            workoutId,
            effectiveDate: today,
          },
        });

        logger.info('TM progression (plan-driven)', {
          exercise: pw.exerciseSlug,
          previousTM: pw.currentTM,
          newTM: pw.newTM,
          increase: pw.increase,
        });

        progressions.push({
          exercise: pw.exerciseName,
          previousTM: pw.currentTM,
          newTM: pw.newTM,
          increase: pw.increase,
        });
      }

      const completed = await tx.workout.update({
        where: { id: workoutId },
        data: { status: 'completed', completedAt: new Date() },
        include: {
          sets: {
            orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
            include: { exercise: true }
          }
        },
      });

      // Create workout_completed feed event
      await tx.feedEvent.createMany({
        data: [{
          userId,
          eventType: 'workout_completed',
          payload: { workoutId, dayNumber: workout.dayNumber },
        }],
      });

      // Create tm_increased feed events (one per TM progression)
      if (progressionWrites.length > 0) {
        await tx.feedEvent.createMany({
          data: progressionWrites.map((pw) => ({
            userId,
            eventType: 'tm_increased',
            payload: {
              exerciseSlug: pw.exerciseSlug,
              exerciseName: pw.exerciseName,
              newTM: pw.newTM,
              increase: pw.increase,
            },
          })),
        });
      }

      // Calculate streak and emit streak_milestone if threshold crossed
      const completedWorkouts = await tx.workout.findMany({
        where: { userId, status: 'completed' },
        select: { completedAt: true },
      });
      const dates = completedWorkouts
        .filter((w) => w.completedAt !== null)
        .map((w) => w.completedAt!.toISOString().slice(0, 10));
      const streak = calculateStreak(dates);
      const STREAK_MILESTONES = [7, 14, 30, 60, 90];
      for (const threshold of STREAK_MILESTONES) {
        if (streak >= threshold) {
          const existing = await tx.feedEvent.findFirst({
            where: {
              userId,
              eventType: 'streak_milestone',
              payload: { path: ['days'], equals: threshold },
            },
          });
          if (!existing) {
            await tx.feedEvent.create({
              data: {
                userId,
                eventType: 'streak_milestone',
                payload: { days: threshold },
              },
            });
          }
        }
      }

      const newAchievements = await checkAndUnlockAchievements(tx, userId, workoutId, setsForAchievements);

      // Create badge_unlocked feed events
      if (newAchievements.length > 0) {
        await tx.feedEvent.createMany({
          data: newAchievements.map((a) => ({
            userId,
            eventType: 'badge_unlocked',
            payload: { slug: a.slug, name: a.name, description: a.description },
          })),
        });
      }

      return { completed, progressions, newAchievements };
    });

    logger.info('Workout completed', {
      workoutId,
      dayNumber: workout.dayNumber,
      userId,
      progressionCount: progressions.length,
      achievementCount: newAchievements.length,
    });

    return { workout: formatWorkout(completed), progressions, newAchievements };
  }

  // No plan day ID - this workout was created without a plan (legacy data)
  // Mark it as completed without progression
  const noPlansetsForAchievements = workout.sets.map((s) => ({
    prescribedWeight: s.prescribedWeight.toNumber(),
    actualReps: s.actualReps,
    prescribedReps: s.prescribedReps,
    isProgression: s.isProgression ?? false,
  }));

  const { completed: noPlanCompleted, newAchievements: noPlanAchievements } = await prisma.$transaction(async (tx) => {
    const completed = await tx.workout.update({
      where: { id: workoutId },
      data: { status: 'completed', completedAt: new Date() },
      include: {
        sets: {
          orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
          include: { exercise: true }
        }
      },
    });

    // Calculate streak and emit streak_milestone if threshold crossed
    const completedWorkouts = await tx.workout.findMany({
      where: { userId, status: 'completed' },
      select: { completedAt: true },
    });
    const dates = completedWorkouts
      .filter((w) => w.completedAt !== null)
      .map((w) => w.completedAt!.toISOString().slice(0, 10));
    const streak = calculateStreak(dates);
    const STREAK_MILESTONES = [7, 14, 30, 60, 90];
    for (const threshold of STREAK_MILESTONES) {
      if (streak >= threshold) {
        const existing = await tx.feedEvent.findFirst({
          where: {
            userId,
            eventType: 'streak_milestone',
            payload: { path: ['days'], equals: threshold },
          },
        });
        if (!existing) {
          await tx.feedEvent.create({
            data: {
              userId,
              eventType: 'streak_milestone',
              payload: { days: threshold },
            },
          });
        }
      }
    }

    const newAchievements = await checkAndUnlockAchievements(tx, userId, workoutId, noPlansetsForAchievements);

    // Create badge_unlocked feed events
    if (newAchievements.length > 0) {
      await tx.feedEvent.createMany({
        data: newAchievements.map((a) => ({
          userId,
          eventType: 'badge_unlocked',
          payload: { slug: a.slug, name: a.name, description: a.description },
        })),
      });
    }

    return { completed, newAchievements };
  });

  logger.info('Workout completed (no plan)', { workoutId, dayNumber: workout.dayNumber, userId });

  return { workout: formatWorkout(noPlanCompleted), progressions: [], newAchievements: noPlanAchievements };
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

export type CustomWorkoutPayload = {
  date: string;
  exercises: Array<{
    exerciseId: number;
    sets: Array<{ weight: number; reps: number }>;
  }>;
};

export async function createCustomWorkout(userId: number, payload: CustomWorkoutPayload) {
  // Parse and validate date
  const workoutDate = new Date(`${payload.date}T12:00:00`);
  if (isNaN(workoutDate.getTime())) {
    throw new Error('BAD_REQUEST: Invalid date');
  }

  // Validate all exerciseIds exist
  const exerciseIds = payload.exercises.map((e) => e.exerciseId);
  const uniqueIds = [...new Set(exerciseIds)];
  const foundExercises = await prisma.exercise.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (foundExercises.length !== uniqueIds.length) {
    throw new Error('BAD_REQUEST: One or more exercise IDs are invalid');
  }

  const workout = await prisma.$transaction(async (tx) => {
    const w = await tx.workout.create({
      data: {
        userId,
        dayNumber: 0,
        planDayId: null,
        status: 'completed',
        completedAt: workoutDate,
        createdAt: workoutDate,
      },
    });

    let exerciseOrder = 0;
    for (const exercise of payload.exercises) {
      exerciseOrder++;
      let setOrder = 0;
      for (const set of exercise.sets) {
        setOrder++;
        await tx.workoutSet.create({
          data: {
            workoutId: w.id,
            exerciseId: exercise.exerciseId,
            exerciseOrder,
            setOrder,
            prescribedWeight: set.weight,
            prescribedReps: set.reps,
            actualReps: set.reps,
            isAmrap: false,
            isProgression: false,
            completed: true,
          },
        });
      }
    }

    await tx.feedEvent.create({
      data: {
        userId,
        eventType: 'workout_completed',
        payload: { workoutId: w.id, dayNumber: 0, isCustom: true },
      },
    });

    return tx.workout.findUniqueOrThrow({
      where: { id: w.id },
      include: {
        sets: {
          orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
          include: { exercise: true },
        },
      },
    });
  });

  logger.info('Custom workout created', { userId, workoutId: workout.id, date: payload.date });
  return formatWorkout(workout);
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
      planDayId: true,
      status: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Build set of occupied dates from ALL workouts (any status) including discarded
  const allWorkoutsInMonth = await prisma.workout.findMany({
    where: {
      userId,
      OR: [
        { completedAt: { gte: startDate, lt: endDate } },
        { completedAt: null, createdAt: { gte: startDate, lt: endDate } },
      ],
    },
    select: { completedAt: true, createdAt: true },
  });

  const occupiedDates = new Set<string>();
  for (const w of allWorkoutsInMonth) {
    const d = w.completedAt ?? w.createdAt;
    occupiedDates.add(formatDateLocal(d));
  }

  // Fetch active plan's schedule with PlanDay names
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: {
      schedule: true,
      plan: {
        include: {
          days: {
            select: { dayNumber: true, name: true },
          },
        },
      },
    },
  });

  const scheduledDays: ScheduledDay[] = [];
  if (activePlan && activePlan.schedule.length > 0) {
    // Build dayNumber -> planDayName map
    const dayNameMap = new Map<number, string | null>();
    for (const planDay of activePlan.plan.days) {
      dayNameMap.set(planDay.dayNumber, planDay.name);
    }

    for (const scheduleRow of activePlan.schedule) {
      const { dayNumber, weekday } = scheduleRow;
      const planDayName = dayNameMap.get(dayNumber) ?? null;

      // Find first occurrence of weekday in the month
      const firstDayWeekday = startDate.getDay(); // 0=Sun...6=Sat
      const offset = (weekday - firstDayWeekday + 7) % 7;
      let currentDate = new Date(year, month - 1, 1 + offset);

      while (currentDate < endDate) {
        const dateStr = formatDateLocal(currentDate);
        if (!occupiedDates.has(dateStr)) {
          scheduledDays.push({ date: dateStr, dayNumber, planDayName });
        }
        // Advance to same weekday next week
        currentDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 7,
        );
      }
    }
  }

  return {
    workouts: workouts.map((w) => ({ ...w, isCustom: w.planDayId === null })),
    scheduledDays,
  };
}
