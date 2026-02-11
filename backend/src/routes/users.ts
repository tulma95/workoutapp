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
  displayName: z.string().min(1).optional(),
  unitPreference: z.enum(['kg', 'lb']).optional(),
});

router.patch('/me', validate(updateSchema), async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: req.body,
  });
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

export default router;
