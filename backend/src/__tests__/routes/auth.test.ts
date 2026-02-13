import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { config } from '../../config';

describe('Auth routes', () => {
  describe('POST /api/auth/register', () => {
    it('returns 201 with tokens and user on success', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'register@example.com', password: 'password123', displayName: 'Test User', unitPreference: 'kg' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user.email).toBe('register@example.com');

      const decoded = jwt.verify(res.body.accessToken, config.jwtSecret) as { userId: number; email: string };
      expect(decoded.email).toBe('register@example.com');
      expect(decoded.userId).toBe(res.body.user.id);
    });

    it('returns 409 for duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'dup@example.com', password: 'password123', displayName: 'First', unitPreference: 'kg' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'dup@example.com', password: 'password123', displayName: 'Second', unitPreference: 'kg' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('returns 400 for invalid body', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with tokens on success', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'login@example.com', password: 'password123', displayName: 'Login User', unitPreference: 'kg' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('login@example.com');
    });

    it('returns 401 for wrong password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'wrongpw@example.com', password: 'password123', displayName: 'User', unitPreference: 'kg' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrongpw@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_FAILED');
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'unknown@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_FAILED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new tokens with valid refresh token', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'refresh@example.com', password: 'password123', displayName: 'Refresh User', unitPreference: 'kg' });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: registerRes.body.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('returns 401 for expired refresh token', async () => {
      const refreshToken = jwt.sign({ userId: 1, type: 'refresh' }, config.jwtSecret, { expiresIn: '-1s' });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    it('returns 401 when using access token as refresh token', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'wrongtype@example.com', password: 'password123', displayName: 'User', unitPreference: 'kg' });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: registerRes.body.accessToken });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });
  });

  describe('Admin field in responses', () => {
    it('register returns isAdmin false for normal users', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'normaluser@example.com', password: 'password123', displayName: 'Normal User', unitPreference: 'kg' });

      expect(res.status).toBe(201);
      expect(res.body.user.isAdmin).toBe(false);

      const decoded = jwt.verify(res.body.accessToken, config.jwtSecret) as { userId: number; email: string; isAdmin: boolean };
      expect(decoded.isAdmin).toBe(false);
    });

    it('login returns isAdmin in user object and token', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'checkadmin@example.com', password: 'password123', displayName: 'Check Admin', unitPreference: 'kg' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'checkadmin@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('isAdmin');
      expect(res.body.user.isAdmin).toBe(false);

      const decoded = jwt.verify(res.body.accessToken, config.jwtSecret) as { userId: number; email: string; isAdmin: boolean };
      expect(decoded.isAdmin).toBe(false);
    });
  });
});
