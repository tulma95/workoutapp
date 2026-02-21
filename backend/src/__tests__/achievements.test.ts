import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

// ---------------------------------------------------------------------------
// Shared plan setup: create a minimal nSuns-like plan with 4 days so we can
// complete multiple workouts for the consistent-lifter test.
// Day 1: Bench (9 sets, last is AMRAP progression at 65%), OHP (8 sets)
// Days 2-4: Squat / Deadlift / OHP simple structures to fill out the loop.
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
      name: `Achievement Test Plan ${planSlug}`,
      description: 'Test plan for achievement integration tests',
      daysPerWeek: 4,
      isPublic: true,
      isSystem: false,
    },
  });

  // Progression rules (upper: +2.5kg for any reps, lower: +5kg)
  await prisma.planProgressionRule.createMany({
    data: [
      { planId: plan.id, category: 'upper', minReps: 0, maxReps: 1, increase: 0 },
      { planId: plan.id, category: 'upper', minReps: 2, maxReps: 99, increase: 2.5 },
      { planId: plan.id, category: 'lower', minReps: 0, maxReps: 1, increase: 0 },
      { planId: plan.id, category: 'lower', minReps: 2, maxReps: 99, increase: 5 },
    ],
  });

  // ---- Day 1: Bench Volume (9 sets) + OHP (1 filler set) ----
  const day1 = await prisma.planDay.create({
    data: { planId: plan.id, dayNumber: 1, name: 'Bench Volume & OHP' },
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

  // nSuns Day 1 bench sets — last set is AMRAP progression at 65% (prescribedReps=8)
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

  const day1OhpEx = await prisma.planDayExercise.create({
    data: {
      planDayId: day1.id,
      exerciseId: ohpEx.id,
      tmExerciseId: ohpEx.id,
      sortOrder: 2,
    },
  });
  await prisma.planSet.create({
    data: { planDayExerciseId: day1OhpEx.id, setOrder: 1, percentage: 0.5, reps: 5, isAmrap: false, isProgression: false },
  });

  // ---- Day 2: Squat (1 progression set) ----
  const day2 = await prisma.planDay.create({
    data: { planId: plan.id, dayNumber: 2, name: 'Squat' },
  });
  const day2SquatEx = await prisma.planDayExercise.create({
    data: {
      planDayId: day2.id,
      exerciseId: squatEx.id,
      tmExerciseId: squatEx.id,
      sortOrder: 1,
    },
  });
  await prisma.planSet.createMany({
    data: [
      { planDayExerciseId: day2SquatEx.id, setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
      { planDayExerciseId: day2SquatEx.id, setOrder: 2, percentage: 0.85, reps: 3, isAmrap: true, isProgression: true },
    ],
  });

  // ---- Day 3: Bench Heavy (1 progression set) ----
  const day3 = await prisma.planDay.create({
    data: { planId: plan.id, dayNumber: 3, name: 'Bench Heavy' },
  });
  const day3BenchEx = await prisma.planDayExercise.create({
    data: {
      planDayId: day3.id,
      exerciseId: benchEx.id,
      tmExerciseId: benchEx.id,
      sortOrder: 1,
      displayName: 'Bench Heavy',
    },
  });
  await prisma.planSet.createMany({
    data: [
      { planDayExerciseId: day3BenchEx.id, setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
      { planDayExerciseId: day3BenchEx.id, setOrder: 2, percentage: 0.90, reps: 3, isAmrap: true, isProgression: true },
    ],
  });

  // ---- Day 4: Deadlift (1 progression set) ----
  const day4 = await prisma.planDay.create({
    data: { planId: plan.id, dayNumber: 4, name: 'Deadlift' },
  });
  const day4DeadliftEx = await prisma.planDayExercise.create({
    data: {
      planDayId: day4.id,
      exerciseId: deadliftEx.id,
      tmExerciseId: deadliftEx.id,
      sortOrder: 1,
    },
  });
  await prisma.planSet.createMany({
    data: [
      { planDayExerciseId: day4DeadliftEx.id, setOrder: 1, percentage: 0.70, reps: 5, isAmrap: false, isProgression: false },
      { planDayExerciseId: day4DeadliftEx.id, setOrder: 2, percentage: 0.85, reps: 3, isAmrap: true, isProgression: true },
    ],
  });

  return {
    planId: plan.id,
    benchExId: benchEx.id,
    squatExId: squatEx.id,
    ohpExId: ohpEx.id,
    deadliftExId: deadliftEx.id,
  };
}

async function registerAndSetup(
  emailPrefix: string,
  planId: number,
  benchExId: number,
  squatExId: number,
  ohpExId: number,
  deadliftExId: number,
  benchTM = 100,
): Promise<{ token: string; userId: number }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `${emailPrefix}-${uid}@example.com`,
      password: 'password123',
      username: `ach_${emailPrefix.replace(/-/g, '_')}_${uid}`,
    });
  const token: string = res.body.accessToken;
  const userId: number = res.body.user.id;

  // Subscribe to plan
  await request(app)
    .post(`/api/plans/${planId}/subscribe`)
    .set('Authorization', `Bearer ${token}`);

  // Set up TMs (benchTM controls bench training max; high value triggers century-club)
  await request(app)
    .post('/api/training-maxes/setup')
    .set('Authorization', `Bearer ${token}`)
    .send({
      exerciseTMs: [
        { exerciseId: benchExId, oneRepMax: benchTM },      // TM = benchTM * 0.9
        { exerciseId: squatExId, oneRepMax: 140 },
        { exerciseId: ohpExId, oneRepMax: 60 },
        { exerciseId: deadliftExId, oneRepMax: 180 },
      ],
    });

  return { token, userId };
}

