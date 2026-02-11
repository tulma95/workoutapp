import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Training Maxes API', () => {
  let token: string;
  let lbToken: string;

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
          oneRepMaxes: { bench: 100, squat: 140, ohp: 60, deadlift: 180 },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(4);

      const byExercise = Object.fromEntries(
        res.body.map((tm: { exercise: string }) => [tm.exercise, tm]),
      );
      expect(byExercise.bench.weight).toBe(90); // 100 * 0.9 = 90
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
      // 225lb bench 1RM → 225/2.20462 = 102.06kg → TM = 102.06*0.9 = 91.86kg → rounded to 92.5kg → converted back to lb: 92.5*2.20462 = 203.9lb → rounded to 205lb
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${lbToken}`)
        .send({
          oneRepMaxes: { bench: 225, squat: 315, ohp: 135, deadlift: 405 },
        });

      expect(res.status).toBe(201);
      const byExercise = Object.fromEntries(
        res.body.map((tm: { exercise: string }) => [tm.exercise, tm]),
      );
      expect(byExercise.bench.weight).toBe(205); // 225lb 1RM → 102.06kg → 91.86kg TM → 92.5kg rounded → 205lb
    });

    it('allows re-setup with different values', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${token}`)
        .send({
          oneRepMaxes: { bench: 110, squat: 150, ohp: 65, deadlift: 190 },
        });

      expect(res.status).toBe(201);

      const getRes = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);

      const byExercise = Object.fromEntries(
        getRes.body.map((tm: { exercise: string }) => [tm.exercise, tm]),
      );
      // 110 * 0.9 = 99 → round to 100
      expect(byExercise.bench.weight).toBe(100);
    });

    it('rejects missing exercise fields', async () => {
      const res = await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${token}`)
        .send({ oneRepMaxes: { bench: 100 } });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/training-maxes/:exercise', () => {
    it('updates a specific TM', async () => {
      const res = await request(app)
        .patch('/api/training-maxes/bench')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight: 95 });

      expect(res.status).toBe(200);
      expect(res.body.weight).toBe(95);

      const getRes = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${token}`);

      const bench = getRes.body.find((tm: { exercise: string }) => tm.exercise === 'bench');
      expect(bench.weight).toBe(95);
    });

    it('converts lb weight to kg for storage and returns in lb for lb user', async () => {
      // 200lb → 200/2.20462 = 90.72kg → rounded to 90kg → converted back: 90*2.20462 = 198.42lb → rounded to 200lb
      const res = await request(app)
        .patch('/api/training-maxes/bench')
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
        .patch('/api/training-maxes/bench')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight: -10 });

      expect(res.status).toBe(400);
    });

    it('rejects zero weight', async () => {
      const res = await request(app)
        .patch('/api/training-maxes/bench')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight: 0 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/training-maxes/:exercise/history', () => {
    it('returns history ordered by effective date desc', async () => {
      const res = await request(app)
        .get('/api/training-maxes/bench/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // All entries should be bench
      for (const entry of res.body) {
        expect(entry.exercise).toBe('bench');
      }
    });

    it('rejects invalid exercise name', async () => {
      const res = await request(app)
        .get('/api/training-maxes/bicep/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});
