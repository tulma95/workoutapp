import prisma from '../lib/db';
import { roundWeight } from '../lib/weightRounding';

const LB_TO_KG = 2.20462;
const EXERCISES = ['bench', 'squat', 'ohp', 'deadlift'] as const;

function toKg(weight: number, unit: string): number {
  return unit === 'lb' ? weight / LB_TO_KG : weight;
}

function decimalToNumber(val: unknown): number {
  return Number(val);
}

export async function getCurrentTMs(userId: number) {
  const results = await Promise.all(
    EXERCISES.map(async (exercise) => {
      const tm = await prisma.trainingMax.findFirst({
        where: { userId, exercise },
        orderBy: { effectiveDate: 'desc' },
      });
      return tm;
    }),
  );

  return results
    .filter((tm) => tm !== null)
    .map((tm) => ({
      ...tm,
      weight: decimalToNumber(tm.weight),
    }));
}

export async function setupFromOneRepMaxes(
  userId: number,
  oneRepMaxes: Record<string, number>,
  unit: string,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const created = await Promise.all(
    EXERCISES.map(async (exercise) => {
      const orm = oneRepMaxes[exercise];
      const ormKg = toKg(orm, unit);
      const tm = roundWeight(ormKg * 0.9, 'kg');

      const row = await prisma.trainingMax.upsert({
        where: {
          userId_exercise_effectiveDate: {
            userId,
            exercise,
            effectiveDate: today,
          },
        },
        update: { weight: tm },
        create: {
          userId,
          exercise,
          weight: tm,
          effectiveDate: today,
        },
      });
      return { ...row, weight: decimalToNumber(row.weight) };
    }),
  );

  return created;
}

export async function updateTM(
  userId: number,
  exercise: string,
  weight: number,
  unit: string,
) {
  const weightKg = roundWeight(toKg(weight, unit), 'kg');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const row = await prisma.trainingMax.upsert({
    where: {
      userId_exercise_effectiveDate: {
        userId,
        exercise,
        effectiveDate: today,
      },
    },
    update: { weight: weightKg },
    create: {
      userId,
      exercise,
      weight: weightKg,
      effectiveDate: today,
    },
  });

  return { ...row, weight: decimalToNumber(row.weight) };
}

export async function getHistory(userId: number, exercise: string) {
  const rows = await prisma.trainingMax.findMany({
    where: { userId, exercise },
    orderBy: { effectiveDate: 'desc' },
  });

  return rows.map((row) => ({
    ...row,
    weight: decimalToNumber(row.weight),
  }));
}
