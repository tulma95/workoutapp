# Feature: Deload Week Detection & Suggestion

**Priority**: Medium
**Effort**: Low-Medium (4-6 hours)
**Impact**: Prevents overtraining, helps users manage fatigue

## Problem

In nSuns LP, users keep adding weight until they stall. When AMRAP reps consistently drop to 0-1, the program isn't progressing. Users often don't realize they need a deload until they've been grinding unproductive workouts for weeks.

## Solution

Track AMRAP performance trends and suggest a deload when the user is consistently failing to progress.

## Detection Logic

**Stall detection:** If the user has achieved 0-1 reps on the progression AMRAP for **3 consecutive workouts** on the same exercise, suggest a deload.

**Deload suggestion:** Reduce TM by 10% for the stalled exercise.

## User Experience

1. User completes workout, hits 1 rep on progression AMRAP (third time in a row)
2. After progression result shows "No TM increase", show a deload suggestion:
   ```
   ⚠️ Squat has stalled for 3 workouts.
   Consider a 10% deload: 120kg → 108kg
   [Apply Deload] [Dismiss]
   ```
3. "Apply Deload" updates TM via existing PATCH endpoint
4. "Dismiss" hides the suggestion (don't show again until next stall)

## Technical Design

### Backend

**New endpoint:**
```
GET /api/stats/stall-check?exercise=squat
```

Checks last 3 completed workouts for the exercise, returns AMRAP performance:
```json
{
  "exercise": "squat",
  "recentAmraps": [
    { "date": "2026-02-12", "prescribedReps": 1, "actualReps": 1 },
    { "date": "2026-02-05", "prescribedReps": 1, "actualReps": 0 },
    { "date": "2026-01-29", "prescribedReps": 1, "actualReps": 1 }
  ],
  "isStalled": true,
  "currentTM": 120,
  "suggestedTM": 108
}
```

### Frontend

- Check stall on workout completion (alongside progression result)
- Show deload banner below progression banner if stalled
- "Apply Deload" calls `PATCH /api/training-maxes/:exercise`

### No New DB Tables

All data already exists in workout_sets (AMRAP performance) and training_maxes (current TM).

## Edge Cases

- User manually adjusts TM between workouts: Reset stall counter
- User switches exercises mid-stall (e.g., skips Day 2 for weeks): Only count consecutive workouts per exercise
- Deload already applied: Don't suggest again until user builds back up and stalls again

## Testing

- Backend: Stall check returns correct data after 3 failed AMRAPs
- E2E: Complete 3 workouts with 0-1 AMRAP reps, verify deload suggestion appears
- E2E: Apply deload, verify TM updated
