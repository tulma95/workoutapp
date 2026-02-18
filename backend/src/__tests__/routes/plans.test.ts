import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import prisma from '../../lib/db';
import bcrypt from 'bcrypt';

const uid = randomUUID().slice(0, 8);

const userEmail = `user-plans-${uid}@example.com`;

const exerciseSlugs = {
  bench: `bench-plans-${uid}`,
  squat: `squat-plans-${uid}`,
  ohp: `ohp-plans-${uid}`,
  deadlift: `deadlift-plans-${uid}`,
};

const planSlugs = {
  public: `public-plan-${uid}`,
  archived: `archived-plan-${uid}`,
  private: `private-plan-${uid}`,
  another: `another-plan-${uid}`,
};

let userToken: string;
let userId: number;
let testPlanId: number;
let archivedPlanId: number;
let privatePlanId: number;
let exerciseIds: { bench: number; squat: number; ohp: number; deadlift: number };

describe('Plans routes', () => {
  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        displayName: 'Test User',
        isAdmin: false,
      },
    });
    userId = user.id;

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: userEmail, password: 'password123' });
    userToken = loginRes.body.accessToken;

    // Create test exercises
    const bench = await prisma.exercise.create({
      data: {
        slug: exerciseSlugs.bench,
        name: 'Bench Press',
        muscleGroup: 'chest',
        category: 'compound',
        isUpperBody: true,
      },
    });

    const squat = await prisma.exercise.create({
      data: {
        slug: exerciseSlugs.squat,
        name: 'Squat',
        muscleGroup: 'legs',
        category: 'compound',
        isUpperBody: false,
      },
    });

    const ohp = await prisma.exercise.create({
      data: {
        slug: exerciseSlugs.ohp,
        name: 'OHP',
        muscleGroup: 'shoulders',
        category: 'compound',
        isUpperBody: true,
      },
    });

    const deadlift = await prisma.exercise.create({
      data: {
        slug: exerciseSlugs.deadlift,
        name: 'Deadlift',
        muscleGroup: 'back',
        category: 'compound',
        isUpperBody: false,
      },
    });

    exerciseIds = {
      bench: bench.id,
      squat: squat.id,
      ohp: ohp.id,
      deadlift: deadlift.id,
    };

    // Create test public plan
    const publicPlan = await prisma.workoutPlan.create({
      data: {
        slug: planSlugs.public,
        name: 'Public Test Plan',
        description: 'A public test plan',
        daysPerWeek: 2,
        isPublic: true,
        days: {
          create: [
            {
              dayNumber: 1,
              name: 'Day 1',
              exercises: {
                create: [
                  {
                    exerciseId: bench.id,
                    sortOrder: 1,
                    tmExerciseId: bench.id,
                    sets: {
                      create: [
                        { setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
                        { setOrder: 2, percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
                        { setOrder: 3, percentage: 0.95, reps: 1, isAmrap: true, isProgression: true },
                      ],
                    },
                  },
                  {
                    exerciseId: ohp.id,
                    sortOrder: 2,
                    tmExerciseId: ohp.id,
                    sets: {
                      create: [
                        { setOrder: 1, percentage: 0.60, reps: 5, isAmrap: false, isProgression: false },
                        { setOrder: 2, percentage: 0.70, reps: 3, isAmrap: false, isProgression: false },
                      ],
                    },
                  },
                ],
              },
            },
            {
              dayNumber: 2,
              name: 'Day 2',
              exercises: {
                create: [
                  {
                    exerciseId: squat.id,
                    sortOrder: 1,
                    tmExerciseId: squat.id,
                    sets: {
                      create: [
                        { setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
                        { setOrder: 2, percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
                        { setOrder: 3, percentage: 0.95, reps: 1, isAmrap: true, isProgression: true },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });
    testPlanId = publicPlan.id;

    // Create archived plan
    const archived = await prisma.workoutPlan.create({
      data: {
        slug: planSlugs.archived,
        name: 'Archived Plan',
        daysPerWeek: 1,
        isPublic: true,
        archivedAt: new Date(),
      },
    });
    archivedPlanId = archived.id;

    // Create private plan
    const privatePlan = await prisma.workoutPlan.create({
      data: {
        slug: planSlugs.private,
        name: 'Private Plan',
        daysPerWeek: 1,
        isPublic: false,
      },
    });
    privatePlanId = privatePlan.id;
  });

  describe('GET /api/plans', () => {
    it('lists all public, non-archived plans', async () => {
      const res = await request(app)
        .get('/api/plans')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const publicPlan = res.body.find((p: any) => p.slug === planSlugs.public);
      expect(publicPlan).toBeDefined();
      expect(publicPlan.name).toBe('Public Test Plan');
      expect(publicPlan.days).toBeDefined();
      expect(publicPlan.days.length).toBe(2);

      // Should not include archived or private plans
      expect(res.body.find((p: any) => p.slug === planSlugs.archived)).toBeUndefined();
      expect(res.body.find((p: any) => p.slug === planSlugs.private)).toBeUndefined();
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/plans');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/plans/current', () => {
    it('returns null when user has no active plan', async () => {
      const res = await request(app)
        .get('/api/plans/current')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('returns active plan after subscription', async () => {
      // Subscribe to plan
      await request(app)
        .post(`/api/plans/${testPlanId}/subscribe`)
        .set('Authorization', `Bearer ${userToken}`);

      // Get current plan
      const res = await request(app)
        .get('/api/plans/current')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body.slug).toBe(planSlugs.public);
      expect(res.body.days).toBeDefined();
      expect(res.body.days.length).toBe(2);
      expect(res.body.days[0].exercises).toBeDefined();
      expect(res.body.days[0].exercises[0].sets).toBeDefined();
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/plans/current');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('returns plan detail with full structure', async () => {
      const res = await request(app)
        .get(`/api/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testPlanId);
      expect(res.body.slug).toBe(planSlugs.public);
      expect(res.body.name).toBe('Public Test Plan');
      expect(res.body.days).toBeDefined();
      expect(res.body.days.length).toBe(2);
      expect(res.body.days[0].exercises).toBeDefined();
      expect(res.body.days[0].exercises[0].exercise).toBeDefined();
      expect(res.body.days[0].exercises[0].sets).toBeDefined();
    });

    it('returns 404 for archived plan', async () => {
      const res = await request(app)
        .get(`/api/plans/${archivedPlanId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for private plan', async () => {
      const res = await request(app)
        .get(`/api/plans/${privatePlanId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await request(app)
        .get('/api/plans/999999')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid plan ID', async () => {
      const res = await request(app)
        .get('/api/plans/invalid')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('requires authentication', async () => {
      const res = await request(app).get(`/api/plans/${testPlanId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/plans/:id/subscribe', () => {
    it('subscribes user to plan successfully', async () => {
      // Create training maxes for the user
      await prisma.trainingMax.create({
        data: {
          userId,
          exerciseId: exerciseIds.bench,
          weight: 100,
          effectiveDate: new Date(),
        },
      });

      await prisma.trainingMax.create({
        data: {
          userId,
          exerciseId: exerciseIds.squat,
          weight: 120,
          effectiveDate: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/plans/${testPlanId}/subscribe`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userPlan).toBeDefined();
      expect(res.body.userPlan.planId).toBe(testPlanId);
      expect(res.body.userPlan.isActive).toBe(true);
      expect(res.body.requiredExercises).toBeDefined();
      expect(res.body.requiredExercises.length).toBe(3); // bench, squat, ohp
      expect(res.body.missingTMs).toBeDefined();
      expect(res.body.missingTMs.length).toBe(1); // ohp is missing
      expect(res.body.missingTMs[0].slug).toBe(exerciseSlugs.ohp);
    });

    it('deactivates previous active plan when subscribing', async () => {
      // Create another plan
      const anotherPlan = await prisma.workoutPlan.create({
        data: {
          slug: planSlugs.another,
          name: 'Another Plan',
          daysPerWeek: 1,
          isPublic: true,
          days: {
            create: [
              {
                dayNumber: 1,
                exercises: {
                  create: [
                    {
                      exerciseId: exerciseIds.deadlift,
                        sortOrder: 1,
                      tmExerciseId: exerciseIds.deadlift,
                      sets: {
                        create: [
                          { setOrder: 1, percentage: 0.75, reps: 5 },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });

      // Subscribe to another plan
      const res = await request(app)
        .post(`/api/plans/${anotherPlan.id}/subscribe`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);

      // Check that previous plan is deactivated
      const previousPlan = await prisma.userPlan.findFirst({
        where: {
          userId,
          planId: testPlanId,
        },
      });

      expect(previousPlan).toBeDefined();
      expect(previousPlan?.isActive).toBe(false);
      expect(previousPlan?.endedAt).toBeDefined();
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await request(app)
        .post('/api/plans/999999/subscribe')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for archived plan', async () => {
      const res = await request(app)
        .post(`/api/plans/${archivedPlanId}/subscribe`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for private plan', async () => {
      const res = await request(app)
        .post(`/api/plans/${privatePlanId}/subscribe`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid plan ID', async () => {
      const res = await request(app)
        .post('/api/plans/invalid/subscribe')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('requires authentication', async () => {
      const res = await request(app).post(`/api/plans/${testPlanId}/subscribe`);
      expect(res.status).toBe(401);
    });
  });
});
