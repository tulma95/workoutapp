import { beforeAll, afterAll } from 'vitest';
import prisma from '../lib/db';

beforeAll(async () => {
  await prisma.$queryRawUnsafe(
    'TRUNCATE plan_sets, plan_day_exercises, plan_days, plan_progression_rules, user_plans, workout_plans, workout_sets, workouts, training_maxes, exercises, users CASCADE',
  );

  // Seed core exercises used across tests
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
    await prisma.exercise.create({ data: exercise });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
