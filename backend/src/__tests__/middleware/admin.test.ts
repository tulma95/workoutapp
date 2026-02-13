import { describe, it, expect, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { requireAdmin } from '../../middleware/admin';
import { AuthRequest } from '../../types';

function mockReqResNext(userId: number, isAdmin: boolean) {
  const req = { userId, isAdmin } as AuthRequest;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('requireAdmin middleware', () => {
  it('passes when user is admin', () => {
    const { req, res, next } = mockReqResNext(1, true);

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not admin', () => {
    const { req, res, next } = mockReqResNext(2, false);

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
  });

  it('returns 403 when isAdmin is undefined', () => {
    const req = { userId: 3 } as AuthRequest;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
  });
});
