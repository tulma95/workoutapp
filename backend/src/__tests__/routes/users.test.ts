import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

vi.mock('../../config', () => ({
  config: {
    jwtSecret: 'test-secret',
    databaseUrl: 'postgresql://test',
    port: 3001,
    nodeEnv: 'test',
  },
}));

const SECRET = 'test-secret';

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
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import userRoutes from '../../routes/users';
import prisma from '../../lib/db';

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

function validToken() {
  return jwt.sign({ userId: 1, email: 'test@example.com' }, SECRET, { expiresIn: '1h' });
}

describe('User routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/users/me', () => {
    it('returns user without passwordHash', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'test@example.com');
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
      const updated = { ...mockUser, displayName: 'New Name' };
      vi.mocked(prisma.user.update).mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken()}`)
        .send({ displayName: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('New Name');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('updates unitPreference', async () => {
      const updated = { ...mockUser, unitPreference: 'lb' };
      vi.mocked(prisma.user.update).mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken()}`)
        .send({ unitPreference: 'lb' });

      expect(res.status).toBe(200);
      expect(res.body.unitPreference).toBe('lb');
    });

    it('returns 400 for invalid unitPreference', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken()}`)
        .send({ unitPreference: 'stones' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
