import { roundWeight } from './weightRounding';

export interface SetScheme {
  percentage: number;
  reps: number;
  isAmrap: boolean;
}

export interface ExerciseSlot {
  exerciseName: string;
  exerciseKey: string;
  tmExercise: string;
  sets: SetScheme[];
}

export interface ProgramDay {
  t1: ExerciseSlot;
  t2: ExerciseSlot;
}

export const NSUNS_4DAY: ProgramDay[] = [
  // Day 1
  {
    t1: {
      exerciseName: 'Bench Volume',
      exerciseKey: 'bench',
      tmExercise: 'bench',
      sets: [
        { percentage: 0.65, reps: 8, isAmrap: false },
        { percentage: 0.75, reps: 6, isAmrap: false },
        { percentage: 0.85, reps: 4, isAmrap: false },
        { percentage: 0.85, reps: 4, isAmrap: false },
        { percentage: 0.85, reps: 4, isAmrap: false },
        { percentage: 0.80, reps: 5, isAmrap: false },
        { percentage: 0.75, reps: 6, isAmrap: false },
        { percentage: 0.70, reps: 7, isAmrap: false },
        { percentage: 0.65, reps: 8, isAmrap: true },
      ],
    },
    t2: {
      exerciseName: 'OHP',
      exerciseKey: 'ohp',
      tmExercise: 'ohp',
      sets: [
        { percentage: 0.50, reps: 6, isAmrap: false },
        { percentage: 0.60, reps: 5, isAmrap: false },
        { percentage: 0.70, reps: 3, isAmrap: false },
        { percentage: 0.70, reps: 5, isAmrap: false },
        { percentage: 0.70, reps: 7, isAmrap: false },
        { percentage: 0.70, reps: 4, isAmrap: false },
        { percentage: 0.70, reps: 6, isAmrap: false },
        { percentage: 0.70, reps: 8, isAmrap: false },
      ],
    },
  },
  // Day 2
  {
    t1: {
      exerciseName: 'Squat',
      exerciseKey: 'squat',
      tmExercise: 'squat',
      sets: [
        { percentage: 0.75, reps: 5, isAmrap: false },
        { percentage: 0.85, reps: 3, isAmrap: false },
        { percentage: 0.95, reps: 1, isAmrap: true },
        { percentage: 0.90, reps: 3, isAmrap: false },
        { percentage: 0.85, reps: 3, isAmrap: false },
        { percentage: 0.80, reps: 3, isAmrap: false },
        { percentage: 0.75, reps: 5, isAmrap: false },
        { percentage: 0.70, reps: 5, isAmrap: false },
        { percentage: 0.65, reps: 5, isAmrap: true },
      ],
    },
    t2: {
      exerciseName: 'Sumo Deadlift',
      exerciseKey: 'deadlift',
      tmExercise: 'deadlift',
      sets: [
        { percentage: 0.50, reps: 5, isAmrap: false },
        { percentage: 0.60, reps: 5, isAmrap: false },
        { percentage: 0.70, reps: 3, isAmrap: false },
        { percentage: 0.70, reps: 5, isAmrap: false },
        { percentage: 0.70, reps: 7, isAmrap: false },
        { percentage: 0.70, reps: 4, isAmrap: false },
        { percentage: 0.70, reps: 6, isAmrap: false },
        { percentage: 0.70, reps: 8, isAmrap: false },
      ],
    },
  },
  // Day 3
  {
    t1: {
      exerciseName: 'Bench Heavy',
      exerciseKey: 'bench',
      tmExercise: 'bench',
      sets: [
        { percentage: 0.75, reps: 5, isAmrap: false },
        { percentage: 0.85, reps: 3, isAmrap: false },
        { percentage: 0.95, reps: 1, isAmrap: true },
        { percentage: 0.90, reps: 3, isAmrap: false },
        { percentage: 0.85, reps: 5, isAmrap: false },
        { percentage: 0.80, reps: 3, isAmrap: false },
        { percentage: 0.75, reps: 5, isAmrap: false },
        { percentage: 0.70, reps: 3, isAmrap: false },
        { percentage: 0.65, reps: 5, isAmrap: true },
      ],
    },
    t2: {
      exerciseName: 'Close Grip Bench',
      exerciseKey: 'bench',
      tmExercise: 'bench',
      sets: [
        { percentage: 0.40, reps: 6, isAmrap: false },
        { percentage: 0.50, reps: 5, isAmrap: false },
        { percentage: 0.60, reps: 3, isAmrap: false },
        { percentage: 0.60, reps: 5, isAmrap: false },
        { percentage: 0.60, reps: 7, isAmrap: false },
        { percentage: 0.60, reps: 4, isAmrap: false },
        { percentage: 0.60, reps: 6, isAmrap: false },
        { percentage: 0.60, reps: 8, isAmrap: false },
      ],
    },
  },
  // Day 4
  {
    t1: {
      exerciseName: 'Deadlift',
      exerciseKey: 'deadlift',
      tmExercise: 'deadlift',
      sets: [
        { percentage: 0.75, reps: 5, isAmrap: false },
        { percentage: 0.85, reps: 3, isAmrap: false },
        { percentage: 0.95, reps: 1, isAmrap: true },
        { percentage: 0.90, reps: 3, isAmrap: false },
        { percentage: 0.85, reps: 3, isAmrap: false },
        { percentage: 0.80, reps: 3, isAmrap: false },
        { percentage: 0.75, reps: 3, isAmrap: false },
        { percentage: 0.70, reps: 3, isAmrap: false },
        { percentage: 0.65, reps: 3, isAmrap: true },
      ],
    },
    t2: {
      exerciseName: 'Front Squat',
      exerciseKey: 'squat',
      tmExercise: 'squat',
      sets: [
        { percentage: 0.35, reps: 5, isAmrap: false },
        { percentage: 0.45, reps: 5, isAmrap: false },
        { percentage: 0.55, reps: 3, isAmrap: false },
        { percentage: 0.55, reps: 5, isAmrap: false },
        { percentage: 0.55, reps: 7, isAmrap: false },
        { percentage: 0.55, reps: 4, isAmrap: false },
        { percentage: 0.55, reps: 6, isAmrap: false },
        { percentage: 0.55, reps: 8, isAmrap: false },
      ],
    },
  },
];

