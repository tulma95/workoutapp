import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/db';
import { createTestUser, getExercisesBySlug } from './helpers';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('GET /api/workouts/stats', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/workouts/stats')).status).toBe(401);
  });

  it('returns the consecutive-day streak and last-7-day count', async () => {
    const { user, token } = await createTestUser();
    // Today + yesterday (a 2-day streak), plus one 10 days ago (outside both windows).
    for (const offset of [0, 1, 10]) {
      await prisma.workout.create({
        data: { userId: user.id, dayNumber: 1, status: 'completed', completedAt: daysAgo(offset) },
      });
    }

    const res = await request(app)
      .get('/api/workouts/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(2);
    expect(res.body.workoutsLast7Days).toBe(2);
  });

  it('ignores in-progress workouts and returns zeros with none completed', async () => {
    const { user, token } = await createTestUser();
    await prisma.workout.create({
      data: { userId: user.id, dayNumber: 1, status: 'in_progress', completedAt: null },
    });

    const res = await request(app)
      .get('/api/workouts/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.currentStreak).toBe(0);
    expect(res.body.workoutsLast7Days).toBe(0);
  });
});

describe('GET /api/workouts/latest', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/workouts/latest')).status).toBe(401);
  });

  it('returns null when there are no completed workouts', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .get('/api/workouts/latest')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns the most recently completed workout, with its sets', async () => {
    const { user, token } = await createTestUser();
    const ex = await getExercisesBySlug(['bench-press']);
    const benchId = ex['bench-press']!.id;

    await prisma.workout.create({
      data: { userId: user.id, dayNumber: 1, status: 'completed', completedAt: daysAgo(5) },
    });
    const newest = await prisma.workout.create({
      data: {
        userId: user.id,
        dayNumber: 2,
        status: 'completed',
        completedAt: daysAgo(1),
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
    });

    const res = await request(app)
      .get('/api/workouts/latest')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(newest.id);
    expect(res.body.dayNumber).toBe(2);
    expect(res.body.sets).toHaveLength(1);
  });

  it('ignores in-progress workouts', async () => {
    const { user, token } = await createTestUser();
    await prisma.workout.create({
      data: { userId: user.id, dayNumber: 1, status: 'in_progress', completedAt: null },
    });
    const res = await request(app)
      .get('/api/workouts/latest')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body).toBeNull();
  });
});
