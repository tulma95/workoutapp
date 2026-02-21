import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';

const uid = randomUUID().slice(0, 8);
let accessToken: string;

describe('User routes', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `userroute-${uid}@example.com`, password: 'password123', username: `userroute${uid}` });

    accessToken = res.body.accessToken;
  });

  describe('GET /api/users/me', () => {
    it('returns user without passwordHash', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', `userroute-${uid}@example.com`);
      expect(res.body).toHaveProperty('username', `userroute${uid}`);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('updates username', async () => {
      const newUsername = `updated${uid}`;
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: newUsername });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe(newUsername);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });
});
