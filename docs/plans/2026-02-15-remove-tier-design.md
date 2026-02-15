# Remove T1/T2 Tier System

## Problem

The `tier` column (`'T1'`/`'T2'`) on `plan_day_exercises` and `workout_sets` is a display label that carries no business logic. It hardcodes a two-exercise-per-day assumption and adds unnecessary complexity. Removing it makes the schema more generic and supports plans with any number of exercises per day.

## Design

### Database Changes

**`plan_day_exercises`**: Drop `tier` column. `sort_order` already provides exercise ordering within a day.

**`workout_sets`**:
- Drop `tier` column
- Add `exercise_order Int` — copied from `plan_day_exercises.sort_order` at workout generation time
- Replace index `@@index([workoutId, tier, setOrder])` with `@@index([workoutId, exerciseOrder, setOrder])`
- `set_order` becomes per-exercise (1-based within each exercise group), not global

**Migration**: Single migration that drops `tier` from both tables and adds `exercise_order` to `workout_sets`.

### Backend Changes

**`backend/prisma/schema.prisma`**:
- `PlanDayExercise`: remove `tier String`
- `WorkoutSet`: remove `tier String`, add `exerciseOrder Int @map("exercise_order")`
- Update index

**`backend/src/services/workout.service.ts`**:
- Set generation: copy `planDayExercise.sortOrder` into `exerciseOrder` instead of `tier`
- All `orderBy`: change `[{ tier: 'asc' }, { setOrder: 'asc' }]` to `[{ exerciseOrder: 'asc' }, { setOrder: 'asc' }]`

**`backend/src/routes/admin/plans.ts`**:
- Remove `tier` from Zod validation schemas for plan CRUD

**`backend/prisma/seed.ts`**:
- Remove `tier` from all `planDayExercise.create()` calls

### Frontend Changes

**`frontend/src/api/schemas.ts`**:
- `WorkoutSetSchema`: remove `tier`, add `exerciseOrder: z.number()`

**`frontend/src/api/plans.ts`** and **`frontend/src/api/adminPlans.ts`**:
- Remove `tier` from `PlanDayExercise` and `PlanDayExerciseInput` types

**`frontend/src/pages/WorkoutPage.tsx`**:
- Replace `t1Sets`/`t2Sets` filtering with grouping by `exerciseId`
- Group sets into exercise sections ordered by `exerciseOrder`
- Section headings show exercise name (from `set.exercise.name` or workout data)

**`frontend/src/components/WorkoutDetail.tsx`**:
- Same grouping logic as WorkoutPage
- Remove hardcoded `WORKOUT_DAYS` array — derive exercise names from set data

**`frontend/src/pages/DashboardPage.tsx`**:
- Replace `find(tier === 'T1')` / `find(tier === 'T2')` with listing all exercises from `day.exercises` ordered by `sortOrder`

**`frontend/src/components/WorkoutCard.tsx`**:
- Change props from `t1Exercise`/`t2Exercise` to `exercises: string[]`
- Render all exercise names

**`frontend/src/pages/PlanSelectionPage.tsx`**:
- Remove tier badge from exercise list

**`frontend/src/pages/admin/PlanEditorPage.tsx`**:
- Remove tier dropdown from exercise editor
- Remove `tier` from exercise state and API payloads

### What Does NOT Change

- Weight calculation: `round(TM * percentage)` — unaffected
- Progression logic: `isProgression` flag + exercise/category rules — unaffected
- TM updates: exercise-specific or upper/lower category matching — unaffected
- `plan_day_exercises.sort_order` — already exists and drives exercise ordering
- `plan_sets.set_order` — already per-exercise (1-based)

### Testing

- Update backend integration tests that assert on `tier` field in responses
- Update E2E tests that check for "T1:"/"T2:" text in UI
- Verify workout generation produces correct `exerciseOrder` values
- Verify frontend grouping displays exercises in correct order
