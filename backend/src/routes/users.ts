import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import prisma from '../lib/db';
import { usernameSchema, isP2002UsernameViolation } from '../lib/routeHelpers';

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
  username: usernameSchema.optional(),
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
    if (isP2002UsernameViolation(err)) {
      res.status(409).json({
        error: { code: 'USERNAME_EXISTS', message: 'This username is already taken' },
      });
      return;
    }
    throw err;
  }
});

export default router;
