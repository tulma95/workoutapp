import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/db';

describe('Workouts API - Start and Read', () => {
  let token: string;
  let token2: string;

  beforeAll(async () => {
    // Register user and set up TMs
    const res = await request(app).post('/api/auth/register').send({
      email: 'workout-test@example.com',
      password: 'password123',
      displayName: 'Workout Test',
      unitPreference: 'kg',
    });
    token = res.body.accessToken;

    // Set up TMs: 1RMs → TMs (90%)
    // bench: 100→90, squat: 140→125 (126*0.9 rounded), ohp: 60→54 (actually 60*0.9=54), deadlift: 180→162.5 (180*0.9=162→round=162.5)
    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ oneRepMaxes: { bench: 100, squat: 140, ohp: 60, deadlift: 180 } });

    // Register a second user (no TMs)
    const res2 = await request(app).post('/api/auth/register').send({
      email: 'workout-test2@example.com',
      password: 'password123',
      displayName: 'Workout Test 2',
      unitPreference: 'kg',
    });
    token2 = res2.body.accessToken;
  });

  describe('POST /api/workouts', () => {
    it('creates a Day 2 workout with 17 sets (9 T1 + 8 T2)', async () => {
      const res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 2 });

      expect(res.status).toBe(201);
      expect(res.body.dayNumber).toBe(2);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.sets).toHaveLength(17);

      // Count T1 and T2 sets
      const t1Sets = res.body.sets.filter((s: { tier: string }) => s.tier === 'T1');
      const t2Sets = res.body.sets.filter((s: { tier: string }) => s.tier === 'T2');
      expect(t1Sets).toHaveLength(9);
      expect(t2Sets).toHaveLength(8);

      // T1 should be squat, T2 should be deadlift (sumo)
      expect(t1Sets[0].exercise).toBe('squat');
      expect(t2Sets[0].exercise).toBe('deadlift');
    });

    it('returns 400 when no TMs set', async () => {
      const res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token2}`)
        .send({ dayNumber: 1 });

      expect(res.status).toBe(400);
    });

    it('returns 409 with existing workout details when in-progress workout already exists', async () => {
      const res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 1 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EXISTING_WORKOUT');
      expect(res.body.workoutId).toBeDefined();
      expect(typeof res.body.workoutId).toBe('number');
      expect(res.body.dayNumber).toBe(2); // Day 2 workout is in progress from previous test
    });
  });

  describe('GET /api/workouts/current', () => {
    it('returns the in-progress workout with sets', async () => {
      const res = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toBeNull();
      expect(res.body.status).toBe('in_progress');
      expect(res.body.sets.length).toBeGreaterThan(0);
    });

    it('returns null when no workout in progress', async () => {
      const res = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });
  });

  describe('GET /api/workouts/:id', () => {
    it('returns workout with sets', async () => {
      // Get current workout first
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      const res = await request(app)
        .get(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(workoutId);
      expect(res.body.sets).toBeDefined();
    });

    it('returns 404 for wrong user', async () => {
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      const res = await request(app)
        .get(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/workouts/:id/sets/:setId', () => {
    it('updates actualReps and completed', async () => {
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const set = currentRes.body.sets[0];

      const res = await request(app)
        .patch(`/api/workouts/${currentRes.body.id}/sets/${set.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualReps: 5, completed: true });

      expect(res.status).toBe(200);
      expect(res.body.actualReps).toBe(5);
      expect(res.body.completed).toBe(true);
    });
  });

  describe('Day 2 T1 set 3 weight verification', () => {
    it('set 3 (95% of squat TM) should be correctly calculated', async () => {
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);

      // TM for squat = 140 * 0.9 = 126 → round to 125 (2.5kg)
      // Set 3 = 95% of 125 = 118.75 → round to 120
      const t1Sets = currentRes.body.sets.filter(
        (s: { tier: string }) => s.tier === 'T1',
      );
      const set3 = t1Sets[2]; // 0-indexed
      expect(set3.setOrder).toBe(3);
      expect(set3.prescribedWeight).toBe(120); // 95% of 125 = 118.75 → 120
    });
  });

  describe('DELETE /api/workouts/:id', () => {
    it('successfully cancels an in-progress workout (soft delete)', async () => {
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      const res = await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify workout is no longer returned by getCurrentWorkout (status: 'in_progress' filter)
      const checkRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      expect(checkRes.body).toBeNull();

      // Verify workout still exists in DB with status 'discarded'
      const workout = await prisma.workout.findUnique({
        where: { id: workoutId },
      });
      expect(workout).not.toBeNull();
      expect(workout?.status).toBe('discarded');
    });

    it('returns 404 when workout not found or wrong user', async () => {
      // Create a workout for user 1 first
      await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 3 });

      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      // Try to delete with user 2
      const res = await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(404);
    });

    it('returns 409 when workout is already completed', async () => {
      // Get current workout
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      // Complete the workout first
      // Log the progression AMRAP set (Day 3 has 95% set at position 3)
      const t1Sets = currentRes.body.sets.filter(
        (s: { tier: string }) => s.tier === 'T1',
      );
      const amrapSet = t1Sets.find(
        (s: { setOrder: number; isAmrap: boolean }) => s.setOrder === 3 && s.isAmrap,
      );
      await request(app)
        .patch(`/api/workouts/${workoutId}/sets/${amrapSet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualReps: 2, completed: true });

      await request(app)
        .post(`/api/workouts/${workoutId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      // Try to cancel the completed workout
      const res = await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Cannot cancel a completed workout');
    });

    it('discarded workouts do not appear in history', async () => {
      // Get baseline history count
      const beforeHistoryRes = await request(app)
        .get('/api/workouts/history')
        .set('Authorization', `Bearer ${token}`);
      const beforeCount = beforeHistoryRes.body.workouts.length;

      // Start a new workout first
      await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 1 });

      // Cancel the workout
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      // Check history - should have same count as before (discarded workout not included)
      const afterHistoryRes = await request(app)
        .get('/api/workouts/history')
        .set('Authorization', `Bearer ${token}`);

      expect(afterHistoryRes.status).toBe(200);
      expect(afterHistoryRes.body.workouts).toHaveLength(beforeCount);
      // Verify the discarded workout is not in the list
      const hasDiscardedWorkout = afterHistoryRes.body.workouts.some((w: any) => w.id === workoutId);
      expect(hasDiscardedWorkout).toBe(false);
    });

    it('discarded workouts do not appear in calendar', async () => {
      // Get baseline calendar count
      const now = new Date();
      const beforeCalendarRes = await request(app)
        .get(`/api/workouts/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .set('Authorization', `Bearer ${token}`);
      const beforeCount = beforeCalendarRes.body.workouts.length;

      // Start a new workout first
      await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 2 });

      // Cancel the workout
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      // Check calendar for current month - should have same count as before
      const afterCalendarRes = await request(app)
        .get(`/api/workouts/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .set('Authorization', `Bearer ${token}`);

      expect(afterCalendarRes.status).toBe(200);
      expect(afterCalendarRes.body.workouts).toHaveLength(beforeCount);
      // Verify the discarded workout is not in the list
      const hasDiscardedWorkout = afterCalendarRes.body.workouts.some((w: any) => w.id === workoutId);
      expect(hasDiscardedWorkout).toBe(false);
    });

    it('can start a new workout after discarding previous one', async () => {
      // Start a workout first
      await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 3 });

      // Discard the workout
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      // Start a new workout - should succeed
      const newWorkoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 4 });

      expect(newWorkoutRes.status).toBe(201);
      expect(newWorkoutRes.body.dayNumber).toBe(4);
      expect(newWorkoutRes.body.status).toBe('in_progress');
    });
  });

  describe('GET /api/workouts/calendar', () => {
    it('returns 400 if year or month is missing', async () => {
      const res1 = await request(app)
        .get('/api/workouts/calendar')
        .set('Authorization', `Bearer ${token}`);
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .get('/api/workouts/calendar?year=2026')
        .set('Authorization', `Bearer ${token}`);
      expect(res2.status).toBe(400);

      const res3 = await request(app)
        .get('/api/workouts/calendar?month=2')
        .set('Authorization', `Bearer ${token}`);
      expect(res3.status).toBe(400);
    });

    it('returns 400 if month is invalid', async () => {
      const res = await request(app)
        .get('/api/workouts/calendar?year=2026&month=13')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('returns correct workouts for the current month', async () => {
      // We have one completed workout from the previous test
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // 1-indexed

      const res = await request(app)
        .get(`/api/workouts/calendar?year=${year}&month=${month}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.workouts).toBeDefined();
      expect(Array.isArray(res.body.workouts)).toBe(true);

      // Should have at least 1 workout from this month
      expect(res.body.workouts.length).toBeGreaterThanOrEqual(1);

      // Each workout should have the correct shape
      const workout = res.body.workouts[0];
      expect(workout).toHaveProperty('id');
      expect(workout).toHaveProperty('dayNumber');
      expect(workout).toHaveProperty('status');
      expect(workout).toHaveProperty('completedAt');
      expect(workout).toHaveProperty('createdAt');

      // Should NOT include sets
      expect(workout.sets).toBeUndefined();
    });

    it('returns empty array for a month with no workouts', async () => {
      const res = await request(app)
        .get('/api/workouts/calendar?year=2020&month=1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.workouts).toEqual([]);
    });

    it('does not leak other users workouts', async () => {
      // token2 user has no workouts
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const res = await request(app)
        .get(`/api/workouts/calendar?year=${year}&month=${month}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.workouts).toEqual([]);
    });
  });

  describe('Workflow: Complete and Discard with Conflict Prevention', () => {
    it('allows starting a new workout after completing the previous one', async () => {
      // First, discard any existing in-progress workout from previous tests
      const existingRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      if (existingRes.body) {
        await request(app)
          .delete(`/api/workouts/${existingRes.body.id}`)
          .set('Authorization', `Bearer ${token}`);
      }

      // Start a fresh Day 2 workout
      const startRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 2 });
      expect(startRes.status).toBe(201);
      const workoutId = startRes.body.id;

      // Find the progression AMRAP set (95% set for Day 2 Squat)
      const progressionSet = startRes.body.sets.find(
        (s: { tier: string; isAmrap: boolean; prescribedWeight: number }) =>
          s.tier === 'T1' && s.isAmrap && s.prescribedWeight === 120
      );

      // Log the AMRAP reps
      await request(app)
        .patch(`/api/workouts/${workoutId}/sets/${progressionSet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualReps: 5, completed: true });

      // Complete the workout
      const completeRes = await request(app)
        .post(`/api/workouts/${workoutId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      expect(completeRes.status).toBe(200);

      // Now should be able to start a new workout
      const newWorkoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 1 });

      expect(newWorkoutRes.status).toBe(201);
      expect(newWorkoutRes.body.dayNumber).toBe(1);
      expect(newWorkoutRes.body.status).toBe('in_progress');
    });

    it('allows starting a new workout after discarding the previous one', async () => {
      // Get the current in-progress workout (Day 1 from previous test)
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      const workoutId = currentRes.body.id;

      // Discard the workout
      const discardRes = await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(discardRes.status).toBe(200);

      // Now should be able to start a new workout
      const newWorkoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 3 });

      expect(newWorkoutRes.status).toBe(201);
      expect(newWorkoutRes.body.dayNumber).toBe(3);
      expect(newWorkoutRes.body.status).toBe('in_progress');
    });
  });
});
