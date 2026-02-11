import { beforeAll, afterAll } from 'vitest';
import prisma from '../lib/db';

beforeAll(async () => {
  await prisma.$queryRawUnsafe(
    'TRUNCATE workout_sets, workouts, training_maxes, users CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
