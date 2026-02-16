/**
 * Round weight to nearest 2.5 kg.
 */
export function roundWeight(value: number): number {
  return Math.round(value / 2.5) * 2.5;
}

/**
 * Format weight for display: round and add "kg" suffix.
 */
export function formatWeight(weight: number): string {
  const rounded = roundWeight(weight);
  return `${rounded} kg`;
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
