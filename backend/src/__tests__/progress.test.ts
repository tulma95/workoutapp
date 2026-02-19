import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';
import { createTestUser, getExercisesBySlug } from './helpers';

describe('GET /api/progress', () => {
  const uid = randomUUID().slice(0, 8);
  let token: string;
  let userId: number;

  beforeAll(async () => {
    const result = await createTestUser({ email: `progress-${uid}@example.com` });
    token = result.token;
    userId = result.user.id;
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/progress');
    expect(res.status).toBe(401);
  });

  it('returns empty exercises when no active plan', async () => {
    const res = await request(app)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exercises: [] });
  });

  it('returns exercises with TMs and history for active plan', async () => {
    const exerciseMap = await getExercisesBySlug(['bench-press', 'squat', 'ohp', 'deadlift']);
    const benchId = exerciseMap['bench-press']!.id;
    const squatId = exerciseMap['squat']!.id;
    const ohpId = exerciseMap['ohp']!.id;
    const deadliftId = exerciseMap['deadlift']!.id;

    // Create a test plan with 4 TM exercises
    const plan = await prisma.workoutPlan.create({
      data: {
        slug: `progress-test-${uid}`,
        name: 'Progress Test Plan',
        description: 'Test plan for progress endpoint',
        daysPerWeek: 4,
        isPublic: true,
        days: {
          create: [
            {
              dayNumber: 1,
              name: 'Day 1',
              exercises: {
                create: [
                  { exerciseId: benchId, tmExerciseId: benchId, sortOrder: 1 },
                  { exerciseId: ohpId, tmExerciseId: ohpId, sortOrder: 2 },
                ],
              },
            },
            {
              dayNumber: 2,
              name: 'Day 2',
              exercises: {
                create: [
                  { exerciseId: squatId, tmExerciseId: squatId, sortOrder: 1 },
                  { exerciseId: deadliftId, tmExerciseId: deadliftId, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    });

    // Subscribe user to the plan
    await prisma.userPlan.create({
      data: {
        userId,
        planId: plan.id,
        isActive: true,
      },
    });

    // Set up TMs
    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({
        exerciseTMs: [
          { exerciseId: benchId, oneRepMax: 100 },
          { exerciseId: squatId, oneRepMax: 140 },
          { exerciseId: ohpId, oneRepMax: 60 },
          { exerciseId: deadliftId, oneRepMax: 180 },
        ],
      });

    const res = await request(app)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.exercises).toHaveLength(4);

    const bench = res.body.exercises.find((e: any) => e.slug === 'bench-press');
    expect(bench).toBeDefined();
    expect(bench.name).toBe('Bench Press');
    expect(bench.currentTM).toBe(90); // 100 * 0.9 = 90
    expect(bench.history).toBeInstanceOf(Array);
    expect(bench.history.length).toBeGreaterThanOrEqual(1);
    expect(bench.history[0].weight).toBe(90);
    expect(bench.history[0].effectiveDate).toBeDefined();
  });
});
