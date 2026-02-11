import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../config', () => ({
  config: {
    jwtSecret: 'test-secret',
    databaseUrl: 'postgresql://test',
    port: 3001,
    nodeEnv: 'test',
  },
}));

const mockUser = {
  id: 1,
  email: 'test@example.com',
  passwordHash: '$2b$10$hash',
  displayName: 'Test User',
  unitPreference: 'kg',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

vi.mock('../../lib/db', () => ({
  default: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import authRoutes from '../../routes/auth';
import prisma from '../../lib/db';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashedpassword' as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  describe('POST /api/auth/register', () => {
    it('returns 201 with tokens and user on success', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', displayName: 'Test User', unitPreference: 'kg' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 409 for duplicate email', async () => {
      const error = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      vi.mocked(prisma.user.create).mockRejectedValue(error);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'dup@example.com', password: 'password123', displayName: 'Dup', unitPreference: 'kg' });

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
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
    });

    it('returns 401 for wrong password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_FAILED');
    });

    it('returns 401 for unknown email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'unknown@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_FAILED');
    });
  });
});
