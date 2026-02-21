import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

// ---------------------------------------------------------------------------
// Shared plan setup: minimal 1-day plan using bench-press
// ---------------------------------------------------------------------------

async function createSharedPlan(planSlug: string): Promise<{
  planId: number;
  benchExId: number;
  squatExId: number;
  ohpExId: number;
  deadliftExId: number;
}> {
  const exercises = await prisma.exercise.findMany({
    where: { slug: { in: ['bench-press', 'squat', 'ohp', 'deadlift'] } },
  });
  const benchEx = exercises.find((e) => e.slug === 'bench-press')!;
  const squatEx = exercises.find((e) => e.slug === 'squat')!;
  const ohpEx = exercises.find((e) => e.slug === 'ohp')!;
  const deadliftEx = exercises.find((e) => e.slug === 'deadlift')!;

  const plan = await prisma.workoutPlan.create({
    data: {
      slug: planSlug,
      name: `Feed Events Test Plan ${planSlug}`,
      description: 'Test plan for feed event integration tests',
      daysPerWeek: 1,
      isPublic: true,
      isSystem: false,
    },
  });

  // Progression rules
  await prisma.planProgressionRule.createMany({
    data: [
      { planId: plan.id, category: 'upper', minReps: 0, maxReps: 1, increase: 0 },
      { planId: plan.id, category: 'upper', minReps: 2, maxReps: 99, increase: 2.5 },
      { planId: plan.id, category: 'lower', minReps: 0, maxReps: 1, increase: 0 },
      { planId: plan.id, category: 'lower', minReps: 2, maxReps: 99, increase: 5 },
    ],
  });

  // Day 1: Bench (9 sets, last is AMRAP progression at 65%)
  const day1 = await prisma.planDay.create({
    data: { planId: plan.id, dayNumber: 1, name: 'Bench Day' },
  });

  const day1BenchEx = await prisma.planDayExercise.create({
    data: {
      planDayId: day1.id,
      exerciseId: benchEx.id,
      tmExerciseId: benchEx.id,
      sortOrder: 1,
      displayName: 'Bench Volume',
    },
  });

  const day1BenchSets = [
    { percentage: 0.65, reps: 8, isAmrap: false, isProgression: false },
    { percentage: 0.75, reps: 6, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
    { percentage: 0.80, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.75, reps: 6, isAmrap: false, isProgression: false },
    { percentage: 0.70, reps: 7, isAmrap: false, isProgression: false },
    { percentage: 0.65, reps: 8, isAmrap: true, isProgression: true },
  ];
  for (let i = 0; i < day1BenchSets.length; i++) {
    await prisma.planSet.create({
      data: { planDayExerciseId: day1BenchEx.id, setOrder: i + 1, ...day1BenchSets[i]! },
    });
  }

  return {
    planId: plan.id,
    benchExId: benchEx.id,
    squatExId: squatEx.id,
    ohpExId: ohpEx.id,
    deadliftExId: deadliftEx.id,
  };
}

async function registerUser(emailPrefix: string): Promise<{ token: string; userId: number }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `${emailPrefix}-${uid}@example.com`,
      password: 'password123',
      displayName: `Feed Test User ${emailPrefix}`,
    });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, userId: res.body.user.id };
}

