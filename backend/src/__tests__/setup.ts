import { afterAll } from 'vitest';
import prisma from '../lib/db';

afterAll(async () => {
  await prisma.$queryRawUnsafe(
    'TRUNCATE workout_sets, workouts, training_maxes, users CASCADE',
  );
  await prisma.$disconnect();
});
