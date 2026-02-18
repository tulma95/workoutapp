# Feature: Personal Record Detection

**Priority**: Medium-High
**Effort**: Medium (6-8 hours)
**Impact**: High motivation, celebration of progress

## Problem

Users don't know when they've hit a personal record during a workout. The app tracks all set data but doesn't compare against history. Recognizing PRs is one of the most motivating moments in strength training.

## Solution

Detect personal records in real-time during workouts and display a celebration banner. Track PRs at each rep range per exercise.

## What Counts as a PR

A PR is set when the user lifts **more weight at the same rep count** (or more) than ever before for that exercise.

Examples:
- Previous best at 3 reps: 95kg. User hits 97.5kg x 3 → PR!
- Previous best at 1 rep: 100kg. User hits 100kg x 2 → PR at 2 reps!
- User hits 95kg x 5 but previous best at 5 reps was 95kg x 5 → NOT a PR (same weight)

## User Experience

1. User enters AMRAP reps (e.g., 3 reps at 95kg on Squat)
2. App checks against all previous sets for that exercise at that weight or higher
3. If PR detected: Show animated banner "New PR! Squat: 95kg x 3"
4. Banner auto-dismisses after 3 seconds or on tap
5. Optional: confetti animation for big PRs

## Technical Design

### Backend

**New endpoint:**
```
GET /api/stats/personal-records?exercise=squat
```

Returns best weight at each rep count:
```json
{
  "exercise": "squat",
  "records": [
    { "reps": 1, "weight": 100, "date": "2026-02-01", "workoutId": "..." },
    { "reps": 3, "weight": 95, "date": "2026-01-28", "workoutId": "..." },
    { "reps": 5, "weight": 85, "date": "2026-01-21", "workoutId": "..." }
  ]
}
```

**Query:** For each rep count (1-10), find the maximum weight from workout_sets where `actual_reps >= reps` and `completed = true`.

### Frontend

**On workout start:** Fetch PRs for the day's exercises (2 API calls: T1 exercise + T2 parent exercise). Cache in memory.

**On set completion (AMRAP):** Compare `actualReps` at `prescribedWeight` against cached PRs. If new PR, show banner.

**Components:**
- `PRBanner` - Animated celebration banner
- Optional: lightweight confetti effect (CSS-only, no library needed)

```css
.pr-banner {
  position: fixed;
  top: 4rem;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #1a1a1a;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: bold;
  animation: slideDown 0.3s ease-out, fadeOut 0.3s ease-in 2.7s;
  z-index: 100;
}
```

### Database Query

```sql
SELECT
  actual_reps as reps,
  MAX(prescribed_weight) as weight
FROM workout_sets ws
JOIN workouts w ON ws.workout_id = w.id
WHERE w.user_id = $1
  AND ws.exercise = $2
  AND ws.completed = true
  AND ws.actual_reps IS NOT NULL
GROUP BY ws.actual_reps
ORDER BY ws.actual_reps;
```

## Edge Cases

- First workout ever: Every completed set is technically a PR. Don't show banners for first workout (no previous data to compare against).
- T2 exercises: Track PRs for T2 exercises too (Close Grip Bench, Sumo Deadlift, etc.)
- Weight tied but more reps: "New rep PR! 95kg x 4 (previous: 95kg x 3)" - this is a valid PR
- Multiple PRs in one workout: Show each one briefly

## Testing

- Backend: PR endpoint returns correct max weights per rep count
- E2E: Complete AMRAP with more than previous best, verify PR banner appears
- E2E: Complete set at or below previous best, verify no PR banner
