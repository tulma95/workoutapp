import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/db';

describe('Training Maxes API', () => {
  let token: string;
  let lbToken: string;
  let exerciseIds: { bench: number; squat: number; ohp: number; deadlift: number };

  beforeAll(async () => {
    // Register a kg user
    const res = await request(app).post('/api/auth/register').send({
      email: 'tm-test@example.com',
      password: 'password123',
      displayName: 'TM Test',
      unitPreference: 'kg',
    });
    token = res.body.accessToken;

    // Register an lb user
    const lbRes = await request(app).post('/api/auth/register').send({
      email: 'tm-lb@example.com',
      password: 'password123',
      displayName: 'LB Test',
      unitPreference: 'lb',
    });
    lbToken = lbRes.body.accessToken;

    // Get exercise IDs
    const exercises = await prisma.exercise.findMany({
      where: {
        slug: { in: ['bench-press', 'squat', 'ohp', 'deadlift'] },
      },
    });
    exerciseIds = {
      bench: exercises.find(e => e.slug === 'bench-press')!.id,
      squat: exercises.find(e => e.slug === 'squat')!.id,
      ohp: exercises.find(e => e.slug === 'ohp')!.id,
      deadlift: exercises.find(e => e.slug === 'deadlift')!.id,
    };
  });

  describe('GET /api/training-maxes', () => {
    it('returns empty array when no TMs set', async () => {
      const res = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 401 when no JWT provided', async () => {
      const res = await request(app).get('/api/training-maxes');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/training-maxes/setup', () => {
    it('creates TMs from 1RMs for kg user (TM = 90% of 1RM, rounded to 2.5kg)', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${token}`)
        .send({
          exerciseTMs: [
            { exerciseId: exerciseIds.bench, oneRepMax: 100 },
            { exerciseId: exerciseIds.squat, oneRepMax: 140 },
            { exerciseId: exerciseIds.ohp, oneRepMax: 60 },
            { exerciseId: exerciseIds.deadlift, oneRepMax: 180 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(4);

      const byExercise = Object.fromEntries(
        res.body.map((tm: { exercise: string }) => [tm.exercise, tm]),
      );
      expect(byExercise['bench-press'].weight).toBe(90); // 100 * 0.9 = 90
      expect(byExercise.squat.weight).toBe(125); // 140 * 0.9 = 126 → 126/2.5=50.4 → round(50.4)=50 → 125
    });

    it('returns latest TMs via GET after setup', async () => {
      const res = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(4);
    });

    it('creates TMs from 1RMs for lb user (converts lb→kg and returns in lb)', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${lbToken}`)
        .send({
          exerciseTMs: [
            { exerciseId: exerciseIds.bench, oneRepMax: 225 },
            { exerciseId: exerciseIds.squat, oneRepMax: 315 },
            { exerciseId: exerciseIds.ohp, oneRepMax: 135 },
            { exerciseId: exerciseIds.deadlift, oneRepMax: 405 },
          ],
        });

      expect(res.status).toBe(201);
      const byExercise = Object.fromEntries(
        res.body.map((tm: { exercise: string }) => [tm.exercise, tm]),
      );
      expect(byExercise['bench-press'].weight).toBe(205); // 225lb 1RM → 102.06kg → 91.86kg TM → 92.5kg rounded → 205lb
    });

    it('allows re-setup with different values', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${token}`)
        .send({
          exerciseTMs: [
            { exerciseId: exerciseIds.bench, oneRepMax: 110 },
            { exerciseId: exerciseIds.squat, oneRepMax: 150 },
            { exerciseId: exerciseIds.ohp, oneRepMax: 65 },
            { exerciseId: exerciseIds.deadlift, oneRepMax: 190 },
          ],
        });

      expect(res.status).toBe(201);

      const getRes = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);

      const byExercise = Object.fromEntries(
        getRes.body.map((tm: { exercise: string }) => [tm.exercise, tm]),
      );
      // 110 * 0.9 = 99 → round to 100
      expect(byExercise['bench-press'].weight).toBe(100);
    });

    it('rejects empty exerciseTMs array', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${token}`)
        .send({ exerciseTMs: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/training-maxes/:exercise', () => {
    it('updates a specific TM', async () => {
      const res = await request(app)
        .patch('/api/training-maxes/bench-press')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight: 95 });

      expect(res.status).toBe(200);
      expect(res.body.weight).toBe(95);

      const getRes = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);

      const bench = getRes.body.find((tm: { exercise: string }) => tm.exercise === 'bench-press');
      expect(bench.weight).toBe(95);
    });

    it('converts lb weight to kg for storage and returns in lb for lb user', async () => {
      // 200lb → 200/2.20462 = 90.72kg → rounded to 90kg → converted back: 90*2.20462 = 198.42lb → rounded to 200lb
      const res = await request(app)
        .patch('/api/training-maxes/bench-press')
        .set('Authorization', `Bearer ${lbToken}`)
        .send({ weight: 200 });

      expect(res.status).toBe(200);
      expect(res.body.weight).toBe(200); // 200lb → 90.72kg → 90kg → 200lb
    });

    it('rejects invalid exercise name', async () => {
      const res = await request(app)
        .patch('/api/training-maxes/bicep')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight: 50 });

      expect(res.status).toBe(400);
    });

    it('rejects negative weight', async () => {
      const res = await request(app)
        .patch('/api/training-maxes/bench-press')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight: -10 });

      expect(res.status).toBe(400);
    });

    it('rejects zero weight', async () => {
      const res = await request(app)
        .patch('/api/training-maxes/bench-press')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight: 0 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/training-maxes/:exercise/history', () => {
    it('returns history ordered by effective date desc', async () => {
      const res = await request(app)
        .get('/api/training-maxes/bench-press/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // All entries should be bench-press
      for (const entry of res.body) {
        expect(entry.exercise).toBe('bench-press');
      }
    });

    it('rejects invalid exercise name', async () => {
      const res = await request(app)
        .get('/api/training-maxes/bicep/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/training-maxes/setup with exerciseTMs format', () => {
    let newUserToken: string;

    beforeAll(async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'tm-exercise-ids@example.com',
        password: 'password123',
        displayName: 'Exercise IDs Test',
        unitPreference: 'kg',
      });
      newUserToken = res.body.accessToken;
    });

    it('creates TMs from exerciseTMs array with exercise IDs', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          exerciseTMs: [
            { exerciseId: exerciseIds.bench, oneRepMax: 100 },
            { exerciseId: exerciseIds.squat, oneRepMax: 140 },
            { exerciseId: exerciseIds.ohp, oneRepMax: 60 },
            { exerciseId: exerciseIds.deadlift, oneRepMax: 180 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(4);

      const benchTM = res.body.find((tm: any) => tm.exercise === 'bench-press');
      expect(benchTM).toBeDefined();
      expect(benchTM.exerciseId).toBe(exerciseIds.bench);
      expect(benchTM.weight).toBe(90); // 100 * 0.9 = 90

      const squatTM = res.body.find((tm: any) => tm.exercise === 'squat');
      expect(squatTM).toBeDefined();
      expect(squatTM.exerciseId).toBe(exerciseIds.squat);
      expect(squatTM.weight).toBe(125); // 140 * 0.9 = 126 → rounded to 125
    });

    it('returns TMs via GET after setup with exerciseTMs', async () => {
      const res = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${newUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(4);

      // Verify exerciseId is populated
      for (const tm of res.body) {
        expect(tm.exerciseId).toBeDefined();
        expect(typeof tm.exerciseId).toBe('number');
      }
    });

    it('rejects invalid exercise ID', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          exerciseTMs: [
            { exerciseId: 99999, oneRepMax: 100 },
          ],
        });

      expect(res.status).toBe(500);
    });

    it('rejects empty exerciseTMs array', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          exerciseTMs: [],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/training-maxes with active plan', () => {
    let planUserToken: string;
    let planUserId: number;

    beforeAll(async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'tm-plan@example.com',
        password: 'password123',
        displayName: 'Plan Test User',
        unitPreference: 'kg',
      });
      planUserToken = res.body.accessToken;
      planUserId = res.body.user.id;

      // Create a test plan with exercises
      const plan = await prisma.workoutPlan.create({
        data: {
          name: 'Test Plan',
          slug: 'test-plan-tm',
          description: 'Test plan for TM tests',
          daysPerWeek: 4,
          isPublic: true,
          days: {
            create: [
              {
                dayNumber: 1,
                name: 'Day 1',
                exercises: {
                  create: [
                    { exerciseId: exerciseIds.bench, tmExerciseId: exerciseIds.bench, tier: 'T1', sortOrder: 1 },
                    { exerciseId: exerciseIds.ohp, tmExerciseId: exerciseIds.ohp, tier: 'T2', sortOrder: 2 },
                  ],
                },
              },
              {
                dayNumber: 2,
                name: 'Day 2',
                exercises: {
                  create: [
                    { exerciseId: exerciseIds.squat, tmExerciseId: exerciseIds.squat, tier: 'T1', sortOrder: 1 },
                    { exerciseId: exerciseIds.deadlift, tmExerciseId: exerciseIds.deadlift, tier: 'T2', sortOrder: 2 },
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
          userId: planUserId,
          planId: plan.id,
          isActive: true,
        },
      });
    });

    it('returns TMs for plan exercises when user has active plan', async () => {
      // Set up TMs
      await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${planUserToken}`)
        .send({
          exerciseTMs: [
            { exerciseId: exerciseIds.bench, oneRepMax: 100 },
            { exerciseId: exerciseIds.squat, oneRepMax: 140 },
            { exerciseId: exerciseIds.ohp, oneRepMax: 60 },
            { exerciseId: exerciseIds.deadlift, oneRepMax: 180 },
          ],
        });

      const res = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${planUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);

      const exercises = res.body.map((tm: any) => tm.exercise);
      expect(exercises).toContain('bench-press');
      expect(exercises).toContain('squat');
      expect(exercises).toContain('ohp');
      expect(exercises).toContain('deadlift');
    });

    it('falls back to all TMs when no active plan', async () => {
      // Register a user without a plan
      const res = await request(app).post('/api/auth/register').send({
        email: 'tm-no-plan@example.com',
        password: 'password123',
        displayName: 'No Plan User',
        unitPreference: 'kg',
      });
      const noPlanToken = res.body.accessToken;

      // Set up TMs
      await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${noPlanToken}`)
        .send({
          exerciseTMs: [
            { exerciseId: exerciseIds.bench, oneRepMax: 100 },
            { exerciseId: exerciseIds.squat, oneRepMax: 140 },
            { exerciseId: exerciseIds.ohp, oneRepMax: 60 },
            { exerciseId: exerciseIds.deadlift, oneRepMax: 180 },
          ],
        });

      // GET should return 4 TMs even without a plan
      const getRes = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${noPlanToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveLength(4);
    });
  });
});
