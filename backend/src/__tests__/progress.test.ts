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
    expect(res.body).toEqual({ exercises: [], planSwitches: [] });
  });

  it('returns planSwitches with second plan start date when user switches plans', async () => {
    const switchUid = randomUUID().slice(0, 8);
    const { user: switchUser, token: switchToken } = await createTestUser({
      email: `progress-switch-${switchUid}@example.com`,
    });

    // Create first plan
    const firstPlan = await prisma.workoutPlan.create({
      data: {
        slug: `switch-plan-a-${switchUid}`,
        name: 'First Plan',
        description: 'First plan',
        daysPerWeek: 3,
        isPublic: true,
      },
    });

    // Create second plan
    const secondPlan = await prisma.workoutPlan.create({
      data: {
        slug: `switch-plan-b-${switchUid}`,
        name: 'Second Plan',
        description: 'Second plan',
        daysPerWeek: 3,
        isPublic: true,
      },
    });

    const firstStartedAt = new Date('2024-01-01T00:00:00.000Z');
    const secondStartedAt = new Date('2024-06-01T00:00:00.000Z');

    // Subscribe user to first plan
    await prisma.userPlan.create({
      data: {
        userId: switchUser.id,
        planId: firstPlan.id,
        isActive: false,
        startedAt: firstStartedAt,
        endedAt: secondStartedAt,
      },
    });

    // Subscribe user to second plan (active)
    await prisma.userPlan.create({
      data: {
        userId: switchUser.id,
        planId: secondPlan.id,
        isActive: true,
        startedAt: secondStartedAt,
      },
    });

    const res = await request(app)
      .get('/api/progress')
      .set('Authorization', `Bearer ${switchToken}`);

    expect(res.status).toBe(200);
    expect(res.body.planSwitches).toHaveLength(1);
    expect(res.body.planSwitches[0].date).toBe(secondStartedAt.toISOString());
    expect(res.body.planSwitches[0].planName).toBe('Second Plan');
  });

  it('returns e1RM history from completed workout sets', async () => {
    const exerciseMap = await getExercisesBySlug(['bench-press', 'squat', 'ohp', 'deadlift']);
    const benchId = exerciseMap['bench-press']!.id;
    const squatId = exerciseMap['squat']!.id;
    const ohpId = exerciseMap['ohp']!.id;
    const deadliftId = exerciseMap['deadlift']!.id;

    // Create a test plan with exercises
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

    // Create a completed workout with sets
    const workout = await prisma.workout.create({
      data: {
        userId,
        dayNumber: 1,
        status: 'completed',
        completedAt: new Date('2025-06-15T10:00:00Z'),
      },
    });

    await prisma.workoutSet.createMany({
      data: [
        {
          workoutId: workout.id,
          exerciseId: benchId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedWeight: 80,
          prescribedReps: 5,
          actualReps: 5,
          completed: true,
          isAmrap: false,
          isProgression: false,
        },
        {
          workoutId: workout.id,
          exerciseId: benchId,
          exerciseOrder: 1,
          setOrder: 2,
          prescribedWeight: 80,
          prescribedReps: 5,
          actualReps: 8,
          completed: true,
          isAmrap: true,
          isProgression: true,
        },
        {
          workoutId: workout.id,
          exerciseId: ohpId,
          exerciseOrder: 2,
          setOrder: 1,
          prescribedWeight: 40,
          prescribedReps: 5,
          actualReps: 5,
          completed: true,
          isAmrap: false,
          isProgression: false,
        },
      ],
    });

    const res = await request(app)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Should have bench and OHP (exercises with completed sets in the plan)
    const bench = res.body.exercises.find((e: any) => e.slug === 'bench-press');
    expect(bench).toBeDefined();
    expect(bench.name).toBe('Bench Press');
    // Best e1RM: 80 * (1 + 8/30) = 80 * 1.2667 = 101.33
    expect(bench.currentE1rm).toBeCloseTo(101.33, 0);
    expect(bench.history).toBeInstanceOf(Array);
    expect(bench.history.length).toBe(1);
    expect(bench.history[0].e1rm).toBeCloseTo(101.33, 0);
    expect(bench.history[0].date).toBe('2025-06-15');
    expect(bench.inCurrentPlan).toBe(true);

    const ohp = res.body.exercises.find((e: any) => e.slug === 'ohp');
    expect(ohp).toBeDefined();
    // e1RM: 40 * (1 + 5/30) = 46.67
    expect(ohp.currentE1rm).toBeCloseTo(46.67, 0);
    expect(ohp.inCurrentPlan).toBe(true);

    // Squat and deadlift have no completed sets, so they should NOT be in the response
    const squat = res.body.exercises.find((e: any) => e.slug === 'squat');
    expect(squat).toBeUndefined();

    // Should NOT have old TM fields
    expect(bench.currentTM).toBeUndefined();
  });
});
