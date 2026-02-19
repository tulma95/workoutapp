# Dynamic Progress Page Exercises — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded exercise list on Progress page with a dynamic list driven by the user's active plan via a new `GET /api/progress` endpoint.

**Architecture:** New backend service + route (`GET /api/progress`) that queries the active plan's exercises and returns them with current TMs and full history. Frontend replaces N+1 queries with a single `useQuery(['progress'])` and builds exercise configs dynamically.

**Tech Stack:** Express route, Prisma queries, Zod validation (frontend), React Query, CSS Modules

---

### Task 1: Backend — Progress Service

**Files:**
- Create: `backend/src/services/progress.service.ts`

**Step 1: Write the failing test**

Create `backend/src/__tests__/progress.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/db';
import { createTestUser, getExercisesBySlug } from './helpers';

describe('GET /api/progress', () => {
  let token: string;

  beforeAll(async () => {
    const { token: t } = await createTestUser();
    token = t;
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/progress');
    expect(res.status).toBe(401);
  });

  it('returns empty exercises when no active plan', async () => {
    const res = await request(app)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exercises: [] });
  });

  it('returns exercises with TMs and history for active plan', async () => {
    // Subscribe to nSuns plan
    const plan = await prisma.workoutPlan.findFirst({ where: { slug: 'nsuns-4day-lp' } });
    await prisma.userPlan.create({
      data: {
        userId: (await prisma.user.findFirst({ where: { email: { contains: token.slice(0, 5) } } }))!.id,
        planId: plan!.id,
        isActive: true,
      },
    });

    // Look up user from token via a GET request
    const meRes = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    const userId = meRes.body.id;

    // Set up TMs
    const exercises = await getExercisesBySlug(['bench-press', 'squat', 'ohp', 'deadlift']);
    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({
        exerciseTMs: [
          { exerciseId: exercises['bench-press'].id, oneRepMax: 100 },
          { exerciseId: exercises['squat'].id, oneRepMax: 140 },
          { exerciseId: exercises['ohp'].id, oneRepMax: 60 },
          { exerciseId: exercises['deadlift'].id, oneRepMax: 180 },
        ],
      });

    const res = await request(app)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.exercises).toHaveLength(4);

    const bench = res.body.exercises.find((e: any) => e.slug === 'bench-press');
    expect(bench).toBeDefined();
    expect(bench.name).toBe('Bench Press');
    expect(bench.currentTM).toBe(90);
    expect(bench.history).toBeInstanceOf(Array);
    expect(bench.history.length).toBeGreaterThanOrEqual(1);
    expect(bench.history[0].weight).toBe(90);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/progress.test.ts`
Expected: FAIL (404, route not found)

**Step 3: Implement the progress service**

Create `backend/src/services/progress.service.ts`:

```ts
import prisma from '../lib/db';

export interface ProgressExercise {
  slug: string;
  name: string;
  currentTM: number | null;
  history: Array<{
    weight: number;
    effectiveDate: string;
    previousWeight: number | null;
  }>;
}

export async function getProgress(userId: number): Promise<{ exercises: ProgressExercise[] }> {
  // Find active plan
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: {
      plan: {
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              exercises: {
                orderBy: { sortOrder: 'asc' },
                include: { tmExercise: true },
              },
            },
          },
        },
      },
    },
  });

  if (!activePlan) {
    return { exercises: [] };
  }

  // Extract unique TM exercises in plan day order
  const seenIds = new Set<number>();
  const tmExercises: Array<{ id: number; slug: string; name: string }> = [];
  for (const day of activePlan.plan.days) {
    for (const ex of day.exercises) {
      if (!seenIds.has(ex.tmExerciseId)) {
        seenIds.add(ex.tmExerciseId);
        tmExercises.push({
          id: ex.tmExercise.id,
          slug: ex.tmExercise.slug,
          name: ex.tmExercise.name,
        });
      }
    }
  }

  if (tmExercises.length === 0) {
    return { exercises: [] };
  }

  // Fetch all TM history for these exercises in one query
  const allTMs = await prisma.trainingMax.findMany({
    where: {
      userId,
      exerciseId: { in: tmExercises.map((e) => e.id) },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  // Group by exerciseId
  const tmsByExercise = new Map<number, typeof allTMs>();
  for (const tm of allTMs) {
    const list = tmsByExercise.get(tm.exerciseId) ?? [];
    list.push(tm);
    tmsByExercise.set(tm.exerciseId, list);
  }

  // Build response
  const exercises: ProgressExercise[] = tmExercises.map((ex) => {
    const history = tmsByExercise.get(ex.id) ?? [];
    const currentTM = history.length > 0 ? history[0].weight.toNumber() : null;

    return {
      slug: ex.slug,
      name: ex.name,
      currentTM,
      history: history.map((tm) => ({
        weight: tm.weight.toNumber(),
        effectiveDate: tm.effectiveDate.toISOString(),
        previousWeight: tm.previousWeight?.toNumber() ?? null,
      })),
    };
  });

  return { exercises };
}
```

**Step 4: Create the route**

Create `backend/src/routes/progress.ts`:

