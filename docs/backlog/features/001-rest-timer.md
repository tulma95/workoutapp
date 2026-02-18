# Feature: Rest Timer

**Priority**: High
**Effort**: Small-Medium
**Impact**: Core workout UX improvement

## Problem

Users have no way to time rest periods between sets. They either guess, use a separate timer app, or check the clock manually. This breaks workout flow and leads to inconsistent rest times.

## Solution

Auto-starting countdown timer that appears as a sticky banner on the workout page when a set is completed. Single configurable duration with on-the-fly adjustment. Vibration alert when done. Entirely client-side.

## User Experience

1. User completes a set (taps checkbox or enters reps)
2. Rest timer automatically starts counting down (sticky banner at top)
3. Banner shows countdown, progress bar, [-30s] [+30s] [Skip] buttons
4. When timer reaches 0: phone vibrates
5. User can tap "Skip" to dismiss early, or adjust with +30s/-30s
6. Timer does not start after the final set of the workout

## Settings (in Settings tab)

- Enabled/disabled toggle
- Duration picker: default 3:00, range 0:30–10:00, 15s increments
- Stored in localStorage

## Technical Notes

- No backend changes — purely client-side
- `useRestTimer` hook owns timer state in WorkoutPage
- `RestTimerBanner` component renders the sticky UI
- Handles `visibilitychange` for accurate timing when app is backgrounded
- `navigator.vibrate()` for alert (gracefully skipped if unavailable)

## Design Doc

See `docs/plans/2026-02-18-rest-timer-design.md`
