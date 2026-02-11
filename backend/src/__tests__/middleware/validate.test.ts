import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

function mockReqResNext(body: unknown) {
  const req = { body } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('validate middleware', () => {
  it('calls next() and sets parsed body on valid input', () => {
    const { req, res, next } = mockReqResNext({ email: 'test@example.com', name: 'John' });

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ email: 'test@example.com', name: 'John' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with structured error on invalid input', () => {
    const { req, res, next } = mockReqResNext({ email: 'not-an-email', name: '' });

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: expect.arrayContaining([
          expect.objectContaining({ path: 'email', message: expect.any(String) }),
          expect.objectContaining({ path: 'name', message: expect.any(String) }),
        ]),
      },
    });
  });

  it('strips unknown fields from valid input', () => {
    const { req, res, next } = mockReqResNext({ email: 'test@example.com', name: 'John', extra: 'field' });

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ email: 'test@example.com', name: 'John' });
    expect(req.body).not.toHaveProperty('extra');
  });
});