async function subscribeToPlan(token: string, planId: number): Promise<void> {
  const res = await request(app)
    .post(`/api/plans/${planId}/subscribe`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
}

async function setupTMs(
  token: string,
  benchExId: number,
  squatExId: number,
  ohpExId: number,
  deadliftExId: number,
): Promise<void> {
  const res = await request(app)
    .post('/api/training-maxes/setup')
    .set('Authorization', `Bearer ${token}`)
    .send({
      exerciseTMs: [
        { exerciseId: benchExId, oneRepMax: 100 },
        { exerciseId: squatExId, oneRepMax: 140 },
        { exerciseId: ohpExId, oneRepMax: 60 },
        { exerciseId: deadliftExId, oneRepMax: 180 },
      ],
    });
  expect(res.status).toBe(201);
}

async function cancelCurrentWorkout(token: string): Promise<void> {
  const res = await request(app)
    .get('/api/workouts/current')
    .set('Authorization', `Bearer ${token}`);
  if (res.body?.id) {
    await request(app)
      .delete(`/api/workouts/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`);
  }
}

async function doWorkout(
  token: string,
  dayNumber: number,
  progressionReps?: number,
): Promise<{
  workoutId: number;
  newAchievements: Array<{ slug: string; name: string; description: string }>;
  progressions: unknown[];
}> {
  await cancelCurrentWorkout(token);

  const startRes = await request(app)
    .post('/api/workouts')
    .set('Authorization', `Bearer ${token}`)
    .send({ dayNumber });

  expect(startRes.status).toBe(201);
  const workoutId: number = startRes.body.id;
  const sets: Array<{ id: number; isProgression: boolean; prescribedReps: number }> = startRes.body.sets;

  if (progressionReps !== undefined) {
    const progressionSets = sets.filter((s) => s.isProgression);
    for (const s of progressionSets) {
      await request(app)
        .patch(`/api/workouts/${workoutId}/sets/${s.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualReps: progressionReps, completed: true });
    }
  }

  const completeRes = await request(app)
    .post(`/api/workouts/${workoutId}/complete`)
    .set('Authorization', `Bearer ${token}`);

  expect(completeRes.status).toBe(200);

  return {
    workoutId,
    newAchievements: completeRes.body.newAchievements ?? [],
    progressions: completeRes.body.progressions ?? [],
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('Workout Feed Events', () => {
  let sharedPlanId: number;
  let sharedBenchExId: number;
  let sharedSquatExId: number;
  let sharedOhpExId: number;
  let sharedDeadliftExId: number;

  beforeAll(async () => {
    const plan = await createSharedPlan(`feed-plan-${uid}`);
    sharedPlanId = plan.planId;
    sharedBenchExId = plan.benchExId;
    sharedSquatExId = plan.squatExId;
    sharedOhpExId = plan.ohpExId;
    sharedDeadliftExId = plan.deadliftExId;
  });

  // -------------------------------------------------------------------------
  describe('(a) badge_unlocked feed event on first workout', () => {
    let token: string;
    let userId: number;

    beforeAll(async () => {
      ({ token, userId } = await registerUser('feed-badge'));
      await subscribeToPlan(token, sharedPlanId);
      await setupTMs(token, sharedBenchExId, sharedSquatExId, sharedOhpExId, sharedDeadliftExId);
    });

    it('completing the first workout creates a badge_unlocked feed event with slug first-blood', async () => {
      await doWorkout(token, 1);

      const event = await prisma.feedEvent.findFirst({
        where: {
          userId,
          eventType: 'badge_unlocked',
          payload: { path: ['slug'], equals: 'first-blood' },
        },
      });

      expect(event).not.toBeNull();
      expect(event!.eventType).toBe('badge_unlocked');
      const payload = event!.payload as { slug: string; name: string; description: string };
      expect(payload.slug).toBe('first-blood');
      expect(typeof payload.name).toBe('string');
      expect(typeof payload.description).toBe('string');
    });

    it('does NOT create a second badge_unlocked for first-blood after a second workout', async () => {
      await doWorkout(token, 1);

      const events = await prisma.feedEvent.findMany({
        where: {
          userId,
          eventType: 'badge_unlocked',
          payload: { path: ['slug'], equals: 'first-blood' },
        },
      });

      // Should still be exactly 1 — no duplicate
      expect(events.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('(b) plan_switched feed event on subscribe', () => {
    let token: string;
    let userId: number;
    let planName: string;

    beforeAll(async () => {
      ({ token, userId } = await registerUser('feed-plansw'));
      // Get plan name before subscribing
      const plan = await prisma.workoutPlan.findUnique({ where: { id: sharedPlanId } });
      planName = plan!.name;
      await subscribeToPlan(token, sharedPlanId);
    });

    it('subscribing to a plan creates a plan_switched feed event with correct planName', async () => {
      const event = await prisma.feedEvent.findFirst({
        where: {
          userId,
          eventType: 'plan_switched',
        },
      });

      expect(event).not.toBeNull();
      expect(event!.eventType).toBe('plan_switched');
      const payload = event!.payload as { planId: number; planName: string; planSlug: string };
      expect(payload.planName).toBe(planName);
      expect(payload.planId).toBe(sharedPlanId);
      expect(typeof payload.planSlug).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  describe('(c) streak_milestone feed event at 7-day streak', () => {
    let token: string;
    let userId: number;

    beforeAll(async () => {
      ({ token, userId } = await registerUser('feed-streak'));
      await subscribeToPlan(token, sharedPlanId);
      await setupTMs(token, sharedBenchExId, sharedSquatExId, sharedOhpExId, sharedDeadliftExId);

      // Insert 6 prior completed workout rows directly (days -6 to -1 from today)
      for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
        const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        await prisma.workout.create({
          data: {
            userId,
            dayNumber: 1,
            status: 'completed',
            completedAt,
          },
        });
      }
    });

    it('completing a 7th consecutive workout creates a streak_milestone event with days: 7', async () => {
      // This API call completes today's workout (day 7 of the streak)
      await doWorkout(token, 1);

      const event = await prisma.feedEvent.findFirst({
        where: {
          userId,
          eventType: 'streak_milestone',
          payload: { path: ['days'], equals: 7 },
        },
      });

      expect(event).not.toBeNull();
      expect(event!.eventType).toBe('streak_milestone');
      const payload = event!.payload as { days: number };
      expect(payload.days).toBe(7);
    });
  });

  // -------------------------------------------------------------------------
  describe('(d) streak_milestone deduplication — no second event at same threshold', () => {
    let token: string;
    let userId: number;

    beforeAll(async () => {
      ({ token, userId } = await registerUser('feed-streakdedup'));
      await subscribeToPlan(token, sharedPlanId);
      await setupTMs(token, sharedBenchExId, sharedSquatExId, sharedOhpExId, sharedDeadliftExId);

      // Insert 6 prior completed workouts to set up a 6-day streak
      for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
        const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        await prisma.workout.create({
          data: {
            userId,
            dayNumber: 1,
            status: 'completed',
            completedAt,
          },
        });
      }

      // Complete the 7th workout — this should emit the streak_milestone
      await doWorkout(token, 1);
    });

    it('completing another workout at the same streak level does NOT create a second streak_milestone with days: 7', async () => {
      // Complete one more workout (still on the same day, so same streak)
      await doWorkout(token, 1);

      const events = await prisma.feedEvent.findMany({
        where: {
          userId,
          eventType: 'streak_milestone',
          payload: { path: ['days'], equals: 7 },
        },
      });

      // Must remain exactly 1 — no duplicate
      expect(events.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('(e) GET /api/social/feed returns badge_unlocked and streak_milestone events', () => {
    let tokenA: string;
    let tokenB: string;
    let userIdA: number;

    beforeAll(async () => {
      ({ token: tokenA, userId: userIdA } = await registerUser('feed-social-a'));
      const { token: tokenB2 } = await registerUser('feed-social-b');
      tokenB = tokenB2;

      // Make B friends with A (B sends request, A accepts)
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ email: `feed-social-a-${uid}@example.com` });
      expect(reqRes.status).toBe(201);

      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenA}`);

      // Create a badge_unlocked and streak_milestone feed event directly for A
      await prisma.feedEvent.createMany({
        data: [
          {
            userId: userIdA,
            eventType: 'badge_unlocked',
            payload: { slug: 'first-blood', name: 'First Blood', description: 'Complete your first workout' },
          },
          {
            userId: userIdA,
            eventType: 'streak_milestone',
            payload: { days: 7 },
          },
        ],
      });
    });

    it('feed returns badge_unlocked events from friends', async () => {
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const events: Array<{ eventType: string; userId: number }> = res.body.events;

      const badgeEvent = events.find(
        (e) => e.eventType === 'badge_unlocked' && e.userId === userIdA,
      );
      expect(badgeEvent).toBeDefined();
    });

    it('feed returns streak_milestone events from friends', async () => {
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const events: Array<{ eventType: string; userId: number; payload: unknown }> = res.body.events;

      const streakEvent = events.find(
        (e) => e.eventType === 'streak_milestone' && e.userId === userIdA,
      );
      expect(streakEvent).toBeDefined();
      expect((streakEvent!.payload as { days: number }).days).toBe(7);
    });

    it('feed events include displayName and payload', async () => {
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const badgeEvent = res.body.events.find(
        (e: { eventType: string; userId: number }) =>
          e.eventType === 'badge_unlocked' && e.userId === userIdA,
      );

      expect(badgeEvent).toBeDefined();
      expect(typeof badgeEvent.displayName).toBe('string');
      expect(badgeEvent.payload).toHaveProperty('slug', 'first-blood');
    });
  });
});
