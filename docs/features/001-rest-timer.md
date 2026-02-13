# Feature: Rest Timer

**Priority**: High
**Effort**: Medium (8-12 hours)
**Impact**: Core workout UX improvement

## Problem

Users have no way to time rest periods between sets. They either guess, use a separate timer app, or check the clock manually. This breaks workout flow and leads to inconsistent rest times, which affects performance.

## Solution

Auto-starting rest timer that begins when a set is marked complete. Shows a countdown overlay/banner that's always visible during the workout. Alerts the user when rest is over via vibration and sound.

## User Experience

1. User completes a set (taps checkbox or enters AMRAP reps)
2. Rest timer automatically starts counting down
3. Timer is visible as a persistent banner at the top of the workout page
4. When timer reaches 0: phone vibrates, optional sound plays
5. User can tap "Skip Rest" to dismiss early
6. User can tap "+30s" / "-30s" to adjust on the fly

## Default Rest Durations

| Context | Default Duration |
|---------|-----------------|
| T1 sets (main compound) | 3:00 |
| T1 AMRAP sets | 5:00 |
| T2 sets (accessory) | 2:00 |
| After final set of exercise | No timer |

Users can customize these defaults in Settings.

## Technical Design

### Frontend

**New components:**
- `RestTimer` - Persistent banner component shown during active workout
- Rest timer settings section in SettingsPage

**State management:**
- Timer state lives in WorkoutPage (or a `useRestTimer` hook)
- `startTimer(durationSeconds)` called when set is completed
- `clearTimer()` called when user skips or timer expires
- Timer persists across re-renders using `useRef` for the interval

**APIs used:**
- `navigator.vibrate([200, 100, 200])` - Vibration on timer end
- `Audio` API - Optional beep sound
- No backend changes needed - timer is purely client-side

### Hook: `useRestTimer`

```typescript
interface RestTimerState {
  isRunning: boolean;
  secondsRemaining: number;
  totalSeconds: number;
}

function useRestTimer(): {
  state: RestTimerState;
  start: (seconds: number) => void;
  skip: () => void;
  adjust: (delta: number) => void;
}
```

### Settings Storage

Rest timer preferences stored in `localStorage`:
```json
{
  "restTimer": {
    "enabled": true,
    "t1Duration": 180,
    "t1AmrapDuration": 300,
    "t2Duration": 120,
    "soundEnabled": true,
    "vibrationEnabled": true
  }
}
```

## UI Design

### Timer Banner (during countdown)
```
┌─────────────────────────────┐
│  Rest: 2:47    [-30s] [+30s] [Skip] │
└─────────────────────────────┘
```

- Fixed position below header, above set list
- Background color: subtle blue/gray
- Progress bar underneath showing time remaining visually
- Compact: single row, doesn't push content down significantly

### Settings Section
```
Rest Timer
  ☑ Enabled
  T1 Rest:       [3:00] (stepper)
  AMRAP Rest:    [5:00] (stepper)
  T2 Rest:       [2:00] (stepper)
  ☑ Vibration
  ☑ Sound
```

## Edge Cases

- Timer should pause if app goes to background (use `visibilitychange` event)
- If user completes next set before timer ends, restart timer with new duration
- Last set of workout: don't start timer
- Timer state should survive page re-renders but NOT page navigation

## Testing

- E2E: Start workout, complete a set, verify timer appears
- E2E: Verify timer disappears when skipped
- E2E: Verify timer auto-starts after AMRAP completion
- E2E: Verify rest timer settings save and apply
