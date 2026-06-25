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

  const [trainingMaxes, workouts, plans, achievements, friendships, feedEvents, feedComments, feedReactions] =
    await Promise.all([
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
        include: {
          plan: { select: { name: true } },
          schedule: { select: { dayNumber: true, weekday: true }, orderBy: { dayNumber: 'asc' } },
        },
        orderBy: { startedAt: 'asc' },
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        orderBy: { unlockedAt: 'asc' },
      }),
      prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        include: {
          requester: { select: { username: true } },
          addressee: { select: { username: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.feedEvent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.feedEventComment.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.feedEventReaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    trainingMaxes: trainingMaxes.map((tm) => ({
      exercise: tm.exercise.slug,
      exerciseName: tm.exercise.name,
      weight: Number(tm.weight),
      previousWeight: tm.previousWeight === null ? null : Number(tm.previousWeight),
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
      schedule: p.schedule.map((s) => ({ dayNumber: s.dayNumber, weekday: s.weekday })),
    })),
    achievements: achievements.map((a) => ({ slug: a.slug, unlockedAt: a.unlockedAt })),
    friendships: friendships.map((f) => ({
      requester: f.requester.username,
      addressee: f.addressee.username,
      status: f.status,
      createdAt: f.createdAt,
    })),
    feedEvents: feedEvents.map((e) => ({
      eventType: e.eventType,
      payload: e.payload,
      createdAt: e.createdAt,
    })),
    feedComments: feedComments.map((c) => ({ text: c.text, createdAt: c.createdAt })),
    feedReactions: feedReactions.map((r) => ({ emoji: r.emoji, createdAt: r.createdAt })),
  };
}