```ts
import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types';
import * as progressService from '../services/progress.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const result = await progressService.getProgress(getUserId(req));
  res.json(result);
});

export default router;
```

**Step 5: Register the route in app.ts**

In `backend/src/app.ts`, add:
```ts
import progressRoutes from './routes/progress';
```
And mount it:
```ts
app.use('/api/progress', progressRoutes);
```

**Step 6: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/progress.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/src/services/progress.service.ts backend/src/routes/progress.ts backend/src/app.ts backend/src/__tests__/progress.test.ts
git commit -m "feat: add GET /api/progress endpoint"
```

---

### Task 2: Frontend — API Layer + Schema

**Files:**
- Modify: `frontend/src/api/schemas.ts` (add ProgressResponseSchema)
- Create: `frontend/src/api/progress.ts`

**Step 1: Add Zod schema to `frontend/src/api/schemas.ts`**

Add after the `TrainingMaxHistorySchema` line (~line 98):

```ts
export const ProgressExerciseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  currentTM: z.number().nullable(),
  history: z.array(z.object({
    weight: z.number(),
    effectiveDate: z.string(),
    previousWeight: z.number().nullable(),
  })),
});

export const ProgressResponseSchema = z.object({
  exercises: z.array(ProgressExerciseSchema),
});

export type ProgressExercise = z.infer<typeof ProgressExerciseSchema>;
export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;
```

**Step 2: Create `frontend/src/api/progress.ts`**

```ts
import { apiFetch } from './client';
import { ProgressResponseSchema } from './schemas';
export type { ProgressResponse, ProgressExercise } from './schemas';

export async function getProgress() {
  const data = await apiFetch('/progress');
  return ProgressResponseSchema.parse(data);
}
```

**Step 3: Commit**

```bash
git add frontend/src/api/schemas.ts frontend/src/api/progress.ts
git commit -m "feat: add progress API client and Zod schema"
```

---

### Task 3: Frontend — Refactor ProgressContent to Use New Endpoint

**Files:**
- Modify: `frontend/src/components/ProgressContent.tsx`
- Modify: `frontend/src/components/ProgressSummaryCards.tsx` (remove EXERCISE_CONFIGS export, keep ExerciseConfig type)

**Step 1: Update ProgressSummaryCards.tsx**

Remove the hardcoded `EXERCISE_CONFIGS` array (lines 13-18). Keep the `ExerciseConfig` interface export. The component already accepts exercises via `histories` map — no interface change needed.

**Step 2: Update ProgressContent.tsx**

Replace the multi-query approach with a single `useQuery(['progress'])`:

```tsx
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import styles from './ProgressContent.module.css'
import { TimeRangeSelector, type TimeRange } from './TimeRangeSelector'
import { ProgressSummaryCards } from './ProgressSummaryCards'
import type { ExerciseConfig } from './ProgressSummaryCards'
import { ExerciseLegend } from './ExerciseLegend'
import { getProgress } from '../api/progress'
import { LoadingSpinner } from './LoadingSpinner'
import { ProgressChart } from './ProgressChart'
import type { TrainingMax } from '../api/schemas'

const PALETTE = ['#2563eb', '#d97706', '#7c3aed', '#059669', '#dc2626', '#0891b2']

function getStoredRange(): TimeRange {
  const stored = localStorage.getItem('progressTimeRange')
  if (stored === '1m' || stored === '3m' || stored === '6m' || stored === 'all') return stored
  return '3m'
}

