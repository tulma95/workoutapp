import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import prisma from '../lib/db';
import { changePassword, deleteAccount } from '../services/auth.service';
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.patch(
  '/me/password',
  validate(changePasswordSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      await changePassword(req.userId!, req.body.currentPassword, req.body.newPassword);
      res.status(204).end();
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Current password is incorrect') {
        res.status(400).json({
          error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
        });
        return;
      }
      throw err;
    }
  },
);

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

router.delete(
  '/me',
  validate(deleteAccountSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      await deleteAccount(req.userId!, req.body.password);
      res.status(204).end();
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Incorrect password') {
        res.status(400).json({
          error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' },
        });
        return;
      }
      throw err;
    }
  },
);

export default router;
