import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const exercises = [
  // Main compound lifts
  {
    slug: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'chest',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'squat',
    name: 'Squat',
    muscleGroup: 'legs',
    category: 'compound',
    isUpperBody: false,
  },
  {
    slug: 'deadlift',
    name: 'Deadlift',
    muscleGroup: 'back',
    category: 'compound',
    isUpperBody: false,
  },
  {
    slug: 'ohp',
    name: 'Overhead Press',
    muscleGroup: 'shoulders',
    category: 'compound',
    isUpperBody: true,
  },
  // T2 variations
  {
    slug: 'close-grip-bench',
    name: 'Close Grip Bench Press',
    muscleGroup: 'chest',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'sumo-deadlift',
    name: 'Sumo Deadlift',
    muscleGroup: 'back',
    category: 'compound',
    isUpperBody: false,
  },
  {
    slug: 'front-squat',
    name: 'Front Squat',
    muscleGroup: 'legs',
    category: 'compound',
    isUpperBody: false,
  },
  // Additional compound exercises
  {
    slug: 'barbell-row',
    name: 'Barbell Row',
    muscleGroup: 'back',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'pull-up',
    name: 'Pull Up',
    muscleGroup: 'back',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'incline-bench',
    name: 'Incline Bench Press',
    muscleGroup: 'chest',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    muscleGroup: 'back',
    category: 'compound',
    isUpperBody: false,
  },
  {
    slug: 'dumbbell-ohp',
    name: 'Dumbbell Overhead Press',
    muscleGroup: 'shoulders',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'leg-press',
    name: 'Leg Press',
    muscleGroup: 'legs',
    category: 'compound',
    isUpperBody: false,
  },
  {
    slug: 'chin-up',
    name: 'Chin Up',
    muscleGroup: 'back',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'dip',
    name: 'Dip',
    muscleGroup: 'chest',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'pendlay-row',
    name: 'Pendlay Row',
    muscleGroup: 'back',
    category: 'compound',
    isUpperBody: true,
  },
  {
    slug: 'hip-thrust',
    name: 'Hip Thrust',
    muscleGroup: 'glutes',
    category: 'compound',
    isUpperBody: false,
  },
  // Isolation exercises
  {
    slug: 'lateral-raise',
    name: 'Lateral Raise',
    muscleGroup: 'shoulders',
    category: 'isolation',
    isUpperBody: true,
  },
  {
    slug: 'bicep-curl',
    name: 'Bicep Curl',
    muscleGroup: 'biceps',
    category: 'isolation',
    isUpperBody: true,
  },
  {
    slug: 'tricep-pushdown',
    name: 'Tricep Pushdown',
    muscleGroup: 'triceps',
    category: 'isolation',
    isUpperBody: true,
  },
  {
    slug: 'face-pull',
    name: 'Face Pull',
    muscleGroup: 'shoulders',
    category: 'isolation',
    isUpperBody: true,
  },
  {
    slug: 'leg-curl',
    name: 'Leg Curl',
    muscleGroup: 'hamstrings',
    category: 'isolation',
    isUpperBody: false,
  },
  {
    slug: 'leg-extension',
    name: 'Leg Extension',
    muscleGroup: 'quadriceps',
    category: 'isolation',
    isUpperBody: false,
  },
  {
    slug: 'calf-raise',
    name: 'Calf Raise',
    muscleGroup: 'calves',
    category: 'isolation',
    isUpperBody: false,
  },
];

async function main() {
  console.log('Seeding exercises...');

  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { slug: exercise.slug },
      update: {
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        category: exercise.category,
        isUpperBody: exercise.isUpperBody,
      },
      create: exercise,
    });
  }

  console.log(`✓ Seeded ${exercises.length} exercises`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
