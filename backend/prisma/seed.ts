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

  console.log('Seeding nSuns 4-Day LP plan...');

  // Get exercise IDs
  const exerciseMap = new Map<string, number>();
  const allExercises = await prisma.exercise.findMany();
  for (const ex of allExercises) {
    exerciseMap.set(ex.slug, ex.id);
  }

  // Upsert the plan
  const plan = await prisma.workoutPlan.upsert({
    where: { slug: 'nsuns-4day-lp' },
    update: {
      name: 'nSuns 4-Day LP',
      daysPerWeek: 4,
      isPublic: true,
      isSystem: true,
    },
    create: {
      slug: 'nsuns-4day-lp',
      name: 'nSuns 4-Day LP',
      daysPerWeek: 4,
      isPublic: true,
      isSystem: true,
    },
  });

  // Delete existing plan structure (cascade will handle days, exercises, sets)
  await prisma.planDay.deleteMany({
    where: { planId: plan.id },
  });

  // Day 1: Bench Volume & OHP
  const day1 = await prisma.planDay.create({
    data: {
      planId: plan.id,
      dayNumber: 1,
      name: 'Bench Volume & OHP',
    },
  });

  const day1BenchT1 = await prisma.planDayExercise.create({
    data: {
      planDayId: day1.id,
      exerciseId: exerciseMap.get('bench-press')!,
      tier: 'T1',
      sortOrder: 1,
      tmExerciseId: exerciseMap.get('bench-press')!,
      displayName: 'Bench Volume',
    },
  });

  // Day 1 T1 sets: 65%x8, 75%x6, 85%x4, 85%x4, 85%x4, 80%x5, 75%x6, 70%x7, 65%x8+ (amrap+progression)
  const day1T1Sets = [
    { percentage: 0.65, reps: 8, isAmrap: false, isProgression: false },
    { percentage: 0.75, reps: 6, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
    { percentage: 0.8, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.75, reps: 6, isAmrap: false, isProgression: false },
    { percentage: 0.7, reps: 7, isAmrap: false, isProgression: false },
    { percentage: 0.65, reps: 8, isAmrap: true, isProgression: true },
  ];

  for (let i = 0; i < day1T1Sets.length; i++) {
    await prisma.planSet.create({
      data: {
        planDayExerciseId: day1BenchT1.id,
        setOrder: i + 1,
        ...day1T1Sets[i],
      },
    });
  }

  const day1OHPT2 = await prisma.planDayExercise.create({
    data: {
      planDayId: day1.id,
      exerciseId: exerciseMap.get('ohp')!,
      tier: 'T2',
      sortOrder: 2,
      tmExerciseId: exerciseMap.get('ohp')!,
    },
  });

  // Day 1 T2 OHP sets: 50%x6, 60%x5, 70%x3, 70%x5, 70%x7, 70%x4, 70%x6, 70%x8
  const day1T2Sets = [
    { percentage: 0.5, reps: 6 },
    { percentage: 0.6, reps: 5 },
    { percentage: 0.7, reps: 3 },
    { percentage: 0.7, reps: 5 },
    { percentage: 0.7, reps: 7 },
    { percentage: 0.7, reps: 4 },
    { percentage: 0.7, reps: 6 },
    { percentage: 0.7, reps: 8 },
  ];

  for (let i = 0; i < day1T2Sets.length; i++) {
    await prisma.planSet.create({
      data: {
        planDayExerciseId: day1OHPT2.id,
        setOrder: i + 1,
        ...day1T2Sets[i],
        isAmrap: false,
        isProgression: false,
      },
    });
  }

  // Day 2: Squat & Sumo Deadlift
  const day2 = await prisma.planDay.create({
    data: {
      planId: plan.id,
      dayNumber: 2,
      name: 'Squat & Sumo Deadlift',
    },
  });

  const day2SquatT1 = await prisma.planDayExercise.create({
    data: {
      planDayId: day2.id,
      exerciseId: exerciseMap.get('squat')!,
      tier: 'T1',
      sortOrder: 1,
      tmExerciseId: exerciseMap.get('squat')!,
    },
  });

  // Day 2 T1 sets: 75%x5, 85%x3, 95%x1+ (amrap+progression), 90%x3, 85%x3, 80%x3, 75%x5, 70%x5, 65%x5+ (amrap)
  const day2T1Sets = [
    { percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.95, reps: 1, isAmrap: true, isProgression: true },
    { percentage: 0.9, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.8, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.7, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.65, reps: 5, isAmrap: true, isProgression: false },
  ];

  for (let i = 0; i < day2T1Sets.length; i++) {
    await prisma.planSet.create({
      data: {
        planDayExerciseId: day2SquatT1.id,
        setOrder: i + 1,
        ...day2T1Sets[i],
      },
    });
  }

  const day2SumoT2 = await prisma.planDayExercise.create({
    data: {
      planDayId: day2.id,
      exerciseId: exerciseMap.get('sumo-deadlift')!,
      tier: 'T2',
      sortOrder: 2,
      tmExerciseId: exerciseMap.get('deadlift')!,
    },
  });

  // Day 2 T2 Sumo DL sets: 50%x5, 60%x5, 70%x3, 70%x5, 70%x7, 70%x4, 70%x6, 70%x8
  const day2T2Sets = [
    { percentage: 0.5, reps: 5 },
    { percentage: 0.6, reps: 5 },
    { percentage: 0.7, reps: 3 },
    { percentage: 0.7, reps: 5 },
    { percentage: 0.7, reps: 7 },
    { percentage: 0.7, reps: 4 },
    { percentage: 0.7, reps: 6 },
    { percentage: 0.7, reps: 8 },
  ];

  for (let i = 0; i < day2T2Sets.length; i++) {
    await prisma.planSet.create({
      data: {
        planDayExerciseId: day2SumoT2.id,
        setOrder: i + 1,
        ...day2T2Sets[i],
        isAmrap: false,
        isProgression: false,
      },
    });
  }

  // Day 3: Bench Heavy & Close Grip Bench
  const day3 = await prisma.planDay.create({
    data: {
      planId: plan.id,
      dayNumber: 3,
      name: 'Bench Heavy & Close Grip Bench',
    },
  });

  const day3BenchT1 = await prisma.planDayExercise.create({
    data: {
      planDayId: day3.id,
      exerciseId: exerciseMap.get('bench-press')!,
      tier: 'T1',
      sortOrder: 1,
      tmExerciseId: exerciseMap.get('bench-press')!,
      displayName: 'Bench Heavy',
    },
  });

  // Day 3 T1 sets: 75%x5, 85%x3, 95%x1+ (amrap+progression), 90%x3, 85%x5, 80%x3, 75%x5, 70%x3, 65%x5+ (amrap)
  const day3T1Sets = [
    { percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.95, reps: 1, isAmrap: true, isProgression: true },
    { percentage: 0.9, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.8, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.7, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.65, reps: 5, isAmrap: true, isProgression: false },
  ];

  for (let i = 0; i < day3T1Sets.length; i++) {
    await prisma.planSet.create({
      data: {
        planDayExerciseId: day3BenchT1.id,
        setOrder: i + 1,
        ...day3T1Sets[i],
      },
    });
  }

  const day3CGBenchT2 = await prisma.planDayExercise.create({
    data: {
      planDayId: day3.id,
      exerciseId: exerciseMap.get('close-grip-bench')!,
      tier: 'T2',
      sortOrder: 2,
      tmExerciseId: exerciseMap.get('bench-press')!,
    },
  });

  // Day 3 T2 CG Bench sets: 40%x6, 50%x5, 60%x3, 60%x5, 60%x7, 60%x4, 60%x6, 60%x8
  const day3T2Sets = [
    { percentage: 0.4, reps: 6 },
    { percentage: 0.5, reps: 5 },
    { percentage: 0.6, reps: 3 },
    { percentage: 0.6, reps: 5 },
    { percentage: 0.6, reps: 7 },
    { percentage: 0.6, reps: 4 },
    { percentage: 0.6, reps: 6 },
    { percentage: 0.6, reps: 8 },
  ];

  for (let i = 0; i < day3T2Sets.length; i++) {
    await prisma.planSet.create({
      data: {
        planDayExerciseId: day3CGBenchT2.id,
        setOrder: i + 1,
        ...day3T2Sets[i],
        isAmrap: false,
        isProgression: false,
      },
    });
  }

  // Day 4: Deadlift & Front Squat
  const day4 = await prisma.planDay.create({
    data: {
      planId: plan.id,
      dayNumber: 4,
      name: 'Deadlift & Front Squat',
    },
  });

  const day4DeadliftT1 = await prisma.planDayExercise.create({
    data: {
      planDayId: day4.id,
      exerciseId: exerciseMap.get('deadlift')!,
      tier: 'T1',
      sortOrder: 1,
      tmExerciseId: exerciseMap.get('deadlift')!,
    },
  });

  // Day 4 T1 sets: 75%x5, 85%x3, 95%x1+ (amrap+progression), 90%x3, 85%x3, 80%x3, 75%x3, 70%x3, 65%x3+ (amrap)
  const day4T1Sets = [
    { percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.95, reps: 1, isAmrap: true, isProgression: true },
    { percentage: 0.9, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.8, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.75, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.7, reps: 3, isAmrap: false, isProgression: false },
    { percentage: 0.65, reps: 3, isAmrap: true, isProgression: false },
  ];

  for (let i = 0; i < day4T1Sets.length; i++) {
    await prisma.planSet.create({
      data: {
        planDayExerciseId: day4DeadliftT1.id,
        setOrder: i + 1,
        ...day4T1Sets[i],
      },
    });
  }

  const day4FrontSquatT2 = await prisma.planDayExercise.create({
    data: {
      planDayId: day4.id,
      exerciseId: exerciseMap.get('front-squat')!,
      tier: 'T2',
      sortOrder: 2,
      tmExerciseId: exerciseMap.get('squat')!,
    },
  });

  // Day 4 T2 Front Squat sets: 35%x5, 45%x5, 55%x3, 55%x5, 55%x7, 55%x4, 55%x6, 55%x8
  const day4T2Sets = [
    { percentage: 0.35, reps: 5 },
    { percentage: 0.45, reps: 5 },
    { percentage: 0.55, reps: 3 },
    { percentage: 0.55, reps: 5 },
    { percentage: 0.55, reps: 7 },
    { percentage: 0.55, reps: 4 },
    { percentage: 0.55, reps: 6 },
    { percentage: 0.55, reps: 8 },
  ];

  for (let i = 0; i < day4T2Sets.length; i++) {
    await prisma.planSet.create({
      data: {
        planDayExerciseId: day4FrontSquatT2.id,
        setOrder: i + 1,
        ...day4T2Sets[i],
        isAmrap: false,
        isProgression: false,
      },
    });
  }

  console.log(`✓ Seeded nSuns 4-Day LP plan with 4 days, 8 exercises, and all sets`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
