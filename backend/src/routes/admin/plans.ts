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

const planSetSchema = z.object({
  setOrder: z.number().int().min(1),
  percentage: z.number().min(0).max(1),
  reps: z.number().int().min(1),
  isAmrap: z.boolean().optional(),
  isProgression: z.boolean().optional(),
});

const planDayExerciseSchema = z.object({
  exerciseId: z.number().int(),
  tier: z.string().min(1),
  sortOrder: z.number().int().min(1),
  tmExerciseId: z.number().int(),
  displayName: z.string().optional(),
  sets: z.array(planSetSchema).min(1),
});

const planDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  name: z.string().optional(),
  exercises: z.array(planDayExerciseSchema).min(1),
});

const createPlanSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  daysPerWeek: z.number().int().min(1),
  isPublic: z.boolean().optional(),
  days: z.array(planDaySchema).min(1),
});

router.post('/', validate(createPlanSchema), async (req: AuthRequest, res: Response) => {
  const { slug, name, description, daysPerWeek, isPublic, days } = req.body;

  try {
    const plan = await prisma.$transaction(async (tx) => {
      // Create the plan
      const createdPlan = await tx.workoutPlan.create({
        data: {
          slug,
          name,
          description,
          daysPerWeek,
          isPublic: isPublic ?? true,
        },
      });

      // Create days with exercises and sets
      for (const day of days) {
        const createdDay = await tx.planDay.create({
          data: {
            planId: createdPlan.id,
            dayNumber: day.dayNumber,
            name: day.name,
          },
        });

        for (const exercise of day.exercises) {
          const createdExercise = await tx.planDayExercise.create({
            data: {
              planDayId: createdDay.id,
              exerciseId: exercise.exerciseId,
              tier: exercise.tier,
              sortOrder: exercise.sortOrder,
              tmExerciseId: exercise.tmExerciseId,
              displayName: exercise.displayName,
            },
          });

          for (const set of exercise.sets) {
            await tx.planSet.create({
              data: {
                planDayExerciseId: createdExercise.id,
                setOrder: set.setOrder,
                percentage: set.percentage,
                reps: set.reps,
                isAmrap: set.isAmrap ?? false,
                isProgression: set.isProgression ?? false,
              },
            });
          }
        }
      }

      // Return the full plan structure
      return await tx.workoutPlan.findUnique({
        where: { id: createdPlan.id },
        include: {
          days: {
            include: {
              exercises: {
                include: {
                  sets: {
                    orderBy: { setOrder: 'asc' },
                  },
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { dayNumber: 'asc' },
          },
        },
      });
    });

    res.status(201).json(plan);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Plan with this slug already exists' }
      });
      return;
    }
    throw error;
  }
});

router.get('/', async (_req: AuthRequest, res: Response) => {
  const plans = await prisma.workoutPlan.findMany({
    include: {
      subscriptions: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const plansWithCount = plans.map(plan => ({
    ...plan,
    subscriberCount: plan.subscriptions.length,
    subscriptions: undefined,
  }));

  res.json(plansWithCount);
});

export default router;
