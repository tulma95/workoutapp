import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';

const uid = randomUUID().slice(0, 8);

describe('Exercises API', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `exercises-test-${uid}@example.com`,
      password: 'password123',
      username: `exercises_${uid}`,
    });
    token = res.body.accessToken;
  });

  describe('GET /api/exercises', () => {
    it('returns 401 when no auth token is provided', async () => {
      const res = await request(app).get('/api/exercises');
      expect(res.status).toBe(401);
    });

    it('returns 200 with an array of exercises when authenticated', async () => {
      const res = await request(app)
        .get('/api/exercises')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('each exercise item has id, slug, name, muscleGroup, category, and isUpperBody fields', async () => {
      const res = await request(app)
        .get('/api/exercises')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      for (const exercise of res.body) {
        expect(typeof exercise.id).toBe('number');
        expect(typeof exercise.slug).toBe('string');
        expect(typeof exercise.name).toBe('string');
        expect(typeof exercise.isUpperBody).toBe('boolean');
        expect(typeof exercise.category).toBe('string');
        // muscleGroup is nullable
        expect('muscleGroup' in exercise).toBe(true);
      }
    });

    it('results are sorted by name ascending', async () => {
      const res = await request(app)
        .get('/api/exercises')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const names: string[] = res.body.map((e: { name: string }) => e.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });
  });
});
