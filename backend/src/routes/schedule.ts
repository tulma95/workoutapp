import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types';
import prisma from '../lib/db';

const router = Router();

router.use(authenticate);

const ScheduleEntrySchema = z.object({
  dayNumber: z.number().int().positive(),
  weekday: z.number().int().min(0).max(6),
});

const PutScheduleBodySchema = z.object({
  schedule: z.array(ScheduleEntrySchema),
});

// GET /api/schedule — return current schedule for active plan
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);

  const userPlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: { schedule: true },
  });

  if (!userPlan) {
    res.json({ schedule: [] });
    return;
  }

  const schedule = userPlan.schedule.map(row => ({
    dayNumber: row.dayNumber,
    weekday: row.weekday,
  }));

  res.json({ schedule });
});

// PUT /api/schedule — replace all schedule rows for active plan
router.put('/', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);

  const parsed = PutScheduleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body' },
    });
    return;
  }

  const { schedule } = parsed.data;

  // Validate duplicate dayNumbers in body
  const dayNumbers = schedule.map(e => e.dayNumber);
  if (new Set(dayNumbers).size !== dayNumbers.length) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Duplicate dayNumbers in schedule' },
    });
    return;
  }

  // Find active plan
  const userPlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: { plan: true },
  });

  if (!userPlan) {
    res.status(400).json({
      error: { code: 'NO_ACTIVE_PLAN', message: 'No active plan subscription' },
    });
    return;
  }

  // Validate dayNumbers do not exceed plan's daysPerWeek
  const { daysPerWeek } = userPlan.plan;
  for (const entry of schedule) {
    if (entry.dayNumber > daysPerWeek) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `dayNumber ${entry.dayNumber} exceeds plan's daysPerWeek (${daysPerWeek})`,
        },
      });
      return;
    }
  }

  // Atomically replace all schedule rows
  await prisma.$transaction(async (tx) => {
    await tx.userPlanSchedule.deleteMany({
      where: { userPlanId: userPlan.id },
    });

    if (schedule.length > 0) {
      await tx.userPlanSchedule.createMany({
        data: schedule.map(entry => ({
          userPlanId: userPlan.id,
          dayNumber: entry.dayNumber,
          weekday: entry.weekday,
        })),
      });
    }
  });

  res.json({ schedule });
});

export default router;
