import { describe, it, expect } from 'vitest';
import { calculateProgression } from '../../lib/progression';

describe('calculateProgression', () => {
  const exercises = ['bench', 'squat', 'ohp', 'deadlift'] as const;
  const upperBody = ['bench', 'ohp'] as const;
  const lowerBody = ['squat', 'deadlift'] as const;

  describe('0-1 reps → no increase (all exercises)', () => {
    for (const exercise of exercises) {
      it(`${exercise}: 0 reps → 0`, () => {
        expect(calculateProgression(0, exercise)).toEqual({ increase: 0 });
      });

      it(`${exercise}: 1 rep → 0`, () => {
        expect(calculateProgression(1, exercise)).toEqual({ increase: 0 });
      });
    }
  });

  describe('2-3 reps → 2.5kg (all exercises)', () => {
    for (const exercise of exercises) {
      it(`${exercise}: 2 reps → 2.5`, () => {
        expect(calculateProgression(2, exercise)).toEqual({ increase: 2.5 });
      });

      it(`${exercise}: 3 reps → 2.5`, () => {
        expect(calculateProgression(3, exercise)).toEqual({ increase: 2.5 });
      });
    }
  });

  describe('4-5 reps → upper 2.5, lower 5', () => {
    for (const exercise of upperBody) {
      it(`${exercise}: 4 reps → 2.5`, () => {
        expect(calculateProgression(4, exercise)).toEqual({ increase: 2.5 });
      });

      it(`${exercise}: 5 reps → 2.5`, () => {
        expect(calculateProgression(5, exercise)).toEqual({ increase: 2.5 });
      });
    }

    for (const exercise of lowerBody) {
      it(`${exercise}: 4 reps → 5`, () => {
        expect(calculateProgression(4, exercise)).toEqual({ increase: 5 });
      });

      it(`${exercise}: 5 reps → 5`, () => {
        expect(calculateProgression(5, exercise)).toEqual({ increase: 5 });
      });
    }
  });

  describe('6+ reps → upper 5, lower 7.5', () => {
    for (const exercise of upperBody) {
      it(`${exercise}: 6 reps → 5`, () => {
        expect(calculateProgression(6, exercise)).toEqual({ increase: 5 });
      });

      it(`${exercise}: 10 reps → 5`, () => {
        expect(calculateProgression(10, exercise)).toEqual({ increase: 5 });
      });
    }

    for (const exercise of lowerBody) {
      it(`${exercise}: 6 reps → 7.5`, () => {
        expect(calculateProgression(6, exercise)).toEqual({ increase: 7.5 });
      });

      it(`${exercise}: 10 reps → 7.5`, () => {
        expect(calculateProgression(10, exercise)).toEqual({ increase: 7.5 });
      });
    }
  });
});
