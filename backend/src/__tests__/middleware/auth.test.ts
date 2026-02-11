import { describe, it, expect, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { authenticate } from '../../middleware/auth';
import { AuthRequest } from '../../types';

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
  it('passes with valid token and sets userId', () => {
    const token = jwt.sign({ userId: 42, email: 'test@example.com' }, config.jwtSecret, { expiresIn: '1h' });
    const { req, res, next } = mockReqResNext(`Bearer ${token}`);

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe(42);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header is missing', () => {
    const { req, res, next } = mockReqResNext();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
  });

  it('returns 401 for expired token', () => {
    const token = jwt.sign({ userId: 42, email: 'test@example.com' }, config.jwtSecret, { expiresIn: '-1s' });
    const { req, res, next } = mockReqResNext(`Bearer ${token}`);

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
  });

  it('returns 401 for malformed token', () => {
    const { req, res, next } = mockReqResNext('Bearer not-a-valid-jwt');

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
  });
});
