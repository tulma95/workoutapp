import { describe, it, expect } from 'vitest';
import { roundWeight } from '../../lib/weightRounding';

describe('roundWeight', () => {
  it('rounds to nearest 2.5 (63.7 → 62.5)', () => {
    expect(roundWeight(63.7)).toBe(62.5);
  });

  it('rounds up when closer to upper increment', () => {
    expect(roundWeight(66.3)).toBe(67.5);
  });

  it('rounds down to nearest 2.5', () => {
    expect(roundWeight(61.2)).toBe(60);
  });

  it('keeps exact multiples of 2.5', () => {
    expect(roundWeight(62.5)).toBe(62.5);
  });

  it('handles zero', () => {
    expect(roundWeight(0)).toBe(0);
  });
});
