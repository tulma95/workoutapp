import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { register, login } from '../../services/auth.service';
import { config } from '../../config';

describe('auth.service', () => {
  describe('register', () => {
    it('creates user with hashed password and returns tokens', async () => {
      const result = await register('svc-register@example.com', 'password123', 'Test User');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toHaveProperty('email', 'svc-register@example.com');
    });

    it('returned user object does not contain passwordHash', async () => {
      const result = await register('svc-nohash@example.com', 'password123', 'Test User');

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate email (Prisma P2002)', async () => {
      await register('svc-dup@example.com', 'password123', 'First');

      await expect(register('svc-dup@example.com', 'password123', 'Second')).rejects.toThrow();
    });

    it('access token contains userId and email', async () => {
      const result = await register('svc-token@example.com', 'password123', 'Test User');
      const decoded = jwt.verify(result.accessToken, config.jwtSecret) as { userId: number; email: string };

      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe('svc-token@example.com');
    });

    it('refresh token contains userId and type:refresh', async () => {
      const result = await register('svc-refresh@example.com', 'password123', 'Test User');
      const decoded = jwt.verify(result.refreshToken, config.jwtSecret) as { userId: number; type: string };

      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('login', () => {
    it('succeeds with correct credentials', async () => {
      await register('svc-login@example.com', 'password123', 'Login User');

      const result = await login('svc-login@example.com', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toHaveProperty('email', 'svc-login@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('fails with wrong password', async () => {
      await register('svc-wrongpw@example.com', 'correctpassword', 'User');

      await expect(login('svc-wrongpw@example.com', 'wrongpassword')).rejects.toThrow('Invalid email or password');
    });

    it('fails with unknown email', async () => {
      await expect(login('svc-unknown@example.com', 'password123')).rejects.toThrow('Invalid email or password');
    });
  });
});