export interface GeneratedSet {
  exercise: string;
  tier: 'T1' | 'T2';
  setOrder: number;
  prescribedWeight: number;
  prescribedReps: number;
  isAmrap: boolean;
}

export function generateWorkoutSets(
  dayNumber: number,
  trainingMaxes: Record<string, number>,
  unit: 'kg' | 'lb',
): GeneratedSet[] {
  if (dayNumber < 1 || dayNumber > 4) {
    throw new Error(`Invalid day number: ${dayNumber}. Must be 1-4.`);
  }

  const day = NSUNS_4DAY[dayNumber - 1];
  const slots: { slot: ExerciseSlot; tier: 'T1' | 'T2' }[] = [
    { slot: day.t1, tier: 'T1' },
    { slot: day.t2, tier: 'T2' },
  ];

  const result: GeneratedSet[] = [];

  for (const { slot, tier } of slots) {
    const tm = trainingMaxes[slot.tmExercise];
    if (tm === undefined) {
      throw new Error(
        `Missing training max for '${slot.tmExercise}' (needed for ${slot.exerciseName} on day ${dayNumber}).`,
      );
    }

    for (let i = 0; i < slot.sets.length; i++) {
      const scheme = slot.sets[i];
      result.push({
        exercise: slot.exerciseKey,
        tier,
        setOrder: i + 1,
        prescribedWeight: roundWeight(tm * scheme.percentage, unit),
        prescribedReps: scheme.reps,
        isAmrap: scheme.isAmrap,
      });
    }
  }

  return result;
}
