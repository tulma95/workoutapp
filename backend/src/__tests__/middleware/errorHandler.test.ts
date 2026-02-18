import { describe, it, expect, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/errorHandler';
import { config } from '../../config';

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('errorHandler middleware', () => {
  const req = {} as Request;
  const next = vi.fn() as NextFunction;
  const originalNodeEnv = config.nodeEnv;

  afterEach(() => {
    config.nodeEnv = originalNodeEnv;
  });

  it('returns 500 with error details in development mode', () => {
    config.nodeEnv = 'development';
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

  it('returns 500 with generic message in non-development mode', () => {
    config.nodeEnv = 'test';
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
    const jsonArg = vi.mocked(res.json).mock.calls[0]![0] as { error: { stack?: string } };
    expect(jsonArg.error.stack).toBeUndefined();
  });
});
