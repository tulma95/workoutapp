import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import prisma from '../lib/db';

const router = Router();

router.use(authenticate);

router.get('/me', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

const updateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores')
    .optional(),
});

router.patch('/me', validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: req.body,
    });
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      const meta = (err as { meta?: Record<string, unknown> }).meta ?? {};
      const adapterFields: string[] =
        (meta.driverAdapterError as { cause?: { constraint?: { fields?: string[] } } } | undefined)
          ?.cause?.constraint?.fields ?? [];
      const legacyTarget = meta.target as string[] | string | undefined;
      const isUsernameDuplicate =
        adapterFields.includes('username') ||
        (Array.isArray(legacyTarget) && legacyTarget.some((t) => String(t).includes('username'))) ||
        (typeof legacyTarget === 'string' && legacyTarget.includes('username'));
      if (isUsernameDuplicate) {
        res.status(409).json({
          error: { code: 'USERNAME_EXISTS', message: 'This username is already taken' },
        });
        return;
      }
    }
    throw err;
  }
});

export default router;
