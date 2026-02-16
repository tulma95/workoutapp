import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import app from '../../app';
import { config } from '../../config';

describe('Auth routes', () => {
  const uid = randomUUID().slice(0, 8);
  describe('POST /api/auth/register', () => {
    it('returns 201 with tokens and user on success', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: `register-${uid}@example.com`, password: 'password123', displayName: 'Test User' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user.email).toBe(`register-${uid}@example.com`);

      const decoded = jwt.verify(res.body.accessToken, config.jwtSecret) as { userId: number; email: string };
      expect(decoded.email).toBe(`register-${uid}@example.com`);
      expect(decoded.userId).toBe(res.body.user.id);
    });

    it('returns 409 for duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: `dup-${uid}@example.com`, password: 'password123', displayName: 'First' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: `dup-${uid}@example.com`, password: 'password123', displayName: 'Second' });

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
        .send({ email: `login-${uid}@example.com`, password: 'password123', displayName: 'Login User' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `login-${uid}@example.com`, password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(`login-${uid}@example.com`);
    });

    it('returns 401 for wrong password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: `wrongpw-${uid}@example.com`, password: 'password123', displayName: 'User' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `wrongpw-${uid}@example.com`, password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_FAILED');
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `unknown-${uid}@example.com`, password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_FAILED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new tokens with valid refresh token', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email: `refresh-${uid}@example.com`, password: 'password123', displayName: 'Refresh User' });

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
        .send({ email: `wrongtype-${uid}@example.com`, password: 'password123', displayName: 'User' });

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
        .send({ email: `normaluser-${uid}@example.com`, password: 'password123', displayName: 'Normal User' });

      expect(res.status).toBe(201);
      expect(res.body.user.isAdmin).toBe(false);

      const decoded = jwt.verify(res.body.accessToken, config.jwtSecret) as { userId: number; email: string; isAdmin: boolean };
      expect(decoded.isAdmin).toBe(false);
    });

    it('login returns isAdmin in user object and token', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: `checkadmin-${uid}@example.com`, password: 'password123', displayName: 'Check Admin' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `checkadmin-${uid}@example.com`, password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('isAdmin');
      expect(res.body.user.isAdmin).toBe(false);

      const decoded = jwt.verify(res.body.accessToken, config.jwtSecret) as { userId: number; email: string; isAdmin: boolean };
      expect(decoded.isAdmin).toBe(false);
    });
  });
});
