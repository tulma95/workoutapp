# e1RM Progression History — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace TM-based progress chart with e1RM computed from actual completed sets, making progression data program-agnostic.

**Architecture:** Modify `GET /api/progress` to compute `MAX(weight * (1 + reps/30))` per exercise per session from `workout_sets` + `workouts`. No schema changes. Frontend swaps TM fields for e1RM fields, adds "Show all exercises" toggle.

**Tech Stack:** Prisma raw SQL, Express, React, custom SVG chart (existing)

---

### Task 1: Backend service — compute e1RM from completed sets

**Files:**
- Modify: `backend/src/services/progress.service.ts` (full rewrite of `getProgress`)

**Step 1: Write the failing test**

Modify `backend/src/__tests__/progress.test.ts`. Add a new test that creates a completed workout with sets and expects e1RM data back.

```typescript
// Add to existing describe block, after the 'returns exercises with TMs' test

it('returns e1RM history computed from completed workout sets', async () => {
  // The user already has an active plan + TMs from the prior test
  const exerciseMap = await getExercisesBySlug(['bench-press', 'squat']);
  const benchId = exerciseMap['bench-press']!.id;

  // Create a completed workout with logged sets
  const workout = await prisma.workout.create({
    data: {
      userId,
      dayNumber: 1,
      status: 'completed',
      completedAt: new Date('2025-06-15T10:00:00Z'),
    },
  });

  await prisma.workoutSet.createMany({
    data: [
      {
        workoutId: workout.id,
        exerciseId: benchId,
        exerciseOrder: 1,
        setOrder: 1,
        prescribedWeight: 80,
        prescribedReps: 5,
        actualReps: 5,
        completed: true,
        isAmrap: false,
        isProgression: false,
      },
      {
        workoutId: workout.id,
        exerciseId: benchId,
        exerciseOrder: 1,
        setOrder: 2,
        prescribedWeight: 80,
        prescribedReps: 5,
        actualReps: 8,
        completed: true,
        isAmrap: true,
        isProgression: true,
      },
    ],
  });

  const res = await request(app)
    .get('/api/progress')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);

  const bench = res.body.exercises.find((e: any) => e.slug === 'bench-press');
  expect(bench).toBeDefined();
  // Best e1RM: 80 * (1 + 8/30) = 80 * 1.2667 = 101.33
  expect(bench.currentE1rm).toBeCloseTo(101.33, 0);
  expect(bench.history).toBeInstanceOf(Array);
  expect(bench.history.length).toBeGreaterThanOrEqual(1);
  expect(bench.history[0].e1rm).toBeCloseTo(101.33, 0);
  expect(bench.history[0].date).toBeDefined();
  expect(bench.inCurrentPlan).toBe(true);

  // Should NOT have old TM fields
  expect(bench.currentTM).toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `./run_test.sh > /tmp/test_output.log 2>&1; echo "EXIT_CODE=$?" >> /tmp/test_output.log`
Then: `tail -200 /tmp/test_output.log`
Expected: FAIL — `currentE1rm` is undefined, response still has `currentTM`.

**Step 3: Write the implementation**

Rewrite `backend/src/services/progress.service.ts`:

```typescript
import prisma from '../lib/db';
import { Prisma } from '@prisma/client';

export interface ProgressExercise {
  slug: string;
  name: string;
  currentE1rm: number | null;
  history: Array<{
    e1rm: number;
    date: string;
  }>;
  inCurrentPlan: boolean;
}

export interface PlanSwitch {
  date: string;
  planName: string;
}

