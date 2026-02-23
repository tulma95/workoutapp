import { describe, it, expect, vi } from 'vitest';
import { parseIntParam, isPrismaError, isP2002UsernameViolation, usernameSchema } from '../../lib/routeHelpers';
import type { Response } from 'express';

function makeMockRes(): Response {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status } as unknown as Response;
}

describe('parseIntParam', () => {
  it('returns a number when raw is a valid integer string', () => {
    const res = makeMockRes();
    const result = parseIntParam(res, '42', 'dayNumber');
    expect(result).toBe(42);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sends 400 and returns null when raw is NaN', () => {
    const res = makeMockRes();
    const result = parseIntParam(res, 'abc', 'dayNumber');
    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('sends 400 and returns null when raw is undefined', () => {
    const res = makeMockRes();
    const result = parseIntParam(res, undefined, 'dayNumber');
    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('includes the label in the error message', () => {
    const res = makeMockRes();
    const jsonMock = vi.fn();
    (res.status as ReturnType<typeof vi.fn>).mockReturnValue({ json: jsonMock });
    parseIntParam(res, 'bad', 'workoutId');
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Invalid workoutId' }),
      }),
    );
  });
});

describe('isPrismaError', () => {
  it('returns true when the error is an Error with a matching code', () => {
    const err = Object.assign(new Error('prisma'), { code: 'P2002' });
    expect(isPrismaError(err, 'P2002')).toBe(true);
  });

  it('returns false when the error code does not match', () => {
    const err = Object.assign(new Error('prisma'), { code: 'P2025' });
    expect(isPrismaError(err, 'P2002')).toBe(false);
  });

  it('returns false for a plain object (not an Error instance)', () => {
    const err = { code: 'P2002' };
    expect(isPrismaError(err, 'P2002')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPrismaError(null, 'P2002')).toBe(false);
  });
});

describe('isP2002UsernameViolation', () => {
  it('returns true with Prisma v7 adapter-style driverAdapterError containing username field', () => {
    const err = {
      code: 'P2002',
      meta: {
        driverAdapterError: {
          cause: {
            constraint: {
              fields: ['username'],
            },
          },
        },
      },
    };
    expect(isP2002UsernameViolation(err)).toBe(true);
  });

  it('returns true with legacy array target containing username', () => {
    const err = {
      code: 'P2002',
      meta: { target: ['username'] },
    };
    expect(isP2002UsernameViolation(err)).toBe(true);
  });

  it('returns true with legacy string target containing username', () => {
    const err = {
      code: 'P2002',
      meta: { target: 'users_username_key' },
    };
    expect(isP2002UsernameViolation(err)).toBe(true);
  });

  it('returns false when the constrained field is email, not username', () => {
    const err = {
      code: 'P2002',
      meta: { target: ['email'] },
    };
    expect(isP2002UsernameViolation(err)).toBe(false);
  });

  it('returns false when error code is not P2002', () => {
    const err = {
      code: 'P2025',
      meta: { target: ['username'] },
    };
    expect(isP2002UsernameViolation(err)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isP2002UsernameViolation(null)).toBe(false);
  });

  it('returns false for a non-object primitive', () => {
    expect(isP2002UsernameViolation('P2002')).toBe(false);
  });
});

describe('usernameSchema', () => {
  it('accepts a valid username', () => {
    expect(usernameSchema.safeParse('valid_User1').success).toBe(true);
  });

  it('rejects a username shorter than 3 characters', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });

  it('rejects a username longer than 30 characters', () => {
    const long = 'a'.repeat(31);
    expect(usernameSchema.safeParse(long).success).toBe(false);
  });

  it('rejects a username containing special characters like @', () => {
    expect(usernameSchema.safeParse('user@name').success).toBe(false);
  });

  it('accepts a username of exactly 3 characters', () => {
    expect(usernameSchema.safeParse('abc').success).toBe(true);
  });

  it('accepts a username of exactly 30 characters', () => {
    const boundary = 'a'.repeat(30);
    expect(usernameSchema.safeParse(boundary).success).toBe(true);
  });
});
