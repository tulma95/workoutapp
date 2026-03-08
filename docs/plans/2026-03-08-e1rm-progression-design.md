# e1RM Progression History — Design

## Problem

The current progress page shows Training Max history, which is plan-specific. When users switch programs (e.g. Starting Strength to 5/3/1), the progression line is not comparable. We need a universal strength metric.

## Solution

Replace TM-based progress chart with **estimated 1RM (Epley formula)** computed from actual completed sets. This is program-agnostic — the graph is continuous regardless of plan switches.

## Formula

```
e1RM = weight × (1 + reps / 30)
```

Per exercise per session: take MAX e1RM across all completed sets.

## Data Source

Computed at query time from existing `workout_sets` + `workouts` tables. No schema changes needed.

```sql
SELECT
  ws.exercise_id,
  w.completed_at::date AS date,
  MAX(ws.prescribed_weight * (1 + ws.actual_reps::numeric / 30)) AS best_e1rm
FROM workout_sets ws
JOIN workouts w ON w.id = ws.workout_id
WHERE w.user_id = $1
  AND w.status = 'completed'
  AND ws.completed = true
  AND ws.actual_reps IS NOT NULL
GROUP BY ws.exercise_id, w.completed_at::date
ORDER BY date
```

## API Changes

Modify existing `GET /api/progress` to return e1RM data instead of TM history.

### Response shape

```typescript
{
  exercises: [
    {
      slug: string
      name: string
      currentE1rm: number | null       // latest session's best e1RM
      history: [
        { e1rm: number, date: string } // one per session
      ]
      inCurrentPlan: boolean
    }
  ],
  planSwitches: [...]                  // unchanged
}
```

## Frontend Changes

- **ProgressContent**: consume new response shape, default filter to `inCurrentPlan: true`
- **ProgressChart**: same SVG chart, swap TM values for e1RM values
- **ProgressSummaryCards**: show current e1RM and gain instead of current TM
- **New toggle**: "Show all exercises" to reveal exercises not in current plan
- **Time range selector**: keep as-is (1M/3M/6M/All)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Replace vs separate view | Replace | e1RM is strictly better — TM is a programming tool, not a progress metric |
| Granularity | Per session | Rawest data, time range selector handles zoom |
| Warm-up filtering | Not needed | App only logs work sets |
| Compute vs store | Query time | Trivial arithmetic, small dataset per user, no schema changes |
| Default exercise filter | Current plan, toggle for all | Clean default, full history accessible |

## Edge Cases

- **1-rep sets**: e1RM = weight × 1.033 — valid, close to actual
- **No completed sets**: exercise omitted from response
- **Multiple sessions same day**: grouped, best e1RM wins
- **No active plan**: show all exercises

## What Gets Removed

- TM history from progress endpoint response
- `currentTM` field replaced by `currentE1rm`
- TM data remains accessible in settings and workout detail views
