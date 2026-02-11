import { describe, it, expect } from 'vitest';
import { roundWeight } from '../../lib/weightRounding';

describe('roundWeight', () => {
  describe('kg rounding (nearest 2.5)', () => {
    it('rounds to nearest 2.5 (63.7 → 62.5)', () => {
      expect(roundWeight(63.7, 'kg')).toBe(62.5);
    });

    it('rounds up when closer to upper increment', () => {
      expect(roundWeight(66.3, 'kg')).toBe(67.5);
    });

    it('rounds down to nearest 2.5', () => {
      expect(roundWeight(61.2, 'kg')).toBe(60);
    });

    it('keeps exact multiples of 2.5', () => {
      expect(roundWeight(62.5, 'kg')).toBe(62.5);
    });

    it('handles zero', () => {
      expect(roundWeight(0, 'kg')).toBe(0);
    });
  });

  describe('lb rounding (nearest 5)', () => {
    it('rounds down to nearest 5', () => {
      expect(roundWeight(137.3, 'lb')).toBe(135);
    });

    it('rounds up to nearest 5', () => {
      expect(roundWeight(142.8, 'lb')).toBe(145);
    });

    it('keeps exact multiples of 5', () => {
      expect(roundWeight(140, 'lb')).toBe(140);
    });

    it('handles zero', () => {
      expect(roundWeight(0, 'lb')).toBe(0);
    });
  });
});
