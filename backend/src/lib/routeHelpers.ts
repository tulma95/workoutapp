import { Request, Response } from 'express';
import { z } from 'zod';

// Validate a request's query string against a zod schema. Returns the parsed
// (coerced) data, or sends a 400 and returns null. Express 5's req.query is
// read-only, so callers use the returned value rather than mutating req.query.
export function parseQuery<T>(schema: z.ZodType<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return null;
  }
  return result.data;
}

export function parseIntParam(res: Response, raw: string | undefined, label: string): number | null {
  const n = parseInt(raw ?? '', 10);
  if (isNaN(n)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Invalid ${label}` } });
    return null;
  }
  return n;
}

export function isPrismaError(e: unknown, code: string): boolean {
  return e instanceof Error && 'code' in e && (e as Record<string, unknown>).code === code;
}

export function isP2002UsernameViolation(err: unknown): boolean {
  if (!(err instanceof Error) || !('code' in err) || (err as Record<string, unknown>).code !== 'P2002') return false;
  const meta = (err as { meta?: Record<string, unknown> }).meta ?? {};
  // Prisma v7 adapter-style
  const adapterFields: string[] =
    (meta.driverAdapterError as { cause?: { constraint?: { fields?: string[] } } } | undefined)
      ?.cause?.constraint?.fields ?? [];
  const legacyTarget = meta.target as string[] | string | undefined;
  return (
    adapterFields.includes('username') ||
    (Array.isArray(legacyTarget) && legacyTarget.some((t) => String(t).includes('username'))) ||
    (typeof legacyTarget === 'string' && legacyTarget.includes('username'))
  );
}

export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores');
