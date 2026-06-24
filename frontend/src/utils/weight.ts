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

// Slugs whose canonical display name isn't just a title-cased version of the
// slug (e.g. abbreviations). Everything else is derived from the slug below.
const EXERCISE_NAMES: Record<string, string> = {
  ohp: 'Overhead Press',
};

export function formatExerciseName(exercise: string): string {
  if (EXERCISE_NAMES[exercise]) return EXERCISE_NAMES[exercise];
  // Title-case a hyphenated slug: "bench-press" -> "Bench Press".
  return exercise
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
