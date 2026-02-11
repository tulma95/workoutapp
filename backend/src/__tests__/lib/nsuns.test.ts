import { describe, it, expect } from 'vitest';
import { NSUNS_4DAY, generateWorkoutSets } from '../../lib/nsuns';

describe('NSUNS_4DAY', () => {
  it('has 4 days', () => {
    expect(NSUNS_4DAY).toHaveLength(4);
  });

  const dayExpectations = [
    { day: 1, t1Name: 'Bench Volume', t1Key: 'bench', t1Tm: 'bench', t2Name: 'OHP', t2Key: 'ohp', t2Tm: 'ohp' },
    { day: 2, t1Name: 'Squat', t1Key: 'squat', t1Tm: 'squat', t2Name: 'Sumo Deadlift', t2Key: 'deadlift', t2Tm: 'deadlift' },
    { day: 3, t1Name: 'Bench Heavy', t1Key: 'bench', t1Tm: 'bench', t2Name: 'Close Grip Bench', t2Key: 'bench', t2Tm: 'bench' },
    { day: 4, t1Name: 'Deadlift', t1Key: 'deadlift', t1Tm: 'deadlift', t2Name: 'Front Squat', t2Key: 'squat', t2Tm: 'squat' },
  ];

  for (const exp of dayExpectations) {
    describe(`Day ${exp.day}`, () => {
      const day = NSUNS_4DAY[exp.day - 1];

      it(`T1 is ${exp.t1Name} (key: ${exp.t1Key}, tm: ${exp.t1Tm})`, () => {
        expect(day.t1.exerciseName).toBe(exp.t1Name);
        expect(day.t1.exerciseKey).toBe(exp.t1Key);
        expect(day.t1.tmExercise).toBe(exp.t1Tm);
      });

      it('T1 has 9 sets', () => {
        expect(day.t1.sets).toHaveLength(9);
      });

      it(`T2 is ${exp.t2Name} (key: ${exp.t2Key}, tm: ${exp.t2Tm})`, () => {
        expect(day.t2.exerciseName).toBe(exp.t2Name);
        expect(day.t2.exerciseKey).toBe(exp.t2Key);
        expect(day.t2.tmExercise).toBe(exp.t2Tm);
      });

      it('T2 has 8 sets', () => {
        expect(day.t2.sets).toHaveLength(8);
      });
    });
  }

  describe('AMRAP positions', () => {
    it('Day 1 T1 has AMRAP only on set 9 (65%)', () => {
      const amraps = NSUNS_4DAY[0].t1.sets
        .map((s, i) => (s.isAmrap ? i + 1 : null))
        .filter(Boolean);
      expect(amraps).toEqual([9]);
    });

    it('Day 2 T1 has AMRAPs on sets 3 (95%) and 9 (65%)', () => {
      const amraps = NSUNS_4DAY[1].t1.sets
        .map((s, i) => (s.isAmrap ? i + 1 : null))
        .filter(Boolean);
      expect(amraps).toEqual([3, 9]);
    });

    it('Day 3 T1 has AMRAPs on sets 3 (95%) and 9 (65%)', () => {
      const amraps = NSUNS_4DAY[2].t1.sets
        .map((s, i) => (s.isAmrap ? i + 1 : null))
        .filter(Boolean);
      expect(amraps).toEqual([3, 9]);
    });

    it('Day 4 T1 has AMRAPs on sets 3 (95%) and 9 (65%)', () => {
      const amraps = NSUNS_4DAY[3].t1.sets
        .map((s, i) => (s.isAmrap ? i + 1 : null))
        .filter(Boolean);
      expect(amraps).toEqual([3, 9]);
    });

    it('no T2 sets are AMRAP', () => {
      for (const day of NSUNS_4DAY) {
        const t2Amraps = day.t2.sets.filter((s) => s.isAmrap);
        expect(t2Amraps).toHaveLength(0);
      }
    });
  });
});

describe('generateWorkoutSets', () => {
  const trainingMaxes = { bench: 90, squat: 126, ohp: 54, deadlift: 162 };

  it('returns 17 sets for a day (9 T1 + 8 T2)', () => {
    const sets = generateWorkoutSets(1, trainingMaxes, 'kg');
    expect(sets).toHaveLength(17);
    expect(sets.filter((s) => s.tier === 'T1')).toHaveLength(9);
    expect(sets.filter((s) => s.tier === 'T2')).toHaveLength(8);
  });

  it('T1 sets are numbered 1-9, T2 sets are numbered 1-8', () => {
    const sets = generateWorkoutSets(1, trainingMaxes, 'kg');
    const t1Orders = sets.filter((s) => s.tier === 'T1').map((s) => s.setOrder);
    const t2Orders = sets.filter((s) => s.tier === 'T2').map((s) => s.setOrder);
    expect(t1Orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(t2Orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('Day 2 T1 set 3 (95% of 126kg squat TM) = 120kg', () => {
    const sets = generateWorkoutSets(2, trainingMaxes, 'kg');
    const set3 = sets.find((s) => s.tier === 'T1' && s.setOrder === 3);
    expect(set3).toBeDefined();
    expect(set3!.prescribedWeight).toBe(120);
    expect(set3!.prescribedReps).toBe(1);
    expect(set3!.isAmrap).toBe(true);
  });

  it('Day 2 T2 set 1 (50% of 162kg deadlift TM) rounds correctly', () => {
    const sets = generateWorkoutSets(2, trainingMaxes, 'kg');
    const set1 = sets.find((s) => s.tier === 'T2' && s.setOrder === 1);
    expect(set1).toBeDefined();
    // 162 * 0.50 = 81, round(81 / 2.5) * 2.5 = round(32.4) * 2.5 = 32 * 2.5 = 80
    expect(set1!.prescribedWeight).toBe(80);
  });

  it('lb rounding uses 5lb increments', () => {
    const sets = generateWorkoutSets(2, trainingMaxes, 'lb');
    const set3 = sets.find((s) => s.tier === 'T1' && s.setOrder === 3);
    // 126 * 0.95 = 119.7, round(119.7 / 5) * 5 = round(23.94) * 5 = 24 * 5 = 120
    expect(set3!.prescribedWeight).toBe(120);
  });

  it('throws on invalid day number', () => {
    expect(() => generateWorkoutSets(0, trainingMaxes, 'kg')).toThrow('Invalid day number');
    expect(() => generateWorkoutSets(5, trainingMaxes, 'kg')).toThrow('Invalid day number');
  });

  it('throws on missing training max', () => {
    expect(() => generateWorkoutSets(1, { bench: 90 }, 'kg')).toThrow("Missing training max for 'ohp'");
    expect(() => generateWorkoutSets(2, { squat: 126 }, 'kg')).toThrow("Missing training max for 'deadlift'");
  });
});
