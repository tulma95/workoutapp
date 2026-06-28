import { describe, it, expect, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../../config';
import { authenticate } from '../../middleware/auth';
import { AuthRequest } from '../../types';
import prisma from '../../lib/db';

function mockReqResNext(authHeader?: string) {
  const req = { headers: {} } as AuthRequest;
  if (authHeader !== undefined) {
    req.headers.authorization = authHeader;
  }
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('authenticate middleware', () => {
  it('passes with valid token and sets userId and isAdmin', async () => {
    const uid = randomUUID().slice(0, 8);
    const user = await prisma.user.create({
      data: {
        email: `auth-mw-${uid}@example.com`,
        passwordHash: 'placeholder',
        username: `auth_mw_${uid}`,
        isAdmin: true,
      },
    });
    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: true, tokenVersion: user.tokenVersion },
      config.jwtSecret,
      { expiresIn: '1h' },
    );
    const { req, res, next } = mockReqResNext(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe(user.id);
    expect(req.isAdmin).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header is missing', async () => {
    const { req, res, next } = mockReqResNext();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
  });

  it('returns 401 for expired token', async () => {
    const token = jwt.sign(
      { userId: 42, email: 'test@example.com', tokenVersion: 0 },
      config.jwtSecret,
      { expiresIn: '-1s' },
    );
    const { req, res, next } = mockReqResNext(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
  });

  it('returns 401 for malformed token', async () => {
    const { req, res, next } = mockReqResNext('Bearer not-a-valid-jwt');

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
  });

  it('returns 401 when token version does not match DB', async () => {
    const uid = randomUUID().slice(0, 8);
    const user = await prisma.user.create({
      data: {
        email: `auth-mw-old-${uid}@example.com`,
        passwordHash: 'placeholder',
        username: `auth_mw_old_${uid}`,
        tokenVersion: 1,
      },
    });
    // Token signed with stale tokenVersion 0 (e.g. issued before a password change)
    const staleToken = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: false, tokenVersion: 0 },
      config.jwtSecret,
      { expiresIn: '1h' },
    );
    const { req, res, next } = mockReqResNext(`Bearer ${staleToken}`);

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
  });
});
