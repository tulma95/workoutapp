import type { UnitPreference } from '../types';

const LB_TO_KG = 2.20462;

/**
 * Convert weight from kg to the specified unit.
 * @param kg - weight in kilograms
 * @param unit - target unit ('kg' or 'lb')
 * @returns weight in the target unit (kg unchanged, lb = kg * 2.20462)
 */
export function convertWeight(kg: number, unit: UnitPreference): number {
  if (unit === 'lb') {
    return kg * LB_TO_KG;
  }
  return kg;
}

/**
 * Round weight to the nearest increment for the given unit.
 * @param value - weight value to round
 * @param unit - unit ('kg' rounds to 2.5, 'lb' rounds to 5)
 * @returns rounded weight
 */
export function roundWeight(value: number, unit: UnitPreference): number {
  if (unit === 'kg') {
    return Math.round(value / 2.5) * 2.5;
  }
  // lb
  return Math.round(value / 5) * 5;
}

/**
 * Convert weight from user's unit to kg (for sending to backend).
 * @param value - weight in user's unit
 * @param unit - user's unit preference
 * @returns weight in kg
 */
export function convertToKg(value: number, unit: UnitPreference): number {
  if (unit === 'lb') {
    return value / LB_TO_KG;
  }
  return value;
}

/**
 * Format weight for display: convert from kg, round, and add unit suffix.
 * @param weight - weight in kg (backend always stores in kg)
 * @param unit - user's preferred unit
 * @returns formatted string like "100 kg" or "220 lb"
 */
export function formatWeight(weight: number, unit: UnitPreference): string {
  const converted = convertWeight(weight, unit);
  const rounded = roundWeight(converted, unit);
  return `${rounded} ${unit}`;
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
