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

  describe('PATCH /api/users/me/password', () => {
    async function newUser() {
      const id = randomUUID().slice(0, 8);
      const email = `pw-${id}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'original123', username: `pw${id}` });
      return { email, token: res.body.accessToken as string };
    }

    it('changes the password when the current password is correct', async () => {
      const { email, token } = await newUser();

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'original123', newPassword: 'brandnew456' });
      expect(res.status).toBe(204);

      // New password works, old one no longer does.
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'brandnew456' });
      expect(newLogin.status).toBe(200);

      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'original123' });
      expect(oldLogin.status).toBe(401);
    });

    it('rejects an incorrect current password with 400 and leaves the password unchanged', async () => {
      const { email, token } = await newUser();

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'brandnew456' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');

      // Original password still valid.
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'original123' });
      expect(login.status).toBe(200);
    });

    it('rejects a too-short new password with 400', async () => {
      const { token } = await newUser();

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'original123', newPassword: 'short' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .patch('/api/users/me/password')
        .send({ currentPassword: 'original123', newPassword: 'brandnew456' });
      expect(res.status).toBe(401);
    });
  });
});
