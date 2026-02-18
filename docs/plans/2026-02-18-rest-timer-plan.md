# Rest Timer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an auto-starting rest timer banner to the workout page with configurable duration in settings.

**Architecture:** Client-side only. A `useRestTimer` custom hook manages countdown state in the `ActiveWorkout` component. A `RestTimerBanner` component renders the sticky UI. Settings stored in localStorage, configured via the existing Settings page.

**Tech Stack:** React hooks, CSS Modules, localStorage, Vibration API, Playwright E2E tests.

---

### Task 1: `useRestTimer` hook

**Files:**
- Create: `frontend/src/hooks/useRestTimer.ts`

**Step 1: Create the hook**

```typescript
import { useState, useRef, useEffect, useCallback } from 'react'

interface RestTimerState {
  isRunning: boolean
  secondsRemaining: number
  totalSeconds: number
}

const IDLE: RestTimerState = { isRunning: false, secondsRemaining: 0, totalSeconds: 0 }

export function useRestTimer() {
  const [state, setState] = useState<RestTimerState>(IDLE)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hiddenAtRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState(IDLE)
  }, [])

  const start = useCallback((seconds: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    setState({ isRunning: true, secondsRemaining: seconds, totalSeconds: seconds })
    intervalRef.current = setInterval(() => {
      setState(prev => {
        if (prev.secondsRemaining <= 1) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200])
          }
          return IDLE
        }
        return { ...prev, secondsRemaining: prev.secondsRemaining - 1 }
      })
    }, 1000)
  }, [])

  const skip = useCallback(() => {
    clearTimer()
  }, [clearTimer])

  const adjust = useCallback((delta: number) => {
    setState(prev => {
      if (!prev.isRunning) return prev
      const next = Math.max(1, prev.secondsRemaining + delta)
      return { ...prev, secondsRemaining: next, totalSeconds: Math.max(prev.totalSeconds, next) }
    })
  }, [])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else if (hiddenAtRef.current !== null) {
        const elapsed = Math.floor((Date.now() - hiddenAtRef.current) / 1000)
        hiddenAtRef.current = null
        setState(prev => {
          if (!prev.isRunning) return prev
          const remaining = prev.secondsRemaining - elapsed
          if (remaining <= 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200])
            }
            return IDLE
          }
          return { ...prev, secondsRemaining: remaining }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { state, start, skip, adjust }
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useRestTimer.ts
git commit -m "feat: add useRestTimer hook for countdown timer logic"
```

---

### Task 2: `RestTimerBanner` component + CSS

**Files:**
- Create: `frontend/src/components/RestTimerBanner.tsx`
- Create: `frontend/src/components/RestTimerBanner.module.css`

**Step 1: Create the component**

```tsx
import styles from './RestTimerBanner.module.css'

type Props = {
  secondsRemaining: number
  totalSeconds: number
  onAdjust: (delta: number) => void
  onSkip: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RestTimerBanner({ secondsRemaining, totalSeconds, onAdjust, onSkip }: Props) {
  const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 0

  return (
    <div className={styles.banner} data-testid="rest-timer">
      <div className={styles.content}>
        <span className={styles.time}>{formatTime(secondsRemaining)}</span>
        <div className={styles.controls}>
          <button className={styles.adjustBtn} onClick={() => onAdjust(-30)} aria-label="Decrease rest by 30 seconds">
            -30s
          </button>
          <button className={styles.adjustBtn} onClick={() => onAdjust(30)} aria-label="Increase rest by 30 seconds">
            +30s
          </button>
          <button className={styles.skipBtn} onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
```

**Step 2: Create the CSS module**

