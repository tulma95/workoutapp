import prisma from '../lib/db';

export interface ProgressExercise {
  slug: string;
  name: string;
  currentTM: number | null;
  history: Array<{
    weight: number;
    effectiveDate: string;
    previousWeight: number | null;
  }>;
}

export async function getProgress(userId: number): Promise<{ exercises: ProgressExercise[] }> {
  // Find active plan with all plan day exercises and their TM exercise references
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

  if (!activePlan) {
    return { exercises: [] };
  }

  // Extract unique TM exercises in plan day order (by first appearance)
  const seenIds = new Set<number>();
  const tmExercises: Array<{ id: number; slug: string; name: string }> = [];
  for (const day of activePlan.plan.days) {
    for (const ex of day.exercises) {
      if (!seenIds.has(ex.tmExerciseId)) {
        seenIds.add(ex.tmExerciseId);
        tmExercises.push({
          id: ex.tmExercise.id,
          slug: ex.tmExercise.slug,
          name: ex.tmExercise.name,
        });
      }
    }
  }

  if (tmExercises.length === 0) {
    return { exercises: [] };
  }

  // Fetch all TM history for these exercises in one query, ordered desc by effectiveDate
  const allTMs = await prisma.trainingMax.findMany({
    where: {
      userId,
      exerciseId: { in: tmExercises.map((e) => e.id) },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  // Group TM rows by exerciseId
  const tmsByExercise = new Map<number, typeof allTMs>();
  for (const tm of allTMs) {
    const list = tmsByExercise.get(tm.exerciseId) ?? [];
    list.push(tm);
    tmsByExercise.set(tm.exerciseId, list);
  }

  // Build response preserving plan day order
  const exercises: ProgressExercise[] = tmExercises.map((ex) => {
    const history = tmsByExercise.get(ex.id) ?? [];
    const latest = history[0];
    const currentTM = latest != null ? latest.weight.toNumber() : null;

    return {
      slug: ex.slug,
      name: ex.name,
      currentTM,
      history: history.map((tm) => ({
        weight: tm.weight.toNumber(),
        effectiveDate: tm.effectiveDate.toISOString(),
        previousWeight: tm.previousWeight != null ? tm.previousWeight.toNumber() : null,
      })),
    };
  });

  return { exercises };
}
