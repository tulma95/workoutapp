# Dynamic Exercise List on Progress Page

## Problem

The Progress page hardcodes 4 exercises (Bench, Squat, OHP, Deadlift) in `EXERCISE_CONFIGS`. If a user subscribes to a plan with different exercises, the page won't adapt.

## Solution

New `GET /api/progress` endpoint that returns the active plan's exercises with current TMs and full history. Frontend builds exercise configs dynamically from this response.

## Backend

### New endpoint: `GET /api/progress`

- Auth required
- Finds user's active plan via `UserPlan.isActive`
- Extracts unique exercises from plan's `PlanDayExercise.tmExercise` references
- For each exercise: current TM + full history (DESC by effectiveDate)
- Exercises ordered by first appearance in plan days
- Returns `{ exercises: [] }` if no active plan or no TMs

### Response shape

```json
{
  "exercises": [
    {
      "slug": "bench-press",
      "name": "Bench Press",
      "currentTM": 80,
      "history": [
        { "weight": 80, "effectiveDate": "2026-02-19T00:00:00.000Z", "previousWeight": 77.5 },
        { "weight": 77.5, "effectiveDate": "2026-02-12T00:00:00.000Z", "previousWeight": null }
      ]
    }
  ]
}
```

## Frontend

### Changes

- Remove hardcoded `EXERCISE_CONFIGS` from `ProgressSummaryCards.tsx`
- New Zod schema `ProgressResponseSchema` in `schemas.ts`
- New `getProgress()` API function in a new `api/progress.ts` file
- `ProgressContent` uses single `useQuery(['progress'])` instead of 1 + N queries
- Dynamic color assignment from palette:
  ```ts
  const PALETTE = ['#2563eb', '#d97706', '#7c3aed', '#059669', '#dc2626', '#0891b2']
  ```
- Generalize nSuns-specific motivational text

### Unchanged

- `ExerciseLegend`, `ProgressChart`, `ProgressSummaryCards` component interfaces stay the same (they already accept `ExerciseConfig[]` as props)
- Time range filtering remains client-side
- Individual TM history endpoints remain available (used by other pages)
