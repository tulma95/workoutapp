import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import prisma from '../../../lib/db';
import bcrypt from 'bcrypt';

let adminToken: string;
let nonAdminToken: string;
let testPlanId: number;
let exerciseIds: { bench: number; squat: number; ohp: number };

describe('Admin Plans routes', () => {
  beforeAll(async () => {
    // Create admin user
    await prisma.user.create({
      data: {
        email: 'admin@plans.com',
        passwordHash: await bcrypt.hash('password123', 10),
        displayName: 'Plan Admin',
        unitPreference: 'kg',
        isAdmin: true,
      },
    });

    // Create non-admin user
    await prisma.user.create({
      data: {
        email: 'nonadmin@plans.com',
        passwordHash: await bcrypt.hash('password123', 10),
        displayName: 'Non-Admin User',
        unitPreference: 'kg',
        isAdmin: false,
      },
    });

    // Login as admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@plans.com', password: 'password123' });
    adminToken = adminLoginRes.body.accessToken;

    // Login as non-admin
    const nonAdminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonadmin@plans.com', password: 'password123' });
    nonAdminToken = nonAdminLoginRes.body.accessToken;

    // Create test exercises
    const bench = await prisma.exercise.create({
      data: {
        slug: 'bench-press-test',
        name: 'Bench Press',
        muscleGroup: 'chest',
        category: 'compound',
        isUpperBody: true,
      },
    });

    const squat = await prisma.exercise.create({
      data: {
        slug: 'squat-test',
        name: 'Squat',
        muscleGroup: 'legs',
        category: 'compound',
        isUpperBody: false,
      },
    });

    const ohp = await prisma.exercise.create({
      data: {
        slug: 'ohp-test',
        name: 'OHP',
        muscleGroup: 'shoulders',
        category: 'compound',
        isUpperBody: true,
      },
    });

    exerciseIds = {
      bench: bench.id,
      squat: squat.id,
      ohp: ohp.id,
    };
  });

  describe('POST /api/admin/plans', () => {
    it('creates plan with nested structure successfully', async () => {
      const res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'test-plan',
          name: 'Test Plan',
          description: 'A test workout plan',
          daysPerWeek: 2,
          isPublic: true,
          days: [
            {
              dayNumber: 1,
              name: 'Day 1',
              exercises: [
                {
                  exerciseId: exerciseIds.bench,
                  tier: 'T1',
                  sortOrder: 1,
                  tmExerciseId: exerciseIds.bench,
                  displayName: 'Bench Press',
                  sets: [
                    { setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
                    { setOrder: 2, percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
                    { setOrder: 3, percentage: 0.95, reps: 1, isAmrap: true, isProgression: true },
                  ],
                },
                {
                  exerciseId: exerciseIds.ohp,
                  tier: 'T2',
                  sortOrder: 2,
                  tmExerciseId: exerciseIds.ohp,
                  sets: [
                    { setOrder: 1, percentage: 0.50, reps: 6, isAmrap: false },
                    { setOrder: 2, percentage: 0.60, reps: 5, isAmrap: false },
                  ],
                },
              ],
            },
            {
              dayNumber: 2,
              name: 'Day 2',
              exercises: [
                {
                  exerciseId: exerciseIds.squat,
                  tier: 'T1',
                  sortOrder: 1,
                  tmExerciseId: exerciseIds.squat,
                  sets: [
                    { setOrder: 1, percentage: 0.75, reps: 5 },
                    { setOrder: 2, percentage: 0.85, reps: 3 },
                  ],
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.slug).toBe('test-plan');
      expect(res.body.name).toBe('Test Plan');
      expect(res.body.daysPerWeek).toBe(2);
      expect(res.body.days).toHaveLength(2);

      // Verify day 1 structure
      expect(res.body.days[0].dayNumber).toBe(1);
      expect(res.body.days[0].name).toBe('Day 1');
      expect(res.body.days[0].exercises).toHaveLength(2);

      // Verify exercises are ordered by sortOrder
      expect(res.body.days[0].exercises[0].tier).toBe('T1');
      expect(res.body.days[0].exercises[1].tier).toBe('T2');

      // Verify sets for T1 exercise
      expect(res.body.days[0].exercises[0].sets).toHaveLength(3);
      expect(parseFloat(res.body.days[0].exercises[0].sets[0].percentage)).toBeCloseTo(0.75, 4);
      expect(res.body.days[0].exercises[0].sets[0].reps).toBe(5);
      expect(res.body.days[0].exercises[0].sets[2].isProgression).toBe(true);

      testPlanId = res.body.id;
    });

    it('returns 409 for duplicate slug', async () => {
      const res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'test-plan',
          name: 'Duplicate Plan',
          daysPerWeek: 1,
          days: [
            {
              dayNumber: 1,
              exercises: [
                {
                  exerciseId: exerciseIds.bench,
                  tier: 'T1',
                  sortOrder: 1,
                  tmExerciseId: exerciseIds.bench,
                  sets: [{ setOrder: 1, percentage: 0.75, reps: 5 }],
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          slug: 'forbidden-plan',
          name: 'Forbidden Plan',
          daysPerWeek: 1,
          days: [],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/admin/plans')
        .send({
          slug: 'no-auth-plan',
          name: 'No Auth Plan',
          daysPerWeek: 1,
          days: [],
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/plans', () => {
    it('lists all plans with subscriber count', async () => {
      const res = await request(app)
        .get('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Find the test plan we created
      const plan = res.body.find((p: any) => p.slug === 'test-plan');
      expect(plan).toBeDefined();
      expect(plan.subscriberCount).toBe(0);
      expect(plan.subscriptions).toBeUndefined();

      // Save the plan ID for later tests
      if (plan && !testPlanId) {
        testPlanId = plan.id;
      }
    });

    it('returns correct subscriber count when users are subscribed', async () => {
      // Get the plan ID if not already set
      if (!testPlanId) {
        const plans = await prisma.workoutPlan.findFirst({
          where: { slug: 'test-plan' },
        });
        if (plans) {
          testPlanId = plans.id;
        }
      }

      // Get a test user to subscribe
      const user = await prisma.user.findUnique({
        where: { email: 'nonadmin@plans.com' },
      });

      if (user && testPlanId) {
        await prisma.userPlan.create({
          data: {
            userId: user.id,
            planId: testPlanId,
            isActive: true,
          },
        });
      }

      const res = await request(app)
        .get('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const plan = res.body.find((p: any) => p.slug === 'test-plan');
      expect(plan).toBeDefined();
      expect(plan.subscriberCount).toBe(1);
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .get('/api/admin/plans')
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
