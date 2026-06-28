import prisma from '../lib/db';
import { Prisma } from '../generated/prisma/client';
import { roundWeight } from '../lib/weightRounding';

// Number of consecutive non-progressing sessions that counts as a stall.
const STALL_SESSIONS = 3;
// Suggested deload as a fraction of the current TM.
const DELOAD_FACTOR = 0.9;

interface ProgressionRule {
  exerciseId: number | null;
  category: string | null;
  minReps: number;
  maxReps: number;
  increase: { toNumber(): number };
}
interface ProgExercise {
  id: number;
  slug: string;
  name: string;
  isUpperBody: boolean;
}

// Read-only mirror of completeWorkout's rule matching: the TM increase a given
// AMRAP rep count would earn. <= 0 means that session didn't progress the lift.
function progressionIncrease(
  rules: ProgressionRule[],
  exercise: ProgExercise,
  actualReps: number,
): number {
  let rule = rules.find(
    (r) => r.exerciseId === exercise.id && actualReps >= r.minReps && actualReps <= r.maxReps,
  );
  if (!rule) {
    const category = exercise.isUpperBody ? 'upper' : 'lower';
    rule = rules.find(
      (r) => r.category === category && actualReps >= r.minReps && actualReps <= r.maxReps,
    );
  }
  return rule ? rule.increase.toNumber() : 0;
}

export interface Stall {
  exerciseSlug: string;
  exerciseName: string;
  currentTM: number;
  suggestedTM: number;
}

// Raw row returned by the bounded window query.
interface BoundedSetRow {
  actualReps: number;
  exerciseId: number;
  completedAt: Date;
  exerciseSlug: string;
  exerciseName: string;
  exerciseIsUpperBody: boolean;
}

// A lift is "stalling" when its last STALL_SESSIONS completed progression (AMRAP)
// sets all earned no TM increase. Suggests a 10% deload (one-tap apply via the
// existing manual TM update). Conservative: needs >= STALL_SESSIONS data points.
//
// Optimization (ticket 187): instead of fetching ALL progression sets for the
// user (which grows unboundedly over the years), a window query partitioned by
// exercise_id limits the result to at most STALL_SESSIONS rows per exercise —
// the only rows that can ever affect the stall verdict.
export async function getStalls(userId: number): Promise<Stall[]> {
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: { plan: { include: { progressionRules: true } } },
  });
  if (!activePlan) return [];
  const rules = activePlan.plan.progressionRules as unknown as ProgressionRule[];

  // Fetch at most STALL_SESSIONS rows per exercise (the newest by completedAt).
  // The CTE computes ROW_NUMBER() partitioned by exercise_id and ordered by
  // completed_at DESC — the outer WHERE rn <= STALL_SESSIONS makes the DB
  // materialise only those rows, identical to what the old JS grouping kept.
  const sets = await prisma.$queryRaw<BoundedSetRow[]>(Prisma.sql`
    WITH ranked AS (
      SELECT
        ws.actual_reps                AS "actualReps",
        ws.exercise_id                AS "exerciseId",
        w.completed_at                AS "completedAt",
        e.slug                        AS "exerciseSlug",
        e.name                        AS "exerciseName",
        e.is_upper_body               AS "exerciseIsUpperBody",
        ROW_NUMBER() OVER (
          PARTITION BY ws.exercise_id
          ORDER BY w.completed_at DESC
        )                             AS rn
      FROM workout_sets ws
      JOIN workouts w ON ws.workout_id = w.id
      JOIN exercises e ON ws.exercise_id = e.id
      WHERE ws.is_progression = true
        AND ws.actual_reps IS NOT NULL
        AND w.user_id = ${userId}
        AND w.status = 'completed'
        AND w.completed_at IS NOT NULL
    )
    SELECT "actualReps", "exerciseId", "completedAt",
           "exerciseSlug", "exerciseName", "exerciseIsUpperBody"
    FROM ranked
    WHERE rn <= ${STALL_SESSIONS}
    ORDER BY "exerciseId", rn
  `);

  // Group rows by exercise (at most STALL_SESSIONS per group, already ordered
  // newest-first by the window partition so push order is correct).
  type Recent = { actualReps: number; exercise: ProgExercise; completedAt: Date };
  const byExercise = new Map<number, Recent[]>();
  for (const s of sets) {
    const exercise: ProgExercise = {
      id: s.exerciseId,
      slug: s.exerciseSlug,
      name: s.exerciseName,
      isUpperBody: s.exerciseIsUpperBody,
    };
    const list = byExercise.get(s.exerciseId) ?? [];
    list.push({ actualReps: Number(s.actualReps), exercise, completedAt: s.completedAt });
    byExercise.set(s.exerciseId, list);
  }

  // Latest TM per exercise, keyed by the *performed* exercise id (matching how
  // completeWorkout writes TM rows). Queried directly rather than via
  // getCurrentTMs, which filters by tmExerciseId and would miss lifts whose
  // TM exercise differs from the performed exercise.
  const tmRows = await prisma.trainingMax.findMany({
    where: { userId },
    orderBy: { effectiveDate: 'desc' },
    select: { exerciseId: true, weight: true, effectiveDate: true },
  });
  const tmByExerciseId = new Map<number, { weight: number; effectiveDate: Date }>();
  for (const t of tmRows) {
    if (!tmByExerciseId.has(t.exerciseId)) {
      tmByExerciseId.set(t.exerciseId, { weight: Number(t.weight), effectiveDate: t.effectiveDate });
    }
  }

  const stalls: Stall[] = [];
  for (const list of byExercise.values()) {
    if (list.length < STALL_SESSIONS) continue;
    const allStalled = list.every((s) => progressionIncrease(rules, s.exercise, s.actualReps) <= 0);
    if (!allStalled) continue;

    const ex = list[0]!.exercise;
    const tm = tmByExerciseId.get(ex.id);
    if (tm == null) continue;

    // If the TM was adjusted (e.g. an applied deload) on or after the DAY of the
    // most recent failing session, the stall is resolved — don't keep
    // re-suggesting it. Day granularity because manual TM updates store
    // effectiveDate at local midnight, so a same-day deload must still clear it.
    const failureDayStart = new Date(list[0]!.completedAt);
    failureDayStart.setHours(0, 0, 0, 0);
    if (new Date(tm.effectiveDate) >= failureDayStart) continue;

    const suggestedTM = roundWeight(tm.weight * DELOAD_FACTOR);
    // Don't suggest a deload that wouldn't actually lower the TM (tiny TMs).
    if (suggestedTM >= tm.weight) continue;

    stalls.push({
      exerciseSlug: ex.slug,
      exerciseName: ex.name,
      currentTM: tm.weight,
      suggestedTM,
    });
  }
  return stalls;
}
