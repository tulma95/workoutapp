import { Response } from 'express';
import { z } from 'zod';

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
  if (!err || typeof err !== 'object' || !('code' in err) || err.code !== 'P2002') return false;
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