function computeE1rm(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export async function getProgress(
  userId: number,
): Promise<{ exercises: ProgressExercise[]; planSwitches: PlanSwitch[] }> {
  // 1. Get plan switches (unchanged logic)
  const allUserPlans = await prisma.userPlan.findMany({
    where: { userId },
    orderBy: { startedAt: 'asc' },
    include: { plan: { select: { name: true } } },
  });

  const planSwitches: PlanSwitch[] = allUserPlans.slice(1).map((up) => ({
    date: up.startedAt.toISOString(),
    planName: up.plan.name,
  }));

  // 2. Get current plan exercise IDs for the inCurrentPlan flag
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: {
      plan: {
        include: {
          days: {
            include: {
              exercises: {
                include: { tmExercise: true },
              },
            },
          },
        },
      },
    },
  });

  const currentPlanExerciseIds = new Set<number>();
  if (activePlan) {
    for (const day of activePlan.plan.days) {
      for (const ex of day.exercises) {
        currentPlanExerciseIds.add(ex.tmExerciseId);
      }
    }
  }

  // 3. Query all completed sets for this user, compute best e1RM per exercise per day
  const completedSets = await prisma.workoutSet.findMany({
    where: {
      workout: {
        userId,
        status: 'completed',
        completedAt: { not: null },
      },
      completed: true,
      actualReps: { not: null, gt: 0 },
    },
    select: {
      exerciseId: true,
      prescribedWeight: true,
      actualReps: true,
      workout: {
        select: { completedAt: true },
      },
      exercise: {
        select: { id: true, slug: true, name: true },
      },
    },
    orderBy: {
      workout: { completedAt: 'asc' },
    },
  });

  // Group by exercise -> date -> best e1RM
  const exerciseMap = new Map<number, {
    slug: string;
    name: string;
    historyByDate: Map<string, number>;
  }>();

  for (const set of completedSets) {
    const exerciseId = set.exerciseId;
    const weight = set.prescribedWeight.toNumber();
    const reps = set.actualReps as number;
    const e1rm = computeE1rm(weight, reps);
    const dateKey = (set.workout.completedAt as Date).toISOString().split('T')[0]!;

    if (!exerciseMap.has(exerciseId)) {
      exerciseMap.set(exerciseId, {
        slug: set.exercise.slug,
        name: set.exercise.name,
        historyByDate: new Map(),
      });
    }

    const entry = exerciseMap.get(exerciseId)!;
    const existing = entry.historyByDate.get(dateKey) ?? 0;
    if (e1rm > existing) {
      entry.historyByDate.set(dateKey, e1rm);
    }
  }

  // Build response: current plan exercises first (in plan order), then others alphabetically
  const planOrderExerciseIds: number[] = [];
  if (activePlan) {
    const seen = new Set<number>();
    for (const day of activePlan.plan.days) {
      for (const ex of day.exercises) {
        if (!seen.has(ex.tmExerciseId)) {
          seen.add(ex.tmExerciseId);
          planOrderExerciseIds.push(ex.tmExerciseId);
        }
      }
    }
  }

  const exercises: ProgressExercise[] = [];

  // Add current plan exercises first (in plan order)
  for (const exId of planOrderExerciseIds) {
    const data = exerciseMap.get(exId);
    if (!data) continue;
    const history = Array.from(data.historyByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e1rm]) => ({ e1rm: Math.round(e1rm * 100) / 100, date }));

    exercises.push({
      slug: data.slug,
      name: data.name,
      currentE1rm: history.length > 0 ? history[history.length - 1]!.e1rm : null,
      history,
      inCurrentPlan: true,
    });
  }

  // Add non-plan exercises (alphabetically by name)
  const nonPlanExercises = Array.from(exerciseMap.entries())
    .filter(([id]) => !currentPlanExerciseIds.has(id))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));

  for (const [exId, data] of nonPlanExercises) {
    const history = Array.from(data.historyByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e1rm]) => ({ e1rm: Math.round(e1rm * 100) / 100, date }));

    exercises.push({
      slug: data.slug,
      name: data.name,
      currentE1rm: history.length > 0 ? history[history.length - 1]!.e1rm : null,
      history,
      inCurrentPlan: false,
    });
  }

  return { exercises, planSwitches };
}
```

**Step 4: Run tests and verify pass**

Run: `./run_test.sh > /tmp/test_output.log 2>&1; echo "EXIT_CODE=$?" >> /tmp/test_output.log`
Then: `tail -200 /tmp/test_output.log`
Expected: New test passes. Existing tests that check `currentTM` will fail — fix in next step.

**Step 5: Update existing backend tests**

In `backend/src/__tests__/progress.test.ts`, update the test `'returns exercises with TMs and history for active plan'`:
- This test creates TMs but no completed workouts, so the response will have empty exercises (no completed sets = no e1RM data)
- Change the test to verify that exercises without completed sets are NOT in the response
- Or add completed workout sets to the test setup

Replace the assertion block:
```typescript
// After setting up TMs, create a completed workout with sets to generate e1RM data
const workout = await prisma.workout.create({
  data: {
    userId,
    dayNumber: 1,
    status: 'completed',
    completedAt: new Date(),
  },
});

await prisma.workoutSet.createMany({
  data: [
    {
      workoutId: workout.id,
      exerciseId: benchId,
      exerciseOrder: 1,
      setOrder: 1,
      prescribedWeight: 90,
      prescribedReps: 5,
      actualReps: 5,
      completed: true,
      isAmrap: false,
      isProgression: false,
    },
  ],
});

const res = await request(app)
  .get('/api/progress')
  .set('Authorization', `Bearer ${token}`);

expect(res.status).toBe(200);