```css
.banner {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: var(--bg-card);
  border-bottom: 1px solid var(--border);
  margin: 0 calc(-1 * var(--space-md));
  margin-bottom: var(--space-md);
}

.content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
}

.time {
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.controls {
  display: flex;
  gap: var(--space-xs);
}

.adjustBtn,
.skipBtn {
  min-height: 2.75rem;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--space-sm);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  background-color: var(--bg);
  color: var(--text);
  transition: background-color 0.2s;
}

.adjustBtn:active,
.skipBtn:active {
  background-color: var(--border);
}

.skipBtn {
  background-color: transparent;
  border-color: var(--danger);
  color: var(--danger);
}

.progressTrack {
  height: 3px;
  background-color: var(--border);
}

.progressBar {
  height: 100%;
  background-color: var(--primary);
  transition: width 1s linear;
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/RestTimerBanner.tsx frontend/src/components/RestTimerBanner.module.css
git commit -m "feat: add RestTimerBanner component with countdown display and controls"
```

---

### Task 3: localStorage settings helpers

**Files:**
- Create: `frontend/src/utils/restTimerSettings.ts`

**Step 1: Create settings utility**

```typescript
export interface RestTimerSettings {
  enabled: boolean
  durationSeconds: number
}

const STORAGE_KEY = 'restTimerSettings'
const DEFAULTS: RestTimerSettings = { enabled: true, durationSeconds: 180 }

export function getRestTimerSettings(): RestTimerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      durationSeconds: typeof parsed.durationSeconds === 'number' && parsed.durationSeconds >= 30 && parsed.durationSeconds <= 600
        ? parsed.durationSeconds
        : DEFAULTS.durationSeconds,
    }
  } catch {
    return DEFAULTS
  }
}

export function saveRestTimerSettings(settings: RestTimerSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
```

**Step 2: Commit**

```bash
git add frontend/src/utils/restTimerSettings.ts
git commit -m "feat: add rest timer localStorage settings helpers"
```

---

### Task 4: Wire timer into ActiveWorkout + ActiveWorkoutView

**Files:**
- Modify: `frontend/src/routes/_authenticated/_layout/workout.$dayNumber.tsx` (ActiveWorkout function, ~line 281)
- Modify: `frontend/src/components/ActiveWorkoutView.tsx`

**Step 1: Update ActiveWorkout to use the hook and trigger timer on set completion**

In `workout.$dayNumber.tsx`, add imports at top:

```typescript
import { useRestTimer } from '../../../hooks/useRestTimer'
import { getRestTimerSettings } from '../../../utils/restTimerSettings'
```

In the `ActiveWorkout` component, add after the `debounceMap` ref (line ~296):

```typescript
const restTimer = useRestTimer()
const settingsRef = useRef(getRestTimerSettings())
```

Create a helper to trigger the timer (add after `debouncedLogSet`):

```typescript
const triggerRestTimer = (setId: number) => {
  const settings = settingsRef.current
  if (!settings.enabled) return
  // Don't start timer if this is the last set
  const setIndex = workout.sets.findIndex(s => s.id === setId)
  if (setIndex === workout.sets.length - 1) return
  restTimer.start(settings.durationSeconds)
}
```

In `handleConfirmSet`, add `triggerRestTimer(setId)` after `debouncedLogSet`.

In `handleRepsChange`, add `triggerRestTimer(setId)` after `debouncedLogSet` — but only when the set was previously pending (not already completed). Check: if `!workout.sets.find(s => s.id === setId)?.completed`.

Pass `restTimer` to `ActiveWorkoutView`:

```tsx
<ActiveWorkoutView
  {...existingProps}
  restTimer={restTimer.state.isRunning ? {
    secondsRemaining: restTimer.state.secondsRemaining,
    totalSeconds: restTimer.state.totalSeconds,
    onAdjust: restTimer.adjust,
    onSkip: restTimer.skip,
  } : null}
/>
```

**Step 2: Update ActiveWorkoutView to render the banner**

In `ActiveWorkoutView.tsx`, add import:

```typescript
import { RestTimerBanner } from './RestTimerBanner'
```

Add `restTimer` to the Props type:

```typescript
restTimer: {
  secondsRemaining: number
  totalSeconds: number
  onAdjust: (delta: number) => void
  onSkip: () => void
} | null
```

Render the banner inside the `.page` div, after the `<h1>` and before the exercise groups:

