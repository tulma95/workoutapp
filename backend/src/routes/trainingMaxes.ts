import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types';
import prisma from '../lib/db';
import * as trainingMaxService from '../services/trainingMax.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const tms = await trainingMaxService.getCurrentTMs(getUserId(req));
  res.json(tms);
});

const setupSchema = z.object({
  exerciseTMs: z.array(
    z.object({
      exerciseId: z.number().int().positive(),
      oneRepMax: z.number().positive(),
    })
  ).min(1),
});

router.post('/setup', validate(setupSchema), async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const tms = await trainingMaxService.setupFromExerciseTMs(
    getUserId(req),
    req.body.exerciseTMs,
  );
  res.status(201).json(tms);
});

const updateSchema = z.object({
  weight: z.number().positive(),
});

router.patch('/:exercise', validate(updateSchema), async (req: AuthRequest, res: Response) => {
  const exercise = req.params.exercise as string;

  // Validate that the exercise exists in the database
  const exerciseRecord = await prisma.exercise.findUnique({ where: { slug: exercise } });
  if (!exerciseRecord) {
    res.status(400).json({
      error: { code: 'INVALID_EXERCISE', message: `Invalid exercise: ${exercise}` },
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const tm = await trainingMaxService.updateTM(getUserId(req), exercise, req.body.weight);
  res.json(tm);
});

router.get('/:exercise/history', async (req: AuthRequest, res: Response) => {
  const exercise = req.params.exercise as string;

  // Validate that the exercise exists in the database
  const exerciseRecord = await prisma.exercise.findUnique({ where: { slug: exercise } });
  if (!exerciseRecord) {
    res.status(400).json({
      error: { code: 'INVALID_EXERCISE', message: `Invalid exercise: ${exercise}` },
    });
    return;
  }

  const history = await trainingMaxService.getHistory(getUserId(req), exercise);
  res.json(history);
});

export default router;
