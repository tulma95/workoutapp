import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import { AuthRequest } from '../../types';
import prisma from '../../lib/db';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

const createExerciseSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  muscleGroup: z.string().optional(),
  category: z.string().optional(),
  isUpperBody: z.boolean().optional(),
});

const updateExerciseSchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  muscleGroup: z.string().optional(),
  category: z.string().optional(),
  isUpperBody: z.boolean().optional(),
});

function isPrismaError(e: unknown, code: string): boolean {
  return e instanceof Error && 'code' in e && (e as Record<string, unknown>).code === code;
}

router.post('/', validate(createExerciseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const exercise = await prisma.exercise.create({
      data: req.body,
    });
    res.status(201).json(exercise);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Exercise with this slug already exists' }
      });
      return;
    }
    throw error;
  }
});

router.get('/', async (_req: AuthRequest, res: Response) => {
  const exercises = await prisma.exercise.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(exercises);
});

router.patch('/:id', validate(updateExerciseSchema), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string);

  try {
    const exercise = await prisma.exercise.update({
      where: { id },
      data: req.body,
    });
    res.json(exercise);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2025')) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Exercise not found' }
      });
      return;
    }
    throw error;
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string);

  // Check if exercise is referenced by any PlanDayExercise
  const referencedBy = await prisma.planDayExercise.findFirst({
    where: {
      OR: [
        { exerciseId: id },
        { tmExerciseId: id },
      ],
    },
  });

  if (referencedBy) {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'Exercise is referenced by a plan and cannot be deleted' },
    });
    return;
  }

  try {
    await prisma.exercise.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2025')) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Exercise not found' }
      });
      return;
    }
    throw error;
  }
});

export default router;