```tsx
{restTimer && (
  <RestTimerBanner
    secondsRemaining={restTimer.secondsRemaining}
    totalSeconds={restTimer.totalSeconds}
    onAdjust={restTimer.onAdjust}
    onSkip={restTimer.onSkip}
  />
)}
```

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --build --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/routes/_authenticated/_layout/workout.\$dayNumber.tsx frontend/src/components/ActiveWorkoutView.tsx
git commit -m "feat: wire rest timer into workout page, auto-starts on set completion"
```

---

### Task 5: Rest Timer settings UI in Settings page

**Files:**
- Modify: `frontend/src/components/SettingsContent.tsx`
- Modify: `frontend/src/routes/_authenticated/_layout/settings.tsx`
- Modify: `frontend/src/styles/SettingsPage.module.css`

**Step 1: Add rest timer settings state to the settings route**

In `settings.tsx`, import helpers:

```typescript
import { getRestTimerSettings, saveRestTimerSettings, type RestTimerSettings } from '../../../utils/restTimerSettings'
```

Add state in the settings component:

```typescript
const [restTimerSettings, setRestTimerSettings] = useState<RestTimerSettings>(getRestTimerSettings)
```

Add handler:

```typescript
const handleRestTimerChange = (updates: Partial<RestTimerSettings>) => {
  setRestTimerSettings(prev => {
    const next = { ...prev, ...updates }
    saveRestTimerSettings(next)
    return next
  })
}
```

Pass `restTimerSettings` and `onRestTimerChange={handleRestTimerChange}` to `SettingsContent`.

**Step 2: Add rest timer settings card to SettingsContent**

Add to Props:

```typescript
restTimerSettings: RestTimerSettings
onRestTimerChange: (updates: Partial<RestTimerSettings>) => void
```

Add a new card section after the Training Maxes section and before the Logout button:

```tsx
<section className={styles.card}>
  <h3 className={styles.cardLabel}>Rest Timer</h3>

  <div className={styles.settingRow}>
    <label htmlFor="rest-timer-enabled">Enabled</label>
    <input
      id="rest-timer-enabled"
      type="checkbox"
      checked={restTimerSettings.enabled}
      onChange={(e) => onRestTimerChange({ enabled: e.target.checked })}
    />
  </div>

  <div className={styles.settingRow}>
    <label htmlFor="rest-timer-duration">Duration</label>
    <div className={styles.durationPicker}>
      <button
        onClick={() => onRestTimerChange({ durationSeconds: Math.max(30, restTimerSettings.durationSeconds - 15) })}
        disabled={restTimerSettings.durationSeconds <= 30}
        aria-label="Decrease rest duration"
      >
        -
      </button>
      <span id="rest-timer-duration" className={styles.durationValue}>
        {Math.floor(restTimerSettings.durationSeconds / 60)}:{(restTimerSettings.durationSeconds % 60).toString().padStart(2, '0')}
      </span>
      <button
        onClick={() => onRestTimerChange({ durationSeconds: Math.min(600, restTimerSettings.durationSeconds + 15) })}
        disabled={restTimerSettings.durationSeconds >= 600}
        aria-label="Increase rest duration"
      >
        +
      </button>
    </div>
  </div>
</section>
```

**Step 3: Add CSS for the settings rows**

Add to `SettingsPage.module.css`:

```css
.settingRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) 0;
}

.settingRow label {
  font-weight: 500;
  font-size: 1rem;
}

.settingRow input[type="checkbox"] {
  width: 1.25rem;
  height: 1.25rem;
  min-height: auto;
  accent-color: var(--primary);
}

