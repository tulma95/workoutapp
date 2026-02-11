import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import prisma from '../lib/db';
import * as trainingMaxService from '../services/trainingMax.service';

const router = Router();

const VALID_EXERCISES = ['bench', 'squat', 'ohp', 'deadlift'] as const;

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const tms = await trainingMaxService.getCurrentTMs(req.userId!);
  res.json(tms);
});

const setupSchema = z.object({
  oneRepMaxes: z.object({
    bench: z.number().positive(),
    squat: z.number().positive(),
    ohp: z.number().positive(),
    deadlift: z.number().positive(),
  }),
});

router.post('/setup', validate(setupSchema), async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const tms = await trainingMaxService.setupFromOneRepMaxes(
    req.userId!,
    req.body.oneRepMaxes,
    user.unitPreference,
  );
  res.status(201).json(tms);
});

const updateSchema = z.object({
  weight: z.number().positive(),
});

router.patch('/:exercise', validate(updateSchema), async (req: AuthRequest, res: Response) => {
  const exercise = req.params.exercise as string;
  if (!VALID_EXERCISES.includes(exercise as (typeof VALID_EXERCISES)[number])) {
    res.status(400).json({
      error: { code: 'INVALID_EXERCISE', message: `Invalid exercise: ${exercise}. Must be one of: ${VALID_EXERCISES.join(', ')}` },
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const tm = await trainingMaxService.updateTM(req.userId!, exercise, req.body.weight, user.unitPreference);
  res.json(tm);
});

router.get('/:exercise/history', async (req: AuthRequest, res: Response) => {
  const exercise = req.params.exercise as string;
  if (!VALID_EXERCISES.includes(exercise as (typeof VALID_EXERCISES)[number])) {
    res.status(400).json({
      error: { code: 'INVALID_EXERCISE', message: `Invalid exercise: ${exercise}. Must be one of: ${VALID_EXERCISES.join(', ')}` },
    });
    return;
  }

  const history = await trainingMaxService.getHistory(req.userId!, exercise);
  res.json(history);
});

export default router;