export function ProgressContent() {
  const [timeRange, setTimeRange] = useState<TimeRange>(getStoredRange)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [visibleExercises, setVisibleExercises] = useState<Set<string> | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: getProgress,
  })

  // Build exercise configs from API data
  const exerciseConfigs: ExerciseConfig[] = useMemo(() => {
    if (!data) return []
    return data.exercises.map((ex, i) => ({
      slug: ex.slug,
      name: ex.name,
      color: PALETTE[i % PALETTE.length],
    }))
  }, [data])

  // Build histories map from API data
  const histories = useMemo(() => {
    const map = new Map<string, TrainingMax[]>()
    if (!data) return map
    for (const ex of data.exercises) {
      // Convert progress history to TrainingMax shape for compatibility
      map.set(ex.slug, ex.history.map((h, i) => ({
        id: i,
        userId: 0,
        exercise: ex.slug,
        weight: h.weight,
        effectiveDate: h.effectiveDate,
        createdAt: h.effectiveDate,
      })))
    }
    return map
  }, [data])

  // Initialize selected/visible from loaded data
  const activeSelected = selectedExercise ?? exerciseConfigs[0]?.slug ?? null
  const activeVisible = visibleExercises ?? new Set(exerciseConfigs.map((e) => e.slug))

  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    localStorage.setItem('progressTimeRange', range)
    setAnnouncement(`Showing data for ${range === 'all' ? 'all time' : `last ${range.replace('m', ' months')}`}`)
  }

  const handleToggleExercise = (slug: string) => {
    const prev = activeVisible
    const next = new Set(prev)
    if (next.has(slug)) {
      if (next.size > 1) next.delete(slug)
    } else {
      next.add(slug)
    }
    const name = exerciseConfigs.find((e) => e.slug === slug)?.name ?? slug
    setAnnouncement(`${name} ${next.has(slug) ? 'shown on' : 'hidden from'} chart`)
    setVisibleExercises(next)
  }

  const handleSelectExercise = (slug: string) => {
    setSelectedExercise(slug)
    if (!activeVisible.has(slug)) {
      const next = new Set(activeVisible)
      next.add(slug)
      setVisibleExercises(next)
    }
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Progress</h1>
        <LoadingSpinner />
      </div>
    )
  }

  const hasTMs = data && data.exercises.some((ex) => ex.currentTM !== null)
  const hasProgression = Array.from(histories.values()).some((h) => h.length >= 2)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Progress</h1>
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {announcement}
      </div>
      <TimeRangeSelector value={timeRange} onChange={handleRangeChange} />

      {hasTMs ? (
        <>
          <ProgressSummaryCards
            exercises={exerciseConfigs}
            histories={histories}
            timeRange={timeRange}
            selectedExercise={activeSelected}
            onSelectExercise={handleSelectExercise}
          />
          {!hasProgression ? (
            <div className={styles.emptyMotivation}>
              <p className={styles.emptyMotivationTitle}>
                Complete your first workout to start tracking progress.
              </p>
              <p className={styles.emptyMotivationText}>
                Complete workouts to see your training maxes increase over time.
              </p>
            </div>
          ) : (
            <>
              <ExerciseLegend
                exercises={exerciseConfigs}
                visible={activeVisible}
                onToggle={handleToggleExercise}
              />
              {(() => {
                const config = exerciseConfigs.find((e) => e.slug === activeSelected)
                const exerciseHistory = histories.get(activeSelected ?? '') ?? []
                return config && activeVisible.has(config.slug) ? (
                  <ProgressChart
                    history={exerciseHistory}
                    color={config.color}
                    exerciseName={config.name}
                    timeRange={timeRange}
                  />
                ) : null
              })()}
            </>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No training data yet</p>
          <p className={styles.emptyText}>
            Set up your training maxes to start tracking progress.
          </p>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Update ProgressSummaryCards to accept exercises prop**

Change the component to receive `exercises` as a prop instead of importing `EXERCISE_CONFIGS`:

```tsx
interface Props {
  exercises: ExerciseConfig[]
  histories: Map<string, TrainingMax[]>
  timeRange: TimeRange
  selectedExercise: string | null
  onSelectExercise: (slug: string) => void
}
```

Use `exercises` prop instead of `EXERCISE_CONFIGS` in the map.

**Step 4: Verify typecheck passes**

Run: `cd frontend && npx tsc --build --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/components/ProgressContent.tsx frontend/src/components/ProgressSummaryCards.tsx
git commit -m "feat: use dynamic exercise list from progress endpoint"
```

---

### Task 4: Update Cache Docs and API Docs

**Files:**
- Modify: `docs/react-query-cache.md`
- Modify: `docs/api-endpoints.md`

**Step 1: Update react-query-cache.md**

Add new query key `['progress']` and update invalidation rules:
- `['progress']` replaces `['training-maxes', slug, 'history']` for ProgressPage
- Invalidate `['progress']` on: workout complete, TM setup, TM manual update, plan subscription

**Step 2: Update api-endpoints.md**

Add `GET /api/progress` endpoint documentation.

**Step 3: Commit**

```bash
git add docs/react-query-cache.md docs/api-endpoints.md
git commit -m "docs: add progress endpoint and update cache docs"
```

---

### Task 5: Update Invalidation Rules in Frontend

**Files:**
- Modify files that invalidate `['training-maxes', *, 'history']` to also invalidate `['progress']`

Search for all places that invalidate training-maxes history and add `['progress']` invalidation. Key files:
- `frontend/src/routes/_authenticated/_layout/workout.$dayNumber.tsx` (workout complete)
- `frontend/src/routes/_authenticated/_layout/settings.tsx` (TM manual update)
- `frontend/src/routes/_authenticated/setup.tsx` (TM setup)
- `frontend/src/routes/_authenticated/_layout/select-plan.tsx` (plan subscription)

**Step 1: Find and update all invalidation sites**

Search for `invalidateQueries.*training-maxes` in frontend code.

**Step 2: Add `queryClient.invalidateQueries({ queryKey: ['progress'] })` alongside existing invalidations**

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --build --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/routes/
git commit -m "feat: invalidate progress cache on TM changes"
```

---

### Task 6: Run Full Test Suite

**Step 1: Run backend tests**

Run: `cd backend && npx vitest run`
Expected: All pass

**Step 2: Run frontend typecheck**

Run: `cd frontend && npx tsc --build --noEmit`
Expected: No errors

**Step 3: Run E2E tests**

Run: `./run_test.sh`
Expected: All pass. The E2E progress tests check for exercise names and TM weights which should still work since the nSuns plan has the same 4 exercises.

**Step 4: Fix any failures**

If E2E tests fail, check `backend-test.log` for API errors. The existing progress E2E tests use hardcoded exercise names like "Bench", "Squat" etc. which should match since exercise names come from the DB now.
