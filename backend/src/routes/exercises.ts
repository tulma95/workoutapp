import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import prisma from '../lib/db';

const router = Router();

router.use(authenticate);

router.get('/', async (_req: AuthRequest, res: Response) => {
  const exercises = await prisma.exercise.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      muscleGroup: true,
      category: true,
      isUpperBody: true,
    },
  });
  res.json(exercises);
});

export default router;