.durationPicker {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.durationPicker button {
  min-height: 2.75rem;
  min-width: 2.75rem;
  border: 1px solid var(--border);
  border-radius: var(--space-sm);
  background-color: var(--bg);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
}

.durationPicker button:active {
  background-color: var(--border);
}

.durationPicker button:disabled {
  opacity: 0.4;
  cursor: default;
}

.durationValue {
  min-width: 3rem;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
```

**Step 4: Typecheck**

```bash
cd frontend && npx tsc --build --noEmit
```

**Step 5: Commit**

```bash
git add frontend/src/components/SettingsContent.tsx frontend/src/routes/_authenticated/_layout/settings.tsx frontend/src/styles/SettingsPage.module.css
git commit -m "feat: add rest timer settings section to settings page"
```

---

### Task 6: E2E tests

**Files:**
- Create: `e2e/rest-timer.spec.ts`
- Modify: `e2e/pages/workout.page.ts` (add timer helpers)

**Step 1: Add timer helpers to WorkoutPage page object**

In `e2e/pages/workout.page.ts`, add locators to constructor:

```typescript
readonly restTimerBanner;
readonly restTimerTime;
readonly skipRestButton;
readonly increaseRestButton;
readonly decreaseRestButton;
```

Initialize in constructor:

```typescript
this.restTimerBanner = page.getByTestId('rest-timer');
this.restTimerTime = page.getByTestId('rest-timer').locator('span').first();
this.skipRestButton = page.getByRole('button', { name: /skip/i });
this.increaseRestButton = page.getByRole('button', { name: /increase rest/i });
this.decreaseRestButton = page.getByRole('button', { name: /decrease rest/i });
```

**Step 2: Create rest-timer.spec.ts**

```typescript
import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';

test.describe('Rest Timer', () => {
  test('completing a set shows the rest timer banner', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Complete a set
    await workout.confirmSet(0);

    // Timer banner should appear
    await expect(workout.restTimerBanner).toBeVisible();
  });

  test('tapping Skip dismisses the rest timer', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await workout.confirmSet(0);
    await expect(workout.restTimerBanner).toBeVisible();

    await workout.skipRestButton.click();
    await expect(workout.restTimerBanner).not.toBeVisible();
  });

  test('+30s and -30s buttons adjust the timer', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await workout.confirmSet(0);
    await expect(workout.restTimerBanner).toBeVisible();

    // Read initial time text
    const initialText = await workout.restTimerBanner.locator('span').first().textContent();

    // Tap +30s
    await workout.increaseRestButton.click();
    const afterIncrease = await workout.restTimerBanner.locator('span').first().textContent();
    expect(afterIncrease).not.toBe(initialText);

    // Tap -30s
    await workout.decreaseRestButton.click();
    // Timer should still be visible
    await expect(workout.restTimerBanner).toBeVisible();
  });

  test('completing the last set does not start the timer', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Complete all sets
    const setRows = page.locator('[data-testid="set-row"]');
    const count = await setRows.count();

    for (let i = 0; i < count; i++) {
      // Skip rest timer if it appears (from previous set completion)
      if (await workout.restTimerBanner.isVisible()) {
        await workout.skipRestButton.click();
      }
      await workout.confirmSet(i);
    }

    // After last set, timer should NOT appear
    // Wait a beat to make sure it doesn't appear
    await page.waitForTimeout(200);
    await expect(workout.restTimerBanner).not.toBeVisible();
  });

  test('disabling rest timer in settings prevents timer from appearing', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    // Disable rest timer via settings page
    await page.getByRole('link', { name: /settings/i }).click();
    const checkbox = page.locator('#rest-timer-enabled');
    await expect(checkbox).toBeVisible();
    await checkbox.uncheck();

    // Go back and start workout
    await page.getByRole('link', { name: /dashboard/i }).first().click();
    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await workout.confirmSet(0);

    // Timer should NOT appear
    await page.waitForTimeout(200);
    await expect(workout.restTimerBanner).not.toBeVisible();
  });
});
```

**Step 3: Run the E2E tests**

```bash
npm test
```

Expected: All rest timer tests pass.

**Step 4: Commit**

```bash
git add e2e/rest-timer.spec.ts e2e/pages/workout.page.ts
git commit -m "test: add E2E tests for rest timer feature"
```

---

### Task 7: Mark ticket as in-progress, verify full test suite, final commit

**Step 1: Mark ticket**

```bash
node --experimental-strip-types docs/backlog/ticket.ts status 001 in-progress
```

**Step 2: Run full test suite**

```bash
npm test
```

**Step 3: Typecheck both projects**

```bash
npm run build -w backend
cd frontend && npx tsc --build --noEmit
```

**Step 4: Mark ticket as done**

```bash
node --experimental-strip-types docs/backlog/ticket.ts status 001 done
```
