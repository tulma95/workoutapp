import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

describe('Log Set - actualReps nullable', () => {
  let token: string;
  let workoutId: number;
  let setId: number;
  let benchExId: number;

  beforeAll(async () => {
    // Register user
    const res = await request(app).post('/api/auth/register').send({
      email: `logset-${uid}@example.com`,
      password: 'password123',
      displayName: 'LogSet Test User',
    });
    token = res.body.accessToken;

    // Get bench exercise ID
    const bench = await prisma.exercise.findUnique({
      where: { slug: 'bench-press' },
    });
    benchExId = bench!.id;

    // Create a simple test plan
    const plan = await prisma.workoutPlan.create({
      data: {
        slug: `logset-plan-${uid}`,
        name: 'LogSet Test Plan',
        description: 'Test plan',
        daysPerWeek: 1,
        isPublic: true,
        isSystem: false,
      },
    });

    // Create day
    const day = await prisma.planDay.create({
      data: {
        planId: plan.id,
        dayNumber: 1,
        name: 'Day 1',
      },
    });

    // Create exercise
    const planDayEx = await prisma.planDayExercise.create({
      data: {
        planDayId: day.id,
        exerciseId: benchExId,
        tmExerciseId: benchExId,
        sortOrder: 1,
      },
    });

    // Create sets
    await prisma.planSet.createMany({
      data: [
        { planDayExerciseId: planDayEx.id, setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
      ],
    });

    // Subscribe to plan
    await request(app)
      .post(`/api/plans/${plan.id}/subscribe`)
      .set('Authorization', `Bearer ${token}`);

    // Set up TM
    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({
        exerciseTMs: [{ exerciseId: benchExId, oneRepMax: 100 }],
      });

    // Start workout
    const workoutRes = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayNumber: 1 });
    workoutId = workoutRes.body.id;
    setId = workoutRes.body.sets[0].id;
  });

  it('should reset actualReps to null when sent null', async () => {
    // First set actualReps to a number
    await request(app)
      .patch(`/api/workouts/${workoutId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actualReps: 5, completed: true })
      .expect(200);

    // Then reset to null
    const res = await request(app)
      .patch(`/api/workouts/${workoutId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actualReps: null, completed: false })
      .expect(200);

    expect(res.body.actualReps).toBeNull();
    expect(res.body.completed).toBe(false);
  });
});