const bench = res.body.exercises.find((e: any) => e.slug === 'bench-press');
expect(bench).toBeDefined();
expect(bench.name).toBe('Bench Press');
// e1RM = 90 * (1 + 5/30) = 105
expect(bench.currentE1rm).toBeCloseTo(105, 0);
expect(bench.history).toBeInstanceOf(Array);
expect(bench.history.length).toBeGreaterThanOrEqual(1);
expect(bench.inCurrentPlan).toBe(true);
```

**Step 6: Run tests and verify all pass**

Run: `./run_test.sh > /tmp/test_output.log 2>&1; echo "EXIT_CODE=$?" >> /tmp/test_output.log`
Then: `tail -200 /tmp/test_output.log`
Expected: All backend progress tests pass.

**Step 7: Commit**

```bash
git add backend/src/services/progress.service.ts backend/src/__tests__/progress.test.ts
git commit -m "feat(XXX): replace TM-based progress with e1RM from completed sets

Compute best estimated 1RM per exercise per session using Epley formula
instead of tracking training max history. This makes progression data
program-agnostic across plan switches."
```

---

### Task 2: Frontend schema + API types

**Files:**
- Modify: `frontend/src/api/schemas.ts` (ProgressExerciseSchema, ProgressResponseSchema)
- Modify: `frontend/src/components/ProgressChart.tsx` (HistoryEntry interface)

**Step 1: Update the Zod schema**

In `frontend/src/api/schemas.ts`, replace:

```typescript
// Old
export const ProgressExerciseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  currentTM: z.number().nullable(),
  history: z.array(z.object({
    weight: z.number(),
    effectiveDate: z.string(),
  })),
});
```

With:

```typescript
// New
export const ProgressExerciseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  currentE1rm: z.number().nullable(),
  history: z.array(z.object({
    e1rm: z.number(),
    date: z.string(),
  })),
  inCurrentPlan: z.boolean(),
});
```

**Step 2: Update HistoryEntry in ProgressChart.tsx**

```typescript
// Old
export interface HistoryEntry {
  weight: number
  effectiveDate: string
}

// New
export interface HistoryEntry {
  e1rm: number
  date: string
}
```

**Step 3: Fix all references to old field names in ProgressChart.tsx**

Replace all `point.effectiveDate` → `point.date`, `point.weight` → `point.e1rm`, `d.weight` → `d.e1rm`, `d.effectiveDate` → `d.date`.

Update chart title from "Training Max progression chart" to "Estimated 1RM progression chart".
Update accessible table caption from "Training Max History" to "Estimated 1RM History".
Update accessible table header from "Weight (kg)" to "Est. 1RM (kg)".

**Step 4: Run typecheck**

Run: `cd frontend && npx tsc --build --noEmit`
Expected: Type errors in ProgressContent.tsx and ProgressSummaryCards.tsx (they still reference old fields). This is expected — fixed in Task 3.

**Step 5: Commit**

```bash
git add frontend/src/api/schemas.ts frontend/src/components/ProgressChart.tsx
git commit -m "feat(XXX): update progress types from TM to e1RM schema"
```

---

### Task 3: Update frontend components

**Files:**
- Modify: `frontend/src/components/ProgressContent.tsx`
- Modify: `frontend/src/components/ProgressSummaryCards.tsx`

**Step 1: Update ProgressContent.tsx**

Key changes:
- `ex.currentTM` → `ex.currentE1rm`
- The `histories` map now contains `{ e1rm, date }` entries (already updated by Task 2)
- Add state for "show all exercises" toggle
- Filter `exerciseConfigs` by `inCurrentPlan` unless toggle is on

```typescript
// Add state
const [showAllExercises, setShowAllExercises] = useState(false)

// Update exerciseConfigs to include inCurrentPlan
const exerciseConfigs: (ExerciseConfig & { inCurrentPlan: boolean })[] = useMemo(() => {
  if (!data) return []
  return data.exercises.map((ex, i) => ({
    slug: ex.slug,
    name: ex.name,
    color: PALETTE[i % PALETTE.length] ?? PALETTE[0]!,
    inCurrentPlan: ex.inCurrentPlan,
  }))
}, [data])

// Filter displayed exercises
const displayedExercises = useMemo(() => {
  if (showAllExercises) return exerciseConfigs
  return exerciseConfigs.filter(ex => ex.inCurrentPlan)
}, [exerciseConfigs, showAllExercises])

