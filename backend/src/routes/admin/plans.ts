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

function isPrismaError(e: unknown, code: string): boolean {
  return e instanceof Error && 'code' in e && (e as Record<string, unknown>).code === code;
}

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
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
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

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Invalid plan ID' }
    });
    return;
  }

  const plan = await prisma.workoutPlan.findUnique({
    where: { id },
    include: {
      days: {
        include: {
          exercises: {
            include: {
              exercise: true,
              tmExercise: true,
              sets: {
                orderBy: { setOrder: 'asc' },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { dayNumber: 'asc' },
      },
      progressionRules: {
        include: {
          exercise: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!plan) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Plan not found' }
    });
    return;
  }

  res.json(plan);
});

const updatePlanSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  daysPerWeek: z.number().int().min(1),
  isPublic: z.boolean().optional(),
  days: z.array(planDaySchema).min(1),
});

router.put('/:id', validate(updatePlanSchema), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Invalid plan ID' }
    });
    return;
  }

  const { slug, name, description, daysPerWeek, isPublic, days } = req.body;

  // Check if plan exists
  const existingPlan = await prisma.workoutPlan.findUnique({
    where: { id },
  });

  if (!existingPlan) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Plan not found' }
    });
    return;
  }

  // Cannot change slug of system plans
  if (existingPlan.isSystem && existingPlan.slug !== slug) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Cannot change slug of system plan' }
    });
    return;
  }

  try {
    const plan = await prisma.$transaction(async (tx) => {
      // Delete old days (cascade will delete exercises and sets)
      await tx.planDay.deleteMany({
        where: { planId: id },
      });

      // Update the plan
      await tx.workoutPlan.update({
        where: { id },
        data: {
          slug,
          name,
          description,
          daysPerWeek,
          isPublic: isPublic ?? existingPlan.isPublic,
        },
      });

      // Create new days with exercises and sets
      for (const day of days) {
        const createdDay = await tx.planDay.create({
          data: {
            planId: id,
            dayNumber: day.dayNumber,
            name: day.name,
          },
        });

        for (const exercise of day.exercises) {
          const createdExercise = await tx.planDayExercise.create({
            data: {
              planDayId: createdDay.id,
              exerciseId: exercise.exerciseId,
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
        where: { id },
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

    res.json(plan);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Plan with this slug already exists' }
      });
      return;
    }
    throw error;
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Invalid plan ID' }
    });
    return;
  }

  const plan = await prisma.workoutPlan.findUnique({
    where: { id },
  });

  if (!plan) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Plan not found' }
    });
    return;
  }

  // Cannot archive system plans
  if (plan.isSystem) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Cannot archive system plan' }
    });
    return;
  }

  const archivedPlan = await prisma.workoutPlan.update({
    where: { id },
    data: {
      archivedAt: new Date(),
    },
  });

  res.json(archivedPlan);
});

const progressionRuleSchema = z.object({
  exerciseId: z.number().int().nullable().optional(),
  category: z.string().nullable().optional(),
  minReps: z.number().int().min(0),
  maxReps: z.number().int().min(0),
  increase: z.number().min(0),
});

const setProgressionRulesSchema = z.object({
  rules: z.array(progressionRuleSchema).min(1),
});

router.post('/:id/progression-rules', validate(setProgressionRulesSchema), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Invalid plan ID' }
    });
    return;
  }

  const { rules } = req.body;

  // Validate that minReps <= maxReps for every rule
  for (const rule of rules) {
    if (rule.minReps > rule.maxReps) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'minReps must be less than or equal to maxReps' }
      });
      return;
    }
  }

  // Check if plan exists
  const plan = await prisma.workoutPlan.findUnique({
    where: { id },
  });

  if (!plan) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Plan not found' }
    });
    return;
  }

  // Validate exerciseId references if provided
  const exerciseIds = rules
    .map((rule: any) => rule.exerciseId)
    .filter((id: number | undefined | null): id is number => typeof id === 'number');

  if (exerciseIds.length > 0) {
    const uniqueExerciseIds: number[] = Array.from(new Set(exerciseIds));
    const exercises = await prisma.exercise.findMany({
      where: { id: { in: uniqueExerciseIds } },
    });

    if (exercises.length !== uniqueExerciseIds.length) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'One or more exerciseId references do not exist' }
      });
      return;
    }
  }

  // Replace rules in a transaction
  const updatedRules = await prisma.$transaction(async (tx) => {
    // Delete existing rules
    await tx.planProgressionRule.deleteMany({
      where: { planId: id },
    });

    // Create new rules
    const createdRules = [];
    for (const rule of rules) {
      const createdRule = await tx.planProgressionRule.create({
        data: {
          planId: id,
          exerciseId: rule.exerciseId,
          category: rule.category,
          minReps: rule.minReps,
          maxReps: rule.maxReps,
          increase: rule.increase,
        },
        include: {
          exercise: true,
        },
      });
      createdRules.push(createdRule);
    }

    return createdRules;
  });

  res.json(updatedRules);
});

export default router;
