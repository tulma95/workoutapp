# Feature: Workout Progress Indicator

**Priority**: High
**Effort**: Low (2-3 hours)
**Impact**: Clear feedback during workout, sense of accomplishment

## Problem

During a workout with 17 sets (9 T1 + 8 T2), users have no quick way to see overall progress. They must scroll through the set list to gauge how far along they are. This is especially frustrating during long T1 compound sessions.

## Solution

A progress bar and set counter at the top of the workout page showing "X / 17 sets completed".

## User Experience

- Persistent bar at top of WorkoutPage (below header, above sets)
- Shows: progress bar + "8 / 17 sets" text
- Bar fills as sets are completed
- Color transitions: gray → blue (in progress) → green (all done)
- Subtle animation when a set is completed (bar fill + count increment)

## UI Design

```
┌─────────────────────────────────┐
│ Day 1 - Bench Volume + OHP       │
│ ████████████░░░░░░░░░ 8/17 sets │
│ ─────────────────────────────── │
│                                   │
│ T1: Bench Press                   │
│ ...sets...                        │
```

## Technical Design

### Frontend Only

No backend changes. Derive from existing workout set data.

**Calculation:**
```typescript
const completedSets = workout.sets.filter(s => s.completed).length;
const totalSets = workout.sets.length;
const percentage = (completedSets / totalSets) * 100;
```

**Component:** Add to existing WorkoutPage, not a separate component. Just a `<div>` with a CSS progress bar.

```css
.workout-progress-bar {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}
.workout-progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}
```

## Testing

- E2E: Progress shows 0/17 at workout start
- E2E: Progress updates when set completed
- E2E: Shows 17/17 when all sets done
