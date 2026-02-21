import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../../app';
import prisma from '../../../lib/db';
import bcrypt from 'bcrypt';

const uid = randomUUID().slice(0, 8);

const adminEmail = `admin-plans-${uid}@example.com`;
const nonAdminEmail = `nonadmin-plans-${uid}@example.com`;

const benchSlug = `bench-press-test-${uid}`;
const squatSlug = `squat-test-${uid}`;
const ohpSlug = `ohp-test-${uid}`;

const testPlanSlug = `test-plan-${uid}`;
const systemPlanSlug = `system-plan-test-${uid}`;
const planToArchiveSlug = `plan-to-archive-${uid}`;
const systemPlanArchiveSlug = `system-plan-archive-test-${uid}`;
const forbiddenDeletePlanSlug = `forbidden-delete-plan-${uid}`;

let adminToken: string;
let nonAdminToken: string;
let testPlanId: number;
let exerciseIds: { bench: number; squat: number; ohp: number };

describe('Admin Plans routes', () => {
  beforeAll(async () => {
    // Create admin user
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        username: `plan_admin_${uid}`,
        isAdmin: true,
      },
    });

    // Create non-admin user
    await prisma.user.create({
      data: {
        email: nonAdminEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        username: `nonadmin_plans_${uid}`,
        isAdmin: false,
      },
    });

    // Login as admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' });
    adminToken = adminLoginRes.body.accessToken;

    // Login as non-admin
    const nonAdminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: nonAdminEmail, password: 'password123' });
    nonAdminToken = nonAdminLoginRes.body.accessToken;

    // Create test exercises
    const bench = await prisma.exercise.create({
      data: {
        slug: benchSlug,
        name: 'Bench Press',
        muscleGroup: 'chest',
        category: 'compound',
        isUpperBody: true,
      },
    });

    const squat = await prisma.exercise.create({
      data: {
        slug: squatSlug,
        name: 'Squat',
        muscleGroup: 'legs',
        category: 'compound',
        isUpperBody: false,
      },
    });

    const ohp = await prisma.exercise.create({
      data: {
        slug: ohpSlug,
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
          slug: testPlanSlug,
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
      expect(res.body.slug).toBe(testPlanSlug);
      expect(res.body.name).toBe('Test Plan');
      expect(res.body.daysPerWeek).toBe(2);
      expect(res.body.days).toHaveLength(2);

      // Verify day 1 structure
      expect(res.body.days[0].dayNumber).toBe(1);
      expect(res.body.days[0].name).toBe('Day 1');
      expect(res.body.days[0].exercises).toHaveLength(2);

      // Verify exercises are ordered by sortOrder
      expect(res.body.days[0].exercises[0].sortOrder).toBe(1);
      expect(res.body.days[0].exercises[1].sortOrder).toBe(2);

      // Verify sets for first exercise
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
          slug: testPlanSlug,
          name: 'Duplicate Plan',
          daysPerWeek: 1,
          days: [
            {
              dayNumber: 1,
              exercises: [
                {
                  exerciseId: exerciseIds.bench,
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
          slug: `forbidden-plan-${uid}`,
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
          slug: `no-auth-plan-${uid}`,
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
      const plan = res.body.find((p: any) => p.slug === testPlanSlug);
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
          where: { slug: testPlanSlug },
        });
        if (plans) {
          testPlanId = plans.id;
        }
      }

      // Get a test user to subscribe
      const user = await prisma.user.findUnique({
        where: { email: nonAdminEmail },
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
      const plan = res.body.find((p: any) => p.slug === testPlanSlug);
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

  describe('GET /api/admin/plans/:id', () => {
    it('returns full plan structure with nested data', async () => {
      // Get the test plan ID
      if (!testPlanId) {
        const plan = await prisma.workoutPlan.findFirst({
          where: { slug: testPlanSlug },
        });
        if (plan) {
          testPlanId = plan.id;
        }
      }

      const res = await request(app)
        .get(`/api/admin/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testPlanId);
      expect(res.body.slug).toBe(testPlanSlug);
      expect(res.body.days).toHaveLength(2);

      // Verify nested days
      expect(res.body.days[0].exercises).toBeDefined();
      expect(res.body.days[0].exercises[0].sets).toBeDefined();

      // Verify exercise details are included
      expect(res.body.days[0].exercises[0].exercise).toBeDefined();
      expect(res.body.days[0].exercises[0].exercise.slug).toBe(benchSlug);
      expect(res.body.days[0].exercises[0].tmExercise).toBeDefined();

      // Verify progression rules are included
      expect(res.body.progressionRules).toBeDefined();
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await request(app)
        .get('/api/admin/plans/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid plan ID', async () => {
      const res = await request(app)
        .get('/api/admin/plans/invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .get(`/api/admin/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/admin/plans/:id', () => {
    it('updates plan successfully', async () => {
      // Get the test plan ID
      if (!testPlanId) {
        const plan = await prisma.workoutPlan.findFirst({
          where: { slug: testPlanSlug },
        });
        if (plan) {
          testPlanId = plan.id;
        }
      }

      const res = await request(app)
        .put(`/api/admin/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: testPlanSlug,
          name: 'Updated Test Plan',
          description: 'Updated description',
          daysPerWeek: 3,
          isPublic: false,
          days: [
            {
              dayNumber: 1,
              name: 'Updated Day 1',
              exercises: [
                {
                  exerciseId: exerciseIds.bench,
                  sortOrder: 1,
                  tmExerciseId: exerciseIds.bench,
                  sets: [
                    { setOrder: 1, percentage: 0.80, reps: 4, isAmrap: false, isProgression: false },
                  ],
                },
              ],
            },
            {
              dayNumber: 2,
              name: 'New Day 2',
              exercises: [
                {
                  exerciseId: exerciseIds.squat,
                  sortOrder: 1,
                  tmExerciseId: exerciseIds.squat,
                  sets: [
                    { setOrder: 1, percentage: 0.70, reps: 5 },
                  ],
                },
              ],
            },
            {
              dayNumber: 3,
              name: 'New Day 3',
              exercises: [
                {
                  exerciseId: exerciseIds.ohp,
                  sortOrder: 1,
                  tmExerciseId: exerciseIds.ohp,
                  sets: [
                    { setOrder: 1, percentage: 0.65, reps: 6 },
                  ],
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Test Plan');
      expect(res.body.description).toBe('Updated description');
      expect(res.body.daysPerWeek).toBe(3);
      expect(res.body.isPublic).toBe(false);
      expect(res.body.days).toHaveLength(3);
      expect(res.body.days[0].name).toBe('Updated Day 1');
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await request(app)
        .put('/api/admin/plans/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: `nonexistent-${uid}`,
          name: 'Non-existent',
          daysPerWeek: 1,
          days: [
            {
              dayNumber: 1,
              exercises: [
                {
                  exerciseId: exerciseIds.bench,
                  sortOrder: 1,
                  tmExerciseId: exerciseIds.bench,
                  sets: [{ setOrder: 1, percentage: 0.75, reps: 5 }],
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('prevents changing slug of system plan', async () => {
      // Create a system plan
      const systemPlan = await prisma.workoutPlan.create({
        data: {
          slug: systemPlanSlug,
          name: 'System Plan',
          daysPerWeek: 1,
          isSystem: true,
        },
      });

      // Create a day for it
      await prisma.planDay.create({
        data: {
          planId: systemPlan.id,
          dayNumber: 1,
        },
      });

      const res = await request(app)
        .put(`/api/admin/plans/${systemPlan.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: `new-slug-${uid}`,
          name: 'System Plan',
          daysPerWeek: 1,
          days: [
            {
              dayNumber: 1,
              exercises: [
                {
                  exerciseId: exerciseIds.bench,
                  sortOrder: 1,
                  tmExerciseId: exerciseIds.bench,
                  sets: [{ setOrder: 1, percentage: 0.75, reps: 5 }],
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('slug');
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .put(`/api/admin/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          slug: testPlanSlug,
          name: 'Should fail',
          daysPerWeek: 1,
          days: [],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /api/admin/plans/:id', () => {
    it('archives plan successfully', async () => {
      // Create a non-system plan to archive
      const planToArchive = await prisma.workoutPlan.create({
        data: {
          slug: planToArchiveSlug,
          name: 'Plan To Archive',
          daysPerWeek: 1,
          isSystem: false,
        },
      });

      const res = await request(app)
        .delete(`/api/admin/plans/${planToArchive.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.archivedAt).not.toBeNull();

      // Verify plan was archived in database
      const archived = await prisma.workoutPlan.findUnique({
        where: { id: planToArchive.id },
      });
      expect(archived?.archivedAt).not.toBeNull();
    });

    it('prevents archiving system plan', async () => {
      // Create a system plan
      const systemPlan = await prisma.workoutPlan.create({
        data: {
          slug: systemPlanArchiveSlug,
          name: 'System Plan Archive Test',
          daysPerWeek: 1,
          isSystem: true,
        },
      });

      const res = await request(app)
        .delete(`/api/admin/plans/${systemPlan.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('system');
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await request(app)
        .delete('/api/admin/plans/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 403 for non-admin user', async () => {
      // Create a plan to attempt to delete
      const plan = await prisma.workoutPlan.create({
        data: {
          slug: forbiddenDeletePlanSlug,
          name: 'Forbidden Delete Plan',
          daysPerWeek: 1,
        },
      });

      const res = await request(app)
        .delete(`/api/admin/plans/${plan.id}`)
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/admin/plans/:id/progression-rules', () => {
    it('sets progression rules successfully', async () => {
      // Get the test plan ID
      if (!testPlanId) {
        const plan = await prisma.workoutPlan.findFirst({
          where: { slug: testPlanSlug },
        });
        if (plan) {
          testPlanId = plan.id;
        }
      }

      const res = await request(app)
        .post(`/api/admin/plans/${testPlanId}/progression-rules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rules: [
            { category: 'upper', minReps: 0, maxReps: 1, increase: 0 },
            { category: 'upper', minReps: 2, maxReps: 3, increase: 2.5 },
            { category: 'upper', minReps: 4, maxReps: 5, increase: 2.5 },
            { category: 'upper', minReps: 6, maxReps: 99, increase: 5 },
            { category: 'lower', minReps: 0, maxReps: 1, increase: 0 },
            { category: 'lower', minReps: 2, maxReps: 3, increase: 5 },
            { category: 'lower', minReps: 4, maxReps: 5, increase: 5 },
            { category: 'lower', minReps: 6, maxReps: 99, increase: 7.5 },
          ],
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(8);

      // Verify first rule
      const upperZeroRule = res.body.find((r: any) => r.category === 'upper' && r.minReps === 0);
      expect(upperZeroRule).toBeDefined();
      expect(upperZeroRule.maxReps).toBe(1);
      expect(parseFloat(upperZeroRule.increase)).toBe(0);

      // Verify lower body rule
      const lowerRule = res.body.find((r: any) => r.category === 'lower' && r.minReps === 2);
      expect(lowerRule).toBeDefined();
      expect(lowerRule.maxReps).toBe(3);
      expect(parseFloat(lowerRule.increase)).toBe(5);
    });

    it('replaces existing progression rules', async () => {
      // Get the test plan ID
      if (!testPlanId) {
        const plan = await prisma.workoutPlan.findFirst({
          where: { slug: testPlanSlug },
        });
        if (plan) {
          testPlanId = plan.id;
        }
      }

      // First set of rules
      await request(app)
        .post(`/api/admin/plans/${testPlanId}/progression-rules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rules: [
            { category: 'upper', minReps: 0, maxReps: 10, increase: 2.5 },
          ],
        });

      // Replace with new rules
      const res = await request(app)
        .post(`/api/admin/plans/${testPlanId}/progression-rules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rules: [
            { category: 'lower', minReps: 0, maxReps: 10, increase: 5 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].category).toBe('lower');

      // Verify old rules are deleted
      const allRules = await prisma.planProgressionRule.findMany({
        where: { planId: testPlanId },
      });
      expect(allRules).toHaveLength(1);
      expect(allRules[0]!.category).toBe('lower');
    });

    it('sets exercise-specific progression rules', async () => {
      // Get the test plan ID
      if (!testPlanId) {
        const plan = await prisma.workoutPlan.findFirst({
          where: { slug: testPlanSlug },
        });
        if (plan) {
          testPlanId = plan.id;
        }
      }

      const res = await request(app)
        .post(`/api/admin/plans/${testPlanId}/progression-rules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rules: [
            { exerciseId: exerciseIds.bench, minReps: 0, maxReps: 3, increase: 2.5 },
            { exerciseId: exerciseIds.bench, minReps: 4, maxReps: 99, increase: 5 },
            { category: 'upper', minReps: 0, maxReps: 99, increase: 2.5 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);

      // Verify exercise-specific rule
      const benchRule = res.body.find((r: any) => r.exerciseId === exerciseIds.bench);
      expect(benchRule).toBeDefined();
      expect(benchRule.exercise).toBeDefined();
      expect(benchRule.exercise.slug).toBe(benchSlug);
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await request(app)
        .post('/api/admin/plans/999999/progression-rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rules: [
            { category: 'upper', minReps: 0, maxReps: 10, increase: 2.5 },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid exerciseId reference', async () => {
      // Get the test plan ID
      if (!testPlanId) {
        const plan = await prisma.workoutPlan.findFirst({
          where: { slug: testPlanSlug },
        });
        if (plan) {
          testPlanId = plan.id;
        }
      }

      const res = await request(app)
        .post(`/api/admin/plans/${testPlanId}/progression-rules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rules: [
            { exerciseId: 999999, minReps: 0, maxReps: 10, increase: 2.5 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('exerciseId');
    });

    it('returns 400 for invalid plan ID', async () => {
      const res = await request(app)
        .post('/api/admin/plans/invalid/progression-rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rules: [
            { category: 'upper', minReps: 0, maxReps: 10, increase: 2.5 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .post(`/api/admin/plans/${testPlanId}/progression-rules`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          rules: [
            { category: 'upper', minReps: 0, maxReps: 10, increase: 2.5 },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 401 without token', async () => {
      const res = await request(app)
        .post(`/api/admin/plans/${testPlanId}/progression-rules`)
        .send({
          rules: [
            { category: 'upper', minReps: 0, maxReps: 10, increase: 2.5 },
          ],
        });

      expect(res.status).toBe(401);
    });
  });
});
