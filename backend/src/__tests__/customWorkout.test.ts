import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

describe('POST /api/workouts/custom', () => {
  let token: string;
  let exerciseId: number;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `custom-workout-${uid}@example.com`,
      password: 'password123',
      username: `custom_workout_${uid}`,
    });
    token = res.body.accessToken;

    const exercise = await prisma.exercise.findFirst({ orderBy: { id: 'asc' } });
    if (!exercise) throw new Error('No exercises found in test DB');
    exerciseId = exercise.id;
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/workouts/custom').send({
      date: '2025-06-15',
      exercises: [{ exerciseId: 1, sets: [{ weight: 100, reps: 5 }] }],
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: 'not-a-date', exercises: [{ exerciseId, sets: [{ weight: 100, reps: 5 }] }] });
    expect(res.status).toBe(400);
  });

  it('returns 400 for date with wrong separator format', async () => {
    const res = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2025/06/15',
        exercises: [{ exerciseId, sets: [{ weight: 100, reps: 5 }] }],
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty exercises array', async () => {
    const res = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2025-06-15', exercises: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid exerciseId (does not exist)', async () => {
    const res = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2025-06-15',
        exercises: [{ exerciseId: 999999, sets: [{ weight: 100, reps: 5 }] }],
      });
    expect(res.status).toBe(400);
  });

  it('returns 201 with isCustom:true for valid payload', async () => {
    const res = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2025-06-15',
        exercises: [
          {
            exerciseId,
            sets: [
              { weight: 100, reps: 5 },
              { weight: 100, reps: 5 },
            ],
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.isCustom).toBe(true);
    expect(res.body.dayNumber).toBe(0);
    expect(res.body.status).toBe('completed');
    expect(res.body.sets).toHaveLength(2);
  });

  it('custom workout appears in GET /api/workouts/calendar', async () => {
    const createRes = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2025-07-15',
        exercises: [{ exerciseId, sets: [{ weight: 80, reps: 8 }] }],
      });
    expect(createRes.status).toBe(201);
    const workoutId = createRes.body.id;

    const calRes = await request(app)
      .get('/api/workouts/calendar?year=2025&month=7')
      .set('Authorization', `Bearer ${token}`);
    expect(calRes.status).toBe(200);

    const ids = calRes.body.workouts.map((w: { id: number }) => w.id);
    expect(ids).toContain(workoutId);
  });

  it('calendar workouts include isCustom field', async () => {
    const createRes = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2025-09-10',
        exercises: [{ exerciseId, sets: [{ weight: 70, reps: 6 }] }],
      });
    expect(createRes.status).toBe(201);
    const workoutId = createRes.body.id;

    const calRes = await request(app)
      .get('/api/workouts/calendar?year=2025&month=9')
      .set('Authorization', `Bearer ${token}`);
    expect(calRes.status).toBe(200);

    const match = calRes.body.workouts.find((w: { id: number }) => w.id === workoutId);
    expect(match).toBeDefined();
    expect(match.isCustom).toBe(true);
  });

  it('GET /api/workouts/:id returns isCustom:true for custom workout', async () => {
    const createRes = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2025-08-15',
        exercises: [{ exerciseId, sets: [{ weight: 60, reps: 10 }] }],
      });
    expect(createRes.status).toBe(201);
    const workoutId = createRes.body.id;

    const getRes = await request(app)
      .get(`/api/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.isCustom).toBe(true);
    expect(getRes.body.dayNumber).toBe(0);
  });

  it('creates a workout_completed feed event for a normal custom workout', async () => {
    const uid2 = randomUUID().slice(0, 8);
    const regRes = await request(app).post('/api/auth/register').send({
      email: `custom-feed-${uid2}@example.com`,
      password: 'password123',
      username: `custom_feed_${uid2}`,
    });
    const feedToken = regRes.body.accessToken;
    const userId = regRes.body.user.id;

    const createRes = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${feedToken}`)
      .send({
        date: '2025-06-20',
        exercises: [{ exerciseId, sets: [{ weight: 50, reps: 5 }] }],
      });
    expect(createRes.status).toBe(201);
    const workoutId = createRes.body.id;

    const event = await prisma.feedEvent.findFirst({
      where: { userId, eventType: 'workout_completed' },
    });
    expect(event).not.toBeNull();
    const payload = event!.payload as { workoutId: number; isCustom: boolean };
    expect(payload.workoutId).toBe(workoutId);
    expect(payload.isCustom).toBe(true);
  });
});

describe('Custom workout streak_milestone', () => {
  let token: string;
  let userId: number;
  let exerciseId: number;

  beforeAll(async () => {
    const uid2 = randomUUID().slice(0, 8);
    const regRes = await request(app).post('/api/auth/register').send({
      email: `custom-streak-${uid2}@example.com`,
      password: 'password123',
      username: `custom_streak_${uid2}`,
    });
    token = regRes.body.accessToken;
    userId = regRes.body.user.id;

    const exercise = await prisma.exercise.findFirst({ orderBy: { id: 'asc' } });
    if (!exercise) throw new Error('No exercises found in test DB');
    exerciseId = exercise.id;

    // Insert 6 prior completed workouts (days -6 to -1 from today) to set up a 6-day streak
    for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
      const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      await prisma.workout.create({
        data: {
          userId,
          dayNumber: 0,
          status: 'completed',
          completedAt,
        },
      });
    }
  });

  it('creates a streak_milestone feed event when custom workout pushes streak to 7', async () => {
    // Today's date as YYYY-MM-DD
    const today = new Date().toISOString().slice(0, 10);

    const createRes = await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: today,
        exercises: [{ exerciseId, sets: [{ weight: 80, reps: 5 }] }],
      });
    expect(createRes.status).toBe(201);

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

  it('does not create a duplicate streak_milestone when custom workout is created at same streak level', async () => {
    // Create another custom workout for today (same streak level, already has the milestone)
    const today = new Date().toISOString().slice(0, 10);

    await request(app)
      .post('/api/workouts/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: today,
        exercises: [{ exerciseId, sets: [{ weight: 80, reps: 5 }] }],
      });

    const events = await prisma.feedEvent.findMany({
      where: {
        userId,
        eventType: 'streak_milestone',
        payload: { path: ['days'], equals: 7 },
      },
    });

    expect(events.length).toBe(1);
  });
});
