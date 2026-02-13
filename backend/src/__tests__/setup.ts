import { beforeAll, afterAll } from 'vitest';
import prisma from '../lib/db';

beforeAll(async () => {
  await prisma.$queryRawUnsafe(
    'TRUNCATE plan_sets, plan_day_exercises, plan_days, plan_progression_rules, user_plans, workout_plans, workout_sets, workouts, training_maxes, exercises, users CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
