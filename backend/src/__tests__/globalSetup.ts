import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export async function setup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Run tests via ./run_test.sh to set up the test database.',
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('Database connectivity verified.');

    // Seed core exercises (idempotent upserts) - shared read-only data for all tests
    const coreExercises = [
      { slug: 'bench-press', name: 'Bench Press', muscleGroup: 'chest', category: 'compound', isUpperBody: true },
      { slug: 'squat', name: 'Squat', muscleGroup: 'legs', category: 'compound', isUpperBody: false },
      { slug: 'deadlift', name: 'Deadlift', muscleGroup: 'back', category: 'compound', isUpperBody: false },
      { slug: 'ohp', name: 'Overhead Press', muscleGroup: 'shoulders', category: 'compound', isUpperBody: true },
      { slug: 'close-grip-bench', name: 'Close Grip Bench Press', muscleGroup: 'chest', category: 'compound', isUpperBody: true },
      { slug: 'sumo-deadlift', name: 'Sumo Deadlift', muscleGroup: 'back', category: 'compound', isUpperBody: false },
      { slug: 'front-squat', name: 'Front Squat', muscleGroup: 'legs', category: 'compound', isUpperBody: false },
    ];

    for (const exercise of coreExercises) {
      await prisma.exercise.upsert({
        where: { slug: exercise.slug },
        update: {},
        create: exercise,
      });
    }
    console.log('Core exercises seeded.');
  } catch (error) {
    throw new Error(
      `Cannot connect to test database at ${connectionString}. Is the test container running?\n${error}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
