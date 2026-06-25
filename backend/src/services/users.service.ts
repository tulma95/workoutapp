import prisma from '../lib/db';

// Aggregates everything a user owns into a portable JSON structure for GDPR
// data export. Read-only; weights are emitted as plain numbers (not Prisma
// Decimal objects) and exercises by slug + display name.
export async function exportUserData(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, isAdmin: true, createdAt: true },
  });
  if (!user) {
    throw new Error('User not found');
  }

  const [trainingMaxes, workouts, plans, achievements] = await Promise.all([
    prisma.trainingMax.findMany({
      where: { userId },
      include: { exercise: { select: { slug: true, name: true } } },
      orderBy: { effectiveDate: 'asc' },
    }),
    prisma.workout.findMany({
      where: { userId },
      include: {
        sets: {
          include: { exercise: { select: { slug: true, name: true } } },
          orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.userPlan.findMany({
      where: { userId },
      include: { plan: { select: { name: true } } },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'asc' },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    trainingMaxes: trainingMaxes.map((tm) => ({
      exercise: tm.exercise.slug,
      exerciseName: tm.exercise.name,
      weight: Number(tm.weight),
      effectiveDate: tm.effectiveDate,
      reason: tm.reason,
    })),
    workouts: workouts.map((w) => ({
      dayNumber: w.dayNumber,
      status: w.status,
      completedAt: w.completedAt,
      createdAt: w.createdAt,
      sets: w.sets.map((s) => ({
        exercise: s.exercise.slug,
        exerciseName: s.exercise.name,
        prescribedWeight: Number(s.prescribedWeight),
        prescribedReps: s.prescribedReps,
        actualReps: s.actualReps,
        completed: s.completed,
        isAmrap: s.isAmrap,
        isProgression: s.isProgression,
      })),
    })),
    plans: plans.map((p) => ({
      planName: p.plan.name,
      isActive: p.isActive,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
    })),
    achievements: achievements.map((a) => ({ slug: a.slug, unlockedAt: a.unlockedAt })),
  };
}