// Add toggle button (above or below time range selector)
// Use displayedExercises instead of exerciseConfigs for rendering cards/legend
// Check hasTMs → hasData: data.exercises.some(ex => ex.currentE1rm !== null)
```

Change the empty state text from "training maxes" references to "estimated strength" or similar.

**Step 2: Update ProgressSummaryCards.tsx**

The `computeGain` function currently assumes history sorted DESC by effectiveDate. The new API returns history sorted ASC by date. Update:

```typescript
function computeGain(history: HistoryEntry[], rangeStart: Date | null): number {
  if (history.length === 0) return 0
  // History is sorted ASC by date
  const current = history[history.length - 1]!.e1rm
  if (rangeStart === null) {
    return current - history[0]!.e1rm
  }
  // Find baseline: last entry at or before range start
  let baseline = history[0]!.e1rm
  for (const entry of history) {
    if (new Date(entry.date) <= rangeStart) {
      baseline = entry.e1rm
    } else {
      break
    }
  }
  return current - baseline
}
```

Update the card display:
- `currentTM` → `currentE1rm` (from `history[history.length - 1]?.e1rm`)
- Or just use the value from `exerciseConfigs` data if passed through

**Step 3: Run typecheck**

Run: `cd frontend && npx tsc --build --noEmit`
Expected: PASS — no type errors.

**Step 4: Commit**

```bash
git add frontend/src/components/ProgressContent.tsx frontend/src/components/ProgressSummaryCards.tsx
git commit -m "feat(XXX): wire up e1RM data in progress page components

Show e1RM instead of TM in summary cards and chart.
Add 'Show all exercises' toggle for cross-program history."
```

---

### Task 4: Add "Show all exercises" toggle UI

**Files:**
- Modify: `frontend/src/components/ProgressContent.tsx`
- Modify: `frontend/src/components/ProgressContent.module.css`

**Step 1: Add toggle markup**

Add a simple checkbox/toggle below the time range selector:

```tsx
{hasNonPlanExercises && (
  <label className={styles.allExercisesToggle}>
    <input
      type="checkbox"
      checked={showAllExercises}
      onChange={(e) => setShowAllExercises(e.target.checked)}
    />
    Show all exercises
  </label>
)}
```

Where `hasNonPlanExercises = exerciseConfigs.some(ex => !ex.inCurrentPlan)`.

**Step 2: Add CSS**

```css
.allExercisesToggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  cursor: pointer;
  min-height: 2.75rem;
}
```

**Step 3: Run typecheck**

Run: `cd frontend && npx tsc --build --noEmit`
Expected: PASS.

**Step 4: Commit**

```bash
git add frontend/src/components/ProgressContent.tsx frontend/src/components/ProgressContent.module.css
git commit -m "feat(XXX): add show-all-exercises toggle on progress page

Allows viewing e1RM history for exercises not in the current plan,
enabling cross-program progression tracking."
```

---

### Task 5: Update E2E tests

**Files:**
- Modify: `e2e/progress.spec.ts`

**Step 1: Analyze what breaks**

Key E2E changes needed:
1. `'shows exercise summary cards with TM weights'` — still works (cards still show kg values, just e1RM instead of TM). May need text updates if we changed labels.
2. `'shows motivational empty state before any workouts'` — still works (no completed sets = no e1RM data = empty state).
3. `'shows updated TM after completing a workout with progression'` — the assertion `page.getByText('95 kg')` will fail because e1RM from the AMRAP set won't be exactly 95 kg. Need to update the expected value.
4. `'shows plan switch marker'` — the plan switch marker test creates a backdated TM entry but no workout sets. Need to create completed workout sets instead.

**Step 2: Update the progression test**

The test completes Day 1 with 10 AMRAP reps. The prescribed weight for bench work sets depends on plan config. After completion, instead of checking for a specific TM value, check that the e1RM appears as a kg value and is reasonable.

Look at the E2E seed data to find what weight is prescribed for bench sets. Then calculate expected e1RM.

**Step 3: Update the plan switch marker test**

Instead of using `backdate-tm` API, create a completed workout with sets dated in the past. Or adjust the test to create actual workout data that produces e1RM chart points.

**Step 4: Run E2E tests**

Run: `./run_test.sh > /tmp/test_output.log 2>&1; echo "EXIT_CODE=$?" >> /tmp/test_output.log`
Then: `tail -200 /tmp/test_output.log`
Expected: All E2E tests pass.

**Step 5: Commit**

```bash
git add e2e/progress.spec.ts
git commit -m "test(XXX): update E2E progress tests for e1RM data"
```

---

### Task 6: Update docs

**Files:**
- Modify: `docs/api-endpoints.md`

**Step 1: Update the progress endpoint documentation**

Change the `GET /api/progress` response shape to reflect `currentE1rm`, `e1rm`, `date`, `inCurrentPlan` fields instead of `currentTM`, `weight`, `effectiveDate`.

**Step 2: Commit**

```bash
git add docs/api-endpoints.md
git commit -m "docs(XXX): update progress endpoint docs for e1RM response"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Backend service + tests | None |
| 2 | Frontend types/schema | Task 1 (API must return new shape) |
| 3 | Frontend components | Task 2 (types must compile) |
| 4 | Show-all-exercises toggle | Task 3 |
| 5 | E2E tests | Tasks 1-4 |
| 6 | Docs | Task 1 |

Tasks 2-4 can be done as one batch. Task 6 can run in parallel with Task 5.
