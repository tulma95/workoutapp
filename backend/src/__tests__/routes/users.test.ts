import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';

let accessToken: string;

describe('User routes', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'userroute@example.com', password: 'password123', displayName: 'Test User', unitPreference: 'kg' });

    accessToken = res.body.accessToken;
  });

  describe('GET /api/users/me', () => {
    it('returns user without passwordHash', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'userroute@example.com');
      expect(res.body).toHaveProperty('displayName', 'Test User');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('updates displayName', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ displayName: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('New Name');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('updates unitPreference', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ unitPreference: 'lb' });

      expect(res.status).toBe(200);
      expect(res.body.unitPreference).toBe('lb');
    });

    it('returns 400 for invalid unitPreference', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ unitPreference: 'stones' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
