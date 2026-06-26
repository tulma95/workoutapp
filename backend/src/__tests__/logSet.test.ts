import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';
import { createTestUser, getExercisesBySlug } from './helpers';

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
      username: `logset_${uid}`,
    });
    token = res.body.accessToken;

    // Get bench exercise ID
    const bench = await prisma.exercise.findUnique({
      where: { slug: 'bench-press' },
    });
    if (!bench) throw new Error('bench-press exercise not found in seed data');
    benchExId = bench.id;

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

  it('persists rpe on a set and returns it', async () => {
    const res = await request(app)
      .patch(`/api/workouts/${workoutId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rpe: 8 })
      .expect(200);
    expect(res.body.rpe).toBe(8);
  });

  it('clears rpe when sent null', async () => {
    await request(app)
      .patch(`/api/workouts/${workoutId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rpe: 9 })
      .expect(200);
    const res = await request(app)
      .patch(`/api/workouts/${workoutId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rpe: null })
      .expect(200);
    expect(res.body.rpe).toBeNull();
  });

  it('rejects an out-of-range rpe with 400', async () => {
    await request(app)
      .patch(`/api/workouts/${workoutId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rpe: 11 })
      .expect(400);
    await request(app)
      .patch(`/api/workouts/${workoutId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rpe: 3 })
      .expect(400);
  });
});

describe('Edit a completed workout set (history correction)', () => {
  it('updates actualReps on a COMPLETED workout via PATCH and persists', async () => {
    const { user, token } = await createTestUser();
    const exercises = await getExercisesBySlug(['bench-press']);
    const benchId = exercises['bench-press']!.id;

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        dayNumber: 1,
        status: 'completed',
        completedAt: new Date(),
        sets: {
          create: {
            exerciseId: benchId,
            exerciseOrder: 1,
            setOrder: 1,
            prescribedWeight: 100,
            prescribedReps: 5,
            actualReps: 5,
            completed: true,
          },
        },
      },
      include: { sets: true },
    });
    const setIdToEdit = workout.sets[0]!.id;

    const res = await request(app)
      .patch(`/api/workouts/${workout.id}/sets/${setIdToEdit}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actualReps: 8 });

    expect(res.status).toBe(200);
    expect(res.body.actualReps).toBe(8);

    const fresh = await prisma.workoutSet.findUnique({ where: { id: setIdToEdit } });
    expect(fresh?.actualReps).toBe(8);
  });

  it("rejects editing another user's completed set with 404", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const exercises = await getExercisesBySlug(['bench-press']);
    const benchId = exercises['bench-press']!.id;

    const workout = await prisma.workout.create({
      data: {
        userId: owner.user.id,
        dayNumber: 1,
        status: 'completed',
        completedAt: new Date(),
        sets: {
          create: {
            exerciseId: benchId,
            exerciseOrder: 1,
            setOrder: 1,
            prescribedWeight: 100,
            prescribedReps: 5,
            actualReps: 5,
            completed: true,
          },
        },
      },
      include: { sets: true },
    });

    const res = await request(app)
      .patch(`/api/workouts/${workout.id}/sets/${workout.sets[0]!.id}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ actualReps: 8 });

    expect(res.status).toBe(404);
  });
});
