import { describe, it, expect } from 'vitest';
import { calculateStreak } from '../../lib/streak';

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const today = daysAgo(0);
const yesterday = daysAgo(1);
const twoDaysAgo = daysAgo(2);
const threeDaysAgo = daysAgo(3);

describe('calculateStreak', () => {
  it('returns 0 for empty input', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('returns 1 for single entry today', () => {
    expect(calculateStreak([today])).toBe(1);
  });

  it('returns 1 for single entry yesterday', () => {
    expect(calculateStreak([yesterday])).toBe(1);
  });

  it('returns 0 for single entry 2 days ago', () => {
    expect(calculateStreak([twoDaysAgo])).toBe(0);
  });

  it('returns correct count for consecutive days ending today', () => {
    expect(calculateStreak([today, yesterday, twoDaysAgo])).toBe(3);
  });

  it('returns correct count for consecutive days ending yesterday', () => {
    expect(calculateStreak([yesterday, twoDaysAgo, threeDaysAgo])).toBe(3);
  });

  it('counts only from end to gap when there is a gap', () => {
    expect(calculateStreak([today, yesterday, threeDaysAgo])).toBe(2);
  });

  it('deduplicates duplicate dates on the same day', () => {
    expect(calculateStreak([today, today, yesterday, yesterday])).toBe(2);
  });

  it('strips future dates before calculation', () => {
    const tomorrow = daysFromNow(1);
    expect(calculateStreak([tomorrow, today, yesterday])).toBe(2);
  });

  it('returns 0 when only future dates provided', () => {
    expect(calculateStreak([daysFromNow(1), daysFromNow(2)])).toBe(0);
  });

  it('returns 1 when only today has a workout', () => {
    expect(calculateStreak([today])).toBe(1);
  });

  it('returns 0 when last workout was more than 1 day ago', () => {
    expect(calculateStreak([twoDaysAgo, threeDaysAgo])).toBe(0);
  });
});
