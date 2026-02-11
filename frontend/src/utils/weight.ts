export function formatWeight(weight: number, unit: 'kg' | 'lb'): string {
  return `${weight} ${unit}`;
}

const EXERCISE_NAMES: Record<string, string> = {
  bench: 'Bench',
  squat: 'Squat',
  ohp: 'OHP',
  deadlift: 'Deadlift',
};

export function formatExerciseName(exercise: string): string {
  return EXERCISE_NAMES[exercise] || exercise.charAt(0).toUpperCase() + exercise.slice(1);
}