// Helper: cancel any in-progress workout for a user before starting a new one.
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

// Helper: start a workout, log `actualReps` on each progression set, then complete it.
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

describe('Achievements API', () => {
  let sharedPlanId: number;
  let sharedBenchExId: number;
  let sharedSquatExId: number;
  let sharedOhpExId: number;
  let sharedDeadliftExId: number;

  beforeAll(async () => {
    const plan = await createSharedPlan(`ach-plan-${uid}`);
    sharedPlanId = plan.planId;
    sharedBenchExId = plan.benchExId;
    sharedSquatExId = plan.squatExId;
    sharedOhpExId = plan.ohpExId;
    sharedDeadliftExId = plan.deadliftExId;
  });

  // -------------------------------------------------------------------------
  describe('first-blood achievement', () => {
    let token: string;

    beforeAll(async () => {
      ({ token } = await registerAndSetup(
        'ach-fb',
        sharedPlanId,
        sharedBenchExId,
        sharedSquatExId,
        sharedOhpExId,
        sharedDeadliftExId,
      ));
    });

    it('does NOT include first-blood before any workout is completed', async () => {
      const achievementsRes = await request(app)
        .get('/api/achievements')
        .set('Authorization', `Bearer ${token}`);

      expect(achievementsRes.status).toBe(200);
      const firstBlood = achievementsRes.body.achievements.find(
        (a: { slug: string }) => a.slug === 'first-blood',
      );
      expect(firstBlood).toBeDefined();
      expect(firstBlood.unlockedAt).toBeNull();
    });

    it('returns first-blood in newAchievements after the first completed workout', async () => {
      const { newAchievements } = await doWorkout(token, 1);

      const slugs = newAchievements.map((a) => a.slug);
      expect(slugs).toContain('first-blood');
    });

    it('does NOT return first-blood again on subsequent completions', async () => {
      const { newAchievements } = await doWorkout(token, 2);

      const slugs = newAchievements.map((a) => a.slug);
      expect(slugs).not.toContain('first-blood');
    });
  });

  // -------------------------------------------------------------------------
  describe('century-club achievement', () => {
    let token: string;

    beforeAll(async () => {
      // bench oneRepMax = 200 → TM = 180 kg. Day 1 first set is 65% = 117 kg > 100 kg.
      ({ token } = await registerAndSetup(
        'ach-cc',
        sharedPlanId,
        sharedBenchExId,
        sharedSquatExId,
        sharedOhpExId,
        sharedDeadliftExId,
        200,
      ));
    });

    it('returns century-club in newAchievements when a set weight >= 100 kg', async () => {
      const { newAchievements } = await doWorkout(token, 1);

      const slugs = newAchievements.map((a) => a.slug);
      expect(slugs).toContain('century-club');
    });
  });

  // -------------------------------------------------------------------------
  describe('amrap-king achievement', () => {
    let token: string;

    beforeAll(async () => {
      ({ token } = await registerAndSetup(
        'ach-ak',
        sharedPlanId,
        sharedBenchExId,
        sharedSquatExId,
        sharedOhpExId,
        sharedDeadliftExId,
      ));
    });

    it('returns amrap-king when progression set beaten by 5+ reps', async () => {
      // Day 1 AMRAP progression set has prescribedReps=8; submitting 13 = 8+5 qualifies.
      const { newAchievements } = await doWorkout(token, 1, 13);

      const slugs = newAchievements.map((a) => a.slug);
      expect(slugs).toContain('amrap-king');
    });

    it('does NOT return amrap-king when progression set beaten by only 4 reps', async () => {
      const { token: token2 } = await registerAndSetup(
        'ach-ak2',
        sharedPlanId,
        sharedBenchExId,
        sharedSquatExId,
        sharedOhpExId,
        sharedDeadliftExId,
      );

      // prescribedReps=8, actual=12 → 12-8=4, NOT >= 5, should not unlock
      const { newAchievements } = await doWorkout(token2, 1, 12);

      const slugs = newAchievements.map((a) => a.slug);
      expect(slugs).not.toContain('amrap-king');
    });
  });

  // -------------------------------------------------------------------------
  describe('consistent-lifter achievement', () => {
    let token: string;

    beforeAll(async () => {
      ({ token } = await registerAndSetup(
        'ach-cl',
        sharedPlanId,
        sharedBenchExId,
        sharedSquatExId,
        sharedOhpExId,
        sharedDeadliftExId,
      ));
    });

    it('does NOT grant consistent-lifter before 10 workouts', async () => {
      // Complete 9 workouts cycling through days 1-4
      for (let i = 0; i < 9; i++) {
        const dayNumber = (i % 4) + 1;
        const { newAchievements } = await doWorkout(token, dayNumber, 3);
        const slugs = newAchievements.map((a) => a.slug);
        expect(slugs).not.toContain('consistent-lifter');
      }
    });

    it('grants consistent-lifter on the 10th completed workout', async () => {
      const { newAchievements } = await doWorkout(token, 2, 3);
      const slugs = newAchievements.map((a) => a.slug);
      expect(slugs).toContain('consistent-lifter');
    });

    it('does NOT grant consistent-lifter again on the 11th workout', async () => {
      const { newAchievements } = await doWorkout(token, 3, 3);
      const slugs = newAchievements.map((a) => a.slug);
      expect(slugs).not.toContain('consistent-lifter');
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /api/achievements', () => {
    let token: string;
    let firstWorkoutId: number;

    beforeAll(async () => {
      ({ token } = await registerAndSetup(
        'ach-get',
        sharedPlanId,
        sharedBenchExId,
        sharedSquatExId,
        sharedOhpExId,
        sharedDeadliftExId,
      ));

      // Complete one workout to unlock first-blood
      const result = await doWorkout(token, 1);
      firstWorkoutId = result.workoutId;
    });

    it('returns all achievements with correct structure', async () => {
      const res = await request(app)
        .get('/api/achievements')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('achievements');
      expect(Array.isArray(res.body.achievements)).toBe(true);
      expect(res.body.achievements.length).toBeGreaterThan(0);

      for (const achievement of res.body.achievements) {
        expect(achievement).toHaveProperty('slug');
        expect(achievement).toHaveProperty('name');
        expect(achievement).toHaveProperty('description');
        expect(achievement).toHaveProperty('unlockedAt');
        expect(achievement).toHaveProperty('workoutId');
      }
    });

    it('includes first-blood with a valid unlockedAt ISO string', async () => {
      const res = await request(app)
        .get('/api/achievements')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const firstBlood = res.body.achievements.find(
        (a: { slug: string }) => a.slug === 'first-blood',
      );
      expect(firstBlood).toBeDefined();
      expect(firstBlood.unlockedAt).not.toBeNull();
      // Must be a valid ISO 8601 date string
      expect(() => new Date(firstBlood.unlockedAt)).not.toThrow();
      expect(new Date(firstBlood.unlockedAt).getTime()).not.toBeNaN();
      expect(firstBlood.workoutId).toBe(firstWorkoutId);
    });

    it('shows locked achievements with null unlockedAt', async () => {
      const res = await request(app)
        .get('/api/achievements')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // consistent-lifter requires 10 workouts; this user has only done 1
      const consistentLifter = res.body.achievements.find(
        (a: { slug: string }) => a.slug === 'consistent-lifter',
      );
      expect(consistentLifter).toBeDefined();
      expect(consistentLifter.unlockedAt).toBeNull();
      expect(consistentLifter.workoutId).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('double-completion guard (idempotency)', () => {
    let token: string;

    beforeAll(async () => {
      ({ token } = await registerAndSetup(
        'ach-idem',
        sharedPlanId,
        sharedBenchExId,
        sharedSquatExId,
        sharedOhpExId,
        sharedDeadliftExId,
      ));
    });

    it('does not change unlockedAt after a badge is already earned', async () => {
      // First workout: unlock first-blood
      await doWorkout(token, 1);

      const res1 = await request(app)
        .get('/api/achievements')
        .set('Authorization', `Bearer ${token}`);

      const firstBlood1 = res1.body.achievements.find(
        (a: { slug: string }) => a.slug === 'first-blood',
      );
      expect(firstBlood1.unlockedAt).not.toBeNull();
      const originalUnlockedAt: string = firstBlood1.unlockedAt;

      // Second workout: first-blood should not be re-unlocked
      const { newAchievements } = await doWorkout(token, 2);
      const slugs = newAchievements.map((a: { slug: string }) => a.slug);
      expect(slugs).not.toContain('first-blood');

      // UnlockedAt must remain exactly the same
      const res2 = await request(app)
        .get('/api/achievements')
        .set('Authorization', `Bearer ${token}`);

      const firstBlood2 = res2.body.achievements.find(
        (a: { slug: string }) => a.slug === 'first-blood',
      );
      expect(firstBlood2.unlockedAt).toBe(originalUnlockedAt);
    });
  });

  // -------------------------------------------------------------------------
  describe('Authentication guard', () => {
    it('returns 401 when GET /api/achievements is called without auth header', async () => {
      const res = await request(app).get('/api/achievements');
      expect(res.status).toBe(401);
    });
  });
});
