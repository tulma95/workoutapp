# Rest Timer Design

## Overview

Auto-starting countdown timer on the workout page. When a set is completed, a sticky banner appears showing the countdown. Single configurable duration, adjustable on the fly with +30s/-30s buttons. Vibration alert when timer reaches zero.

Entirely client-side — no backend changes.

## Components

### `useRestTimer` hook

Owns all timer state and logic.

```typescript
interface RestTimerState {
  isRunning: boolean;
  secondsRemaining: number;
  totalSeconds: number;
}

interface UseRestTimer {
  state: RestTimerState;
  start: (seconds: number) => void;
  skip: () => void;
  adjust: (delta: number) => void;
}
```

- Uses `setInterval` (1s tick) with `useRef` for interval ID
- Handles `visibilitychange`: records timestamp when page hidden, calculates elapsed on return
- Calls `navigator.vibrate([200, 100, 200])` when countdown reaches 0
- Cleans up interval on unmount

### `RestTimerBanner` component

Sticky banner below page header, only rendered when timer is running.

- Displays countdown in `M:SS` format
- Progress bar showing remaining time visually
- Buttons: [-30s] [+30s] [Skip]
- Compact single row, subtle background color

### Settings section

Added to existing Settings page as a new card.

- Enabled/disabled toggle
- Duration picker: default 3:00, adjustable in 15s increments, range 0:30–10:00
- Stored in `localStorage` key `restTimerSettings`

```json
{
  "enabled": true,
  "durationSeconds": 180
}
```

## Trigger Rules

Timer starts when:
- Any set is marked complete (tap confirm or reps change on pending set)

Timer does NOT start when:
- Timer is disabled in settings
- The completed set is the last set of the workout
- Workout is in completed/error phase

If a set is completed while timer is already running, the timer restarts with fresh duration.

## Edge Cases

- **Page visibility**: `visibilitychange` event tracks elapsed time while backgrounded
- **Navigation away**: Timer destroyed on hook unmount (correct — no timer needed outside workout)
- **Vibration API unavailable**: Silently skip vibration (check `navigator.vibrate` exists)

## Testing (E2E)

- Complete a set → timer banner appears with countdown
- Tap Skip → timer disappears
- Tap +30s/-30s → countdown adjusts
- Complete last set → no timer starts
- Settings: toggle enabled/disabled, change duration
