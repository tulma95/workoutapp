type Exercise = 'bench' | 'squat' | 'ohp' | 'deadlift';

const UPPER_BODY: Exercise[] = ['bench', 'ohp'];

function isUpperBody(exercise: Exercise): boolean {
  return UPPER_BODY.includes(exercise);
}

export function calculateProgression(
  amrapReps: number,
  exercise: Exercise,
): { increase: number } {
  if (amrapReps <= 1) return { increase: 0 };
  if (amrapReps <= 3) return { increase: 2.5 };
  if (amrapReps <= 5) return { increase: isUpperBody(exercise) ? 2.5 : 5 };
  return { increase: isUpperBody(exercise) ? 5 : 7.5 };
}
