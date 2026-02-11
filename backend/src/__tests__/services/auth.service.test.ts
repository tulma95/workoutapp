import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

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
  passwordHash: '$2b$10$hashedpassword',
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

import { register, login } from '../../services/auth.service';
import prisma from '../../lib/db';

const SECRET = 'test-secret';

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('creates user with hashed password and returns tokens', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const result = await register('test@example.com', 'password123', 'Test User');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          passwordHash: expect.any(String),
          displayName: 'Test User',
          unitPreference: 'kg',
        },
      });
      // Verify password was hashed (not plain text)
      const callArg = vi.mocked(prisma.user.create).mock.calls[0][0];
      expect(callArg.data.passwordHash).not.toBe('password123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toHaveProperty('email', 'test@example.com');
    });

    it('returned user object does not contain passwordHash', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const result = await register('test@example.com', 'password123', 'Test User');

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate email (Prisma P2002)', async () => {
      const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      vi.mocked(prisma.user.create).mockRejectedValue(error);

      await expect(register('dup@example.com', 'password123', 'Dup')).rejects.toThrow();
    });

    it('access token contains userId and email', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const result = await register('test@example.com', 'password123', 'Test User');
      const decoded = jwt.verify(result.accessToken, SECRET) as { userId: number; email: string };

      expect(decoded.userId).toBe(1);
      expect(decoded.email).toBe('test@example.com');
    });

    it('refresh token contains userId and type:refresh', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const result = await register('test@example.com', 'password123', 'Test User');
      const decoded = jwt.verify(result.refreshToken, SECRET) as { userId: number; type: string };

      expect(decoded.userId).toBe(1);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('login', () => {
    it('succeeds with correct credentials', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('password123', 10);
      const userWithHash = { ...mockUser, passwordHash: hash };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);

      const result = await login('test@example.com', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('fails with wrong password', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correctpassword', 10);
      const userWithHash = { ...mockUser, passwordHash: hash };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);

      await expect(login('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid email or password');
    });

    it('fails with unknown email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(login('unknown@example.com', 'password123')).rejects.toThrow('Invalid email or password');
    });
  });
});
