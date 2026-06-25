import prisma from '../lib/db';

export interface ProgressExercise {
  slug: string;
  name: string;
  currentE1rm: number | null;
  history: Array<{
    e1rm: number;
    date: string;
  }>;
  inCurrentPlan: boolean;
}

export interface PlanSwitch {
  date: string;
  planName: string;
}

function computeE1rm(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export async function getProgress(
  userId: number,
): Promise<{ exercises: ProgressExercise[]; planSwitches: PlanSwitch[] }> {
  // 1. Get plan switches (unchanged logic)
  const allUserPlans = await prisma.userPlan.findMany({
    where: { userId },
    orderBy: { startedAt: 'asc' },
    include: { plan: { select: { name: true } } },
  });

  const planSwitches: PlanSwitch[] = allUserPlans.slice(1).map((up) => ({
    date: up.startedAt.toISOString(),
    planName: up.plan.name,
  }));

  // 2. Get current plan exercise IDs for the inCurrentPlan flag
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: {
      plan: {
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              exercises: {
                orderBy: { sortOrder: 'asc' },
                include: { tmExercise: true },
              },
            },
          },
        },
      },
    },
  });

  const currentPlanExerciseIds = new Set<number>();
  if (activePlan) {
    for (const day of activePlan.plan.days) {
      for (const ex of day.exercises) {
        currentPlanExerciseIds.add(ex.tmExerciseId);
      }
    }
  }

  // 3. Query all completed sets for this user
  const completedSets = await prisma.workoutSet.findMany({
    where: {
      workout: {
        userId,
        status: 'completed',
        completedAt: { not: null },
      },
      completed: true,
      actualReps: { not: null, gt: 0 },
    },
    select: {
      exerciseId: true,
      prescribedWeight: true,
      actualReps: true,
      workout: {
        select: { completedAt: true },
      },
      exercise: {
        select: { id: true, slug: true, name: true },
      },
    },
    orderBy: {
      workout: { completedAt: 'asc' },
    },
  });

  // Group by exercise -> date -> best e1RM
  const exerciseMap = new Map<
    number,
    {
      slug: string;
      name: string;
      historyByDate: Map<string, number>;
    }
  >();

  for (const set of completedSets) {
    const exerciseId = set.exerciseId;
    const weight = set.prescribedWeight.toNumber();
    const reps = set.actualReps as number;
    const e1rm = computeE1rm(weight, reps);
    const dateKey = (set.workout.completedAt as Date)
      .toISOString()
      .split('T')[0]!;

    if (!exerciseMap.has(exerciseId)) {
      exerciseMap.set(exerciseId, {
        slug: set.exercise.slug,
        name: set.exercise.name,
        historyByDate: new Map(),
      });
    }

    const entry = exerciseMap.get(exerciseId)!;
    const existing = entry.historyByDate.get(dateKey) ?? 0;
    if (e1rm > existing) {
      entry.historyByDate.set(dateKey, e1rm);
    }
  }

  // Build response: current plan exercises first (in plan order), then others alphabetically
  const exercises: ProgressExercise[] = [];
  const addedIds = new Set<number>();

  // Add current plan exercises first (in plan order)
  if (activePlan) {
    const seen = new Set<number>();
    for (const day of activePlan.plan.days) {
      for (const ex of day.exercises) {
        if (seen.has(ex.tmExerciseId)) continue;
        seen.add(ex.tmExerciseId);

        const data = exerciseMap.get(ex.tmExerciseId);
        if (!data) continue;

        const history = Array.from(data.historyByDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, e1rm]) => ({
            e1rm: Math.round(e1rm * 100) / 100,
            date,
          }));

        exercises.push({
          slug: data.slug,
          name: data.name,
          currentE1rm:
            history.length > 0 ? history[history.length - 1]!.e1rm : null,
          history,
          inCurrentPlan: true,
        });
        addedIds.add(ex.tmExerciseId);
      }
    }
  }

  // Add non-plan exercises (alphabetically by name)
  const nonPlanExercises = Array.from(exerciseMap.entries())
    .filter(([id]) => !addedIds.has(id))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));

  for (const [, data] of nonPlanExercises) {
    const history = Array.from(data.historyByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e1rm]) => ({ e1rm: Math.round(e1rm * 100) / 100, date }));

    exercises.push({
      slug: data.slug,
      name: data.name,
      currentE1rm:
        history.length > 0 ? history[history.length - 1]!.e1rm : null,
      history,
      inCurrentPlan: false,
    });
  }

  return { exercises, planSwitches };
}

export interface PersonalRecord {
  slug: string;
  name: string;
  e1rm: number;
  weight: number;
  reps: number;
  date: string;
}

// Best estimated-1RM set per exercise across all completed sets (one PR per lift,
// strongest first). e1RM lets a heavy triple and a lighter set-of-ten be compared
// on one scale. Ties resolve to the earliest date it was first achieved.
export async function getPersonalRecords(userId: number): Promise<PersonalRecord[]> {
  const completedSets = await prisma.workoutSet.findMany({
    where: {
      workout: { userId, status: 'completed', completedAt: { not: null } },
      completed: true,
      actualReps: { not: null, gt: 0 },
    },
    select: {
      prescribedWeight: true,
      actualReps: true,
      workout: { select: { completedAt: true } },
      exercise: { select: { id: true, slug: true, name: true } },
    },
    orderBy: { workout: { completedAt: 'asc' } },
  });

  const best = new Map<number, PersonalRecord>();
  for (const set of completedSets) {
    const weight = set.prescribedWeight.toNumber();
    const reps = set.actualReps as number;
    const e1rm = computeE1rm(weight, reps);
    const existing = best.get(set.exercise.id);
    if (!existing || e1rm > existing.e1rm) {
      best.set(set.exercise.id, {
        slug: set.exercise.slug,
        name: set.exercise.name,
        e1rm: Math.round(e1rm * 100) / 100,
        weight,
        reps,
        date: (set.workout.completedAt as Date).toISOString(),
      });
    }
  }

  return [...best.values()].sort((a, b) => b.e1rm - a.e1rm);
}
