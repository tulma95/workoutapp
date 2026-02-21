import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { register, login } from '../../services/auth.service';
import { config } from '../../config';

describe('auth.service', () => {
  const uid = randomUUID().slice(0, 8);

  describe('register', () => {
    it('creates user with hashed password and returns tokens', async () => {
      const result = await register(`svc-register-${uid}@example.com`, 'password123', `svc_register_${uid}`);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toHaveProperty('email', `svc-register-${uid}@example.com`);
    });

    it('returned user object does not contain passwordHash', async () => {
      const result = await register(`svc-nohash-${uid}@example.com`, 'password123', `svc_nohash_${uid}`);

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate email (Prisma P2002)', async () => {
      await register(`svc-dup-${uid}@example.com`, 'password123', `svc_dup_${uid}`);

      await expect(register(`svc-dup-${uid}@example.com`, 'password123', `svc_dup2_${uid}`)).rejects.toThrow();
    });

    it('access token contains userId and email', async () => {
      const result = await register(`svc-token-${uid}@example.com`, 'password123', `svc_token_${uid}`);
      const decoded = jwt.verify(result.accessToken, config.jwtSecret) as { userId: number; email: string };

      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe(`svc-token-${uid}@example.com`);
    });

    it('refresh token contains userId and type:refresh', async () => {
      const result = await register(`svc-refresh-${uid}@example.com`, 'password123', `svc_refresh_${uid}`);
      const decoded = jwt.verify(result.refreshToken, config.jwtSecret) as { userId: number; type: string };

      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('login', () => {
    it('succeeds with correct credentials', async () => {
      await register(`svc-login-${uid}@example.com`, 'password123', `svc_login_${uid}`);

      const result = await login(`svc-login-${uid}@example.com`, 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toHaveProperty('email', `svc-login-${uid}@example.com`);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('fails with wrong password', async () => {
      await register(`svc-wrongpw-${uid}@example.com`, 'correctpassword', `svc_wrongpw_${uid}`);

      await expect(login(`svc-wrongpw-${uid}@example.com`, 'wrongpassword')).rejects.toThrow('Invalid email or password');
    });

    it('fails with unknown email', async () => {
      await expect(login(`svc-unknown-${uid}@example.com`, 'password123')).rejects.toThrow('Invalid email or password');
    });
  });
});
