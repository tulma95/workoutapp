import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../config', () => ({
  config: {
    nodeEnv: 'development',
    jwtSecret: 'test-secret',
    databaseUrl: 'postgresql://test',
    port: 3001,
  },
}));

import { errorHandler } from '../../middleware/errorHandler';
import { config } from '../../config';

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('errorHandler middleware', () => {
  const req = {} as Request;
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.mocked(config).nodeEnv = 'development';
  });

  it('returns 500 with error details in development mode', () => {
    const res = mockRes();
    const error = new Error('Something broke');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something broke',
        stack: expect.any(String),
      },
    });
  });

  it('returns 500 with generic message in production mode', () => {
    vi.mocked(config).nodeEnv = 'production';
    const res = mockRes();
    const error = new Error('Secret database error');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
    const jsonArg = vi.mocked(res.json).mock.calls[0][0] as { error: { stack?: string } };
    expect(jsonArg.error.stack).toBeUndefined();
  });
});
