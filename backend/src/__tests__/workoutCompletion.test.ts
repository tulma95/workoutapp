import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Workouts API - Completion and Progression', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'completion-test@example.com',
      password: 'password123',
      displayName: 'Completion Test',
      unitPreference: 'kg',
    });
    token = res.body.accessToken;

    // Set up TMs: bench 90, squat 125, ohp 54, deadlift 162.5
    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ oneRepMaxes: { bench: 100, squat: 140, ohp: 60, deadlift: 180 } });
  });

  async function startAndGetWorkout(dayNumber: number) {
    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayNumber });
    return res.body;
  }

  async function completeCurrentWorkout(
    workoutId: number,
    amrapSetId: number,
    amrapReps: number | null,
  ) {
    // Log reps on the AMRAP set if provided
    if (amrapReps !== null) {
      await request(app)
        .patch(`/api/workouts/${workoutId}/sets/${amrapSetId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualReps: amrapReps, completed: true });
    }

    const res = await request(app)
      .post(`/api/workouts/${workoutId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    return res.body;
  }

  describe('Day 2 completion with 3 reps on AMRAP (95%)', () => {
    it('increases squat TM by 2.5kg', async () => {
      const workout = await startAndGetWorkout(2);

      // Day 2: T1 progression AMRAP is set 3 (95%, setOrder=3)
      const progressionSet = workout.sets.find(
        (s: { tier: string; setOrder: number; isAmrap: boolean }) =>
          s.tier === 'T1' && s.setOrder === 3 && s.isAmrap,
      );
      expect(progressionSet).toBeDefined();

      const result = await completeCurrentWorkout(workout.id, progressionSet.id, 3);

      expect(result.workout.status).toBe('completed');
      expect(result.progression).not.toBeNull();
      expect(result.progression.exercise).toBe('squat');
      expect(result.progression.increase).toBe(2.5);

      // Verify TM was updated
      const tmRes = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);
      const squatTM = tmRes.body.find(
        (tm: { exercise: string }) => tm.exercise === 'squat',
      );
      expect(squatTM.weight).toBe(result.progression.previousTM + 2.5);
    });
  });

  describe('Day 2 completion with 0 reps on AMRAP', () => {
    it('does not increase squat TM', async () => {
      // Get current squat TM
      const tmBefore = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);
      const squatBefore = tmBefore.body.find(
        (tm: { exercise: string }) => tm.exercise === 'squat',
      );

      const workout = await startAndGetWorkout(2);
      const progressionSet = workout.sets.find(
        (s: { tier: string; setOrder: number; isAmrap: boolean }) =>
          s.tier === 'T1' && s.setOrder === 3 && s.isAmrap,
      );

      const result = await completeCurrentWorkout(workout.id, progressionSet.id, 0);

      expect(result.workout.status).toBe('completed');
      expect(result.progression).toBeNull();

      // Verify TM unchanged
      const tmAfter = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);
      const squatAfter = tmAfter.body.find(
        (tm: { exercise: string }) => tm.exercise === 'squat',
      );
      expect(squatAfter.weight).toBe(squatBefore.weight);
    });
  });

  describe('Day 2 completion with 6+ reps on AMRAP', () => {
    it('increases squat TM by 7.5kg', async () => {
      const workout = await startAndGetWorkout(2);
      const progressionSet = workout.sets.find(
        (s: { tier: string; setOrder: number; isAmrap: boolean }) =>
          s.tier === 'T1' && s.setOrder === 3 && s.isAmrap,
      );

      const result = await completeCurrentWorkout(workout.id, progressionSet.id, 8);

      expect(result.progression).not.toBeNull();
      expect(result.progression.increase).toBe(7.5);
    });
  });

  describe('Completion without AMRAP reps logged', () => {
    it('completes workout with no TM change', async () => {
      const tmBefore = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);
      const squatBefore = tmBefore.body.find(
        (tm: { exercise: string }) => tm.exercise === 'squat',
      );

      const workout = await startAndGetWorkout(2);
      // Don't log any reps, just complete workout directly without logging AMRAP
      const res = await request(app)
        .post(`/api/workouts/${workout.id}/complete`)
        .set('Authorization', `Bearer ${token}`);
      const result = res.body;

      expect(result.workout.status).toBe('completed');
      expect(result.progression).toBeNull();

      const tmAfter = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);
      const squatAfter = tmAfter.body.find(
        (tm: { exercise: string }) => tm.exercise === 'squat',
      );
      expect(squatAfter.weight).toBe(squatBefore.weight);
    });
  });

  describe('Completion with skipped sets', () => {
    it('still completes successfully', async () => {
      const workout = await startAndGetWorkout(2);
      // Only complete the AMRAP set, skip everything else
      const progressionSet = workout.sets.find(
        (s: { tier: string; setOrder: number; isAmrap: boolean }) =>
          s.tier === 'T1' && s.setOrder === 3 && s.isAmrap,
      );

      await request(app)
        .patch(`/api/workouts/${workout.id}/sets/${progressionSet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualReps: 2, completed: true });

      const result = await completeCurrentWorkout(workout.id, progressionSet.id, 2);
      expect(result.workout.status).toBe('completed');
    });
  });

  describe('Day 1 completion', () => {
    it('uses set 9 (65% AMRAP) for progression', async () => {
      const workout = await startAndGetWorkout(1);

      // Day 1: only T1 AMRAP is set 9 (65%)
      const progressionSet = workout.sets.find(
        (s: { tier: string; setOrder: number; isAmrap: boolean }) =>
          s.tier === 'T1' && s.setOrder === 9 && s.isAmrap,
      );
      expect(progressionSet).toBeDefined();

      const result = await completeCurrentWorkout(workout.id, progressionSet.id, 12);

      expect(result.workout.status).toBe('completed');
      // Bench is upper body, 6+ reps = +5kg
      expect(result.progression).not.toBeNull();
      expect(result.progression.exercise).toBe('bench');
      expect(result.progression.increase).toBe(5);
    });
  });

  describe('GET /api/workouts/history', () => {
    it('returns completed workouts with pagination', async () => {
      const res = await request(app)
        .get('/api/workouts/history?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.workouts).toHaveLength(2);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
    });

    it('returns workouts ordered by completedAt DESC', async () => {
      const res = await request(app)
        .get('/api/workouts/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const dates = res.body.workouts.map(
        (w: { completedAt: string }) => new Date(w.completedAt).getTime(),
      );
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });
});
