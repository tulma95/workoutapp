# Editable Set Reps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace binary checkbox with tap-to-confirm + editable reps for all workout sets, preserving AMRAP stepper-first UX.

**Architecture:** Rename AmrapInput to RepsInput with an `isAmrap` prop that controls max cap. SetRow gets three states: pending (Confirm button), confirmed (stepper + undo), edited (amber stepper). Backend gets nullable actualReps support. Debounce PATCH calls per set.

**Tech Stack:** React, TypeScript, CSS, Express/Zod, Playwright

---

### Task 1: Backend — Allow nullable actualReps in logSet

**Files:**
- Modify: `backend/src/routes/workouts.ts:78-81`
- Modify: `backend/src/services/workout.service.ts:285-287`
- Test: `backend/src/__tests__/workoutCompletion-plan-driven.test.ts`

**Step 1: Write a failing test for resetting actualReps to null**

Add to `backend/src/__tests__/workoutCompletion-plan-driven.test.ts` (or a new test file `backend/src/__tests__/logSet.test.ts`):

```typescript
it('should reset actualReps to null when sent null', async () => {
  // First set actualReps to a number
  await request(app)
    .patch(`/api/workouts/${workoutId}/sets/${setId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ actualReps: 5, completed: true })
    .expect(200);

  // Then reset to null
  const res = await request(app)
    .patch(`/api/workouts/${workoutId}/sets/${setId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ actualReps: null, completed: false })
    .expect(200);

  expect(res.body.actualReps).toBeNull();
  expect(res.body.completed).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/logSet.test.ts`
Expected: FAIL — Zod rejects `null` for actualReps (400 status)

**Step 3: Fix Zod schema and service**

In `backend/src/routes/workouts.ts:78-81`, change:

```typescript
const logSetSchema = z.object({
  actualReps: z.number().int().min(0).nullable().optional(),
  completed: z.boolean().optional(),
});
```

In `backend/src/services/workout.service.ts:285-287`, change:

```typescript
const updateData: { actualReps?: number | null; completed?: boolean } = {};
if (data.actualReps !== undefined) updateData.actualReps = data.actualReps;
if (data.completed !== undefined) updateData.completed = data.completed;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/logSet.test.ts`
Expected: PASS

**Step 5: Run full backend test suite**

Run: `cd backend && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/src/routes/workouts.ts backend/src/services/workout.service.ts backend/src/__tests__/logSet.test.ts
git commit -m "fix: allow nullable actualReps in logSet endpoint"
```

---

### Task 2: Rename AmrapInput to RepsInput with isAmrap cap

**Files:**
- Rename: `frontend/src/components/AmrapInput.tsx` → `frontend/src/components/RepsInput.tsx`
- Rename: `frontend/src/components/AmrapInput.css` → `frontend/src/components/RepsInput.css`
- Modify: `frontend/src/components/SetRow.tsx` (update import)

**Step 1: Create RepsInput.tsx (copy + modify AmrapInput)**

Create `frontend/src/components/RepsInput.tsx`:

```tsx
import './RepsInput.css';

interface RepsInputProps {
  value: number | null;
  targetReps: number;
  isAmrap: boolean;
  onChange: (value: number) => void;
}

export default function RepsInput({ value, targetReps, isAmrap, onChange }: RepsInputProps) {
  function handleDecrement() {
    if (value === null) {
      onChange(0);
    } else if (value > 0) {
      onChange(value - 1);
    }
  }

  function handleIncrement() {
    if (value === null) {
      onChange(targetReps);
    } else if (isAmrap || value < targetReps) {
      onChange(value + 1);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue) && newValue >= 0) {
      if (!isAmrap && newValue > targetReps) {
        onChange(targetReps);
      } else {
        onChange(newValue);
      }
    } else if (e.target.value === '') {
      onChange(0);
    }
  }

  const canIncrement = isAmrap || (value ?? 0) < targetReps;

  return (
    <div className="reps-input">
      <button
        type="button"
        className="reps-input__button"
        onClick={handleDecrement}
        disabled={value !== null && value <= 0}
        aria-label="Decrease reps"
      >
        −
      </button>

      <input
        type="number"
        className="reps-input__field"
        value={value ?? ''}
        onChange={handleInputChange}
        placeholder={targetReps.toString()}
        min="0"
        max={isAmrap ? undefined : targetReps}
        aria-label="Reps completed"
      />

      <button
        type="button"
        className="reps-input__button"
        onClick={handleIncrement}
        disabled={!canIncrement}
        aria-label="Increase reps"
      >
        +
      </button>
    </div>
  );
}
```

**Step 2: Create RepsInput.css (copy AmrapInput.css with renamed classes)**

Create `frontend/src/components/RepsInput.css` — same as `AmrapInput.css` but replace all `.amrap-input` with `.reps-input`.

**Step 3: Delete old AmrapInput files**

Delete `frontend/src/components/AmrapInput.tsx` and `frontend/src/components/AmrapInput.css`.

**Step 4: Update SetRow.tsx import**

In `frontend/src/components/SetRow.tsx:1`, change:

```typescript
import RepsInput from './RepsInput';
```

Pass `isAmrap` to RepsInput:

```tsx
<RepsInput
  value={actualReps}
  targetReps={reps}
  isAmrap={isAmrap}
  onChange={onAmrapRepsChange}
/>
```

**Step 5: Update any other imports of AmrapInput**

Check `frontend/src/components/WorkoutDetail.tsx` — it doesn't import AmrapInput so no change needed.

**Step 6: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add frontend/src/components/RepsInput.tsx frontend/src/components/RepsInput.css frontend/src/components/SetRow.tsx
git rm frontend/src/components/AmrapInput.tsx frontend/src/components/AmrapInput.css
git commit -m "refactor: rename AmrapInput to RepsInput with isAmrap cap"
```

---

### Task 3: Redesign SetRow — Confirm button + stepper + undo

**Files:**
- Modify: `frontend/src/components/SetRow.tsx`
- Modify: `frontend/src/components/SetRow.css`

**Step 1: Update SetRow props and component**

Replace `frontend/src/components/SetRow.tsx` entirely:

```tsx
import RepsInput from './RepsInput';
import type { UnitPreference } from '../types';
import { formatWeight } from '../utils/weight';
import './SetRow.css';

interface SetRowProps {
  setNumber: number;
  weight: number;
  reps: number;
  isAmrap: boolean;
  completed: boolean;
  actualReps: number | null;
  unit: UnitPreference;
  onConfirm: () => void;
  onRepsChange: (reps: number) => void;
  onUndo: () => void;
}

export default function SetRow({
  setNumber,
  weight,
  reps,
  isAmrap,
  completed,
  actualReps,
  unit,
  onConfirm,
  onRepsChange,
  onUndo,
}: SetRowProps) {
  const isEdited = completed && actualReps !== null && actualReps < reps;
  const stateClass = completed
    ? isEdited
      ? 'set-row--edited'
      : 'set-row--completed'
    : '';

  return (
    <div className={`set-row ${stateClass}`}>
      <div className="set-row__info">
        <span className="set-row__number">{setNumber}</span>
        <span className="set-row__weight">{formatWeight(weight, unit)}</span>
        <span className="set-row__reps">
          x{reps}
          {isAmrap ? '+' : ''}
        </span>
      </div>

      <div className="set-row__action">
        {isAmrap || completed ? (
          <>
            <RepsInput
              value={actualReps}
              targetReps={reps}
              isAmrap={isAmrap}
              onChange={onRepsChange}
            />
            {completed && (
              <button
                type="button"
                className="set-row__undo"
                onClick={onUndo}
                aria-label={`Undo set ${setNumber}`}
              >
                ✓
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="set-row__confirm"
            onClick={onConfirm}
          >
            Confirm
          </button>
        )}
      </div>

      {isEdited && (
        <span className="set-row__target-hint">target: {reps}</span>
      )}
    </div>
  );
}
```

**Step 2: Update SetRow.css**

Add new styles to `frontend/src/components/SetRow.css`:

```css
.set-row--edited {
  background-color: rgba(251, 146, 60, 0.1);
}

.set-row__confirm {
  min-width: 5rem;
  min-height: 3rem;
  padding: var(--space-xs) var(--space-md);
  font-size: 0.875rem;
  font-weight: 600;
  background-color: var(--primary);
  color: white;
  border: none;
  border-radius: var(--space-xs);
  cursor: pointer;
}

.set-row__confirm:active {
  opacity: 0.8;
}

.set-row__undo {
  min-width: 2.5rem;
  min-height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--success);
  background: transparent;
  border: 1px solid var(--success);
  border-radius: var(--space-xs);
  cursor: pointer;
  margin-left: var(--space-xs);
  padding: 0;
  flex-shrink: 0;
}

.set-row__undo:active {
  opacity: 0.7;
}

.set-row__target-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: auto;
  padding-right: var(--space-md);
}
```

Remove the `.set-row__checkbox` class (no longer used).

**Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: Will FAIL because WorkoutPage still passes old props (onComplete, onAmrapRepsChange). That's expected — we fix it in Task 4.

**Step 4: Commit**

```bash
git add frontend/src/components/SetRow.tsx frontend/src/components/SetRow.css
git commit -m "feat: redesign SetRow with confirm button, stepper, and undo"
```

---

### Task 4: Update WorkoutPage handlers and add debounce

**Files:**
- Modify: `frontend/src/routes/_authenticated/_layout/workout.$dayNumber.tsx`
- Modify: `frontend/src/api/workouts.ts` (update logSet signature for null)

**Step 1: Update logSet API function signature**

In `frontend/src/api/workouts.ts:36-46`, change the `data` parameter type:

```typescript
export async function logSet(
  workoutId: number,
  setId: number,
  data: { actualReps?: number | null; completed?: boolean }
): Promise<typeof WorkoutSetSchema._output> {
```

**Step 2: Update WorkoutPage with new handlers and debounce**

Replace the handler section in `frontend/src/routes/_authenticated/_layout/workout.$dayNumber.tsx`.

Remove `handleSetComplete` and `handleAmrapRepsChange`. Add:

```typescript
// Debounce map: setId -> timeout
const debounceMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

const debouncedLogSet = (workoutId: number, setId: number, data: { actualReps?: number | null; completed?: boolean }) => {
  const existing = debounceMap.current.get(setId);
  if (existing) clearTimeout(existing);
  const timeout = setTimeout(async () => {
    debounceMap.current.delete(setId);
    try {
      await logSet(workoutId, setId, data);
    } catch (err) {
      console.error('Failed to update set:', err);
    }
  }, 300);
  debounceMap.current.set(setId, timeout);
};

// Clean up debounce timers on unmount
useEffect(() => {
  return () => {
    debounceMap.current.forEach((timeout) => clearTimeout(timeout));
  };
}, []);

const handleConfirmSet = (setId: number) => {
  if (!workout) return;
  const set = workout.sets.find((s) => s.id === setId);
  if (!set) return;

  setWorkout({
    ...workout,
    sets: workout.sets.map((s) =>
      s.id === setId ? { ...s, actualReps: s.prescribedReps, completed: true } : s
    ),
  });

  debouncedLogSet(workout.id, setId, { actualReps: set.prescribedReps, completed: true });
};

const handleRepsChange = (setId: number, reps: number) => {
  if (!workout) return;

  setWorkout({
    ...workout,
    sets: workout.sets.map((s) =>
      s.id === setId ? { ...s, actualReps: reps, completed: true } : s
    ),
  });

  debouncedLogSet(workout.id, setId, { actualReps: reps, completed: true });
};

const handleUndoSet = (setId: number) => {
  if (!workout) return;

  setWorkout({
    ...workout,
    sets: workout.sets.map((s) =>
      s.id === setId ? { ...s, actualReps: null, completed: false } : s
    ),
  });

  debouncedLogSet(workout.id, setId, { actualReps: null, completed: false });
};
```

**Step 3: Update SetRow usage in JSX**

In the render section, change the SetRow props:

```tsx
<SetRow
  key={set.id}
  setNumber={index + 1}
  weight={set.prescribedWeight}
  reps={set.prescribedReps}
  isAmrap={set.isAmrap}
  completed={set.completed}
  actualReps={set.actualReps}
  unit={unit}
  onConfirm={() => handleConfirmSet(set.id)}
  onRepsChange={(reps) => handleRepsChange(set.id, reps)}
  onUndo={() => handleUndoSet(set.id)}
/>
```

**Step 4: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/routes/_authenticated/_layout/workout.\$dayNumber.tsx frontend/src/api/workouts.ts
git commit -m "feat: add confirm/reps/undo handlers with debounced PATCH calls"
```

---

### Task 5: Update WorkoutDetail for backward compatibility

**Files:**
- Modify: `frontend/src/components/WorkoutDetail.tsx`

**Step 1: Update history display logic**

In `frontend/src/components/WorkoutDetail.tsx:67-85`, the set row rendering should handle both old data (completed=true, actualReps=null) and new data (actualReps=number):

```tsx
<div key={set.id} className="workout-detail__set-row">
  <span className="workout-detail__set-number">Set {index + 1}</span>
  <span className="workout-detail__set-weight">
    {formatWeight(set.prescribedWeight, unit)}
  </span>
  <span className="workout-detail__set-reps">
    {set.prescribedReps}
    {set.isAmrap ? '+' : ''} reps
  </span>
  {set.actualReps !== null && set.actualReps !== set.prescribedReps && (
    <span className="workout-detail__set-actual">
      ({set.actualReps} done)
    </span>
  )}
  {(set.completed || set.actualReps !== null) && (
    <span className="workout-detail__set-completed" aria-label="completed">
      ✓
    </span>
  )}
</div>
```

Key changes:
- Only show "(X done)" when actualReps differs from prescribedReps (avoids redundant display)
- Show checkmark when either completed=true (old data) OR actualReps is set (new data)

**Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/WorkoutDetail.tsx
git commit -m "fix: update WorkoutDetail for backward-compatible actualReps display"
```

---

### Task 6: Update E2E tests and page object

**Files:**
- Modify: `e2e/pages/workout.page.ts`
- Modify: `e2e/workout.spec.ts`

**Step 1: Update WorkoutPage page object**

The page object needs new selectors and methods for the confirm-based UX:

```typescript
import { expect, type Page } from '@playwright/test';

export class WorkoutPage {
  readonly page: Page;

  readonly confirmButtons;
  readonly amrapInputs;
  readonly repsInputs;
  readonly undoButtons;
  readonly completeButton;
  readonly cancelButton;
  readonly backToDashboardButton;
  readonly confirmDialog;
  readonly progressionBanner;

  constructor(page: Page) {
    this.page = page;
    this.confirmButtons = page.getByRole('button', { name: /^confirm$/i });
    this.amrapInputs = page.locator('.set-row .reps-input input[type="number"]');
    this.repsInputs = page.getByRole('spinbutton', { name: /reps completed/i });
    this.undoButtons = page.locator('.set-row__undo');
    this.completeButton = page.getByRole('button', { name: /complete workout/i });
    this.cancelButton = page.getByRole('button', { name: /cancel workout/i });
    this.backToDashboardButton = page.getByRole('button', { name: /back to dashboard|dashboard/i });
    this.confirmDialog = page.locator('.confirm-dialog__content');
    this.progressionBanner = page.getByText(/progression|increase|bench.*\+/i);
  }

  // Keep old name for backward compat in tests
  get checkboxes() {
    return this.confirmButtons;
  }

  dayHeading(dayNumber: number) {
    return this.page.getByRole('heading', { name: new RegExp(`day ${dayNumber}`, 'i') });
  }

  async expectLoaded(dayNumber?: number) {
    const heading = dayNumber
      ? this.dayHeading(dayNumber)
      : this.page.getByRole('heading', { name: /day \d/i });
    await expect(heading).toBeVisible({ timeout: 15000 });
  }

  async fillAmrap(value: string, index = 0) {
    await this.amrapInputs.nth(index).fill(value);
  }

  async confirmSet(index: number) {
    await this.confirmButtons.nth(index).click();
  }

  async toggleSet(index: number) {
    await this.confirmButtons.nth(index).click();
  }

  async complete() {
    await this.completeButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async goBackToDashboard() {
    await expect(this.backToDashboardButton).toBeVisible();
    await this.backToDashboardButton.click();
    await this.page.waitForURL('/');
  }
}
```

**Step 2: Update workout.spec.ts tests**

Key tests that need updating:

1. **"starting a workout" test** — replace checkbox count with confirm button count
2. **"completing a non-AMRAP set marks it visually as done"** — click Confirm, check for completed class instead of checkbox checked
3. **"entering AMRAP reps"** — should still work (AMRAP stepper shows immediately)
4. **"resuming an in-progress workout"** — confirm sets, navigate away, come back, verify still confirmed (check for undo button or stepper)
5. **"nSuns plan-driven workout has correct set counts"** — count confirm buttons + amrap inputs instead of checkboxes + spinbuttons
6. **"completing a workout shows progression"** — fill AMRAP, complete, verify

Update each test to use the new confirm-based flow. The AMRAP tests should need minimal changes since AMRAP stepper still shows immediately.

**Step 3: Run E2E tests**

Run: `npm test` (or the specific workout spec with `npx playwright test e2e/workout.spec.ts`)
Expected: All pass

**Step 4: Commit**

```bash
git add e2e/pages/workout.page.ts e2e/workout.spec.ts
git commit -m "test: update E2E tests for confirm-based set completion UX"
```

---

### Task 7: Manual smoke test via Chrome MCP

**Step 1: Navigate to workout page in browser**

Use Chrome MCP to navigate to `http://localhost:5173`, start a workout from dashboard.

**Step 2: Verify these flows:**

- [ ] Regular set shows "Confirm" button
- [ ] Tapping Confirm shows stepper pre-filled with prescribed reps + green background
- [ ] Tapping `-` decreases reps, shows amber background and "target: X" hint
- [ ] Tapping undo (checkmark) resets to pending with Confirm button
- [ ] AMRAP set shows stepper immediately (no Confirm step)
- [ ] AMRAP set allows going above prescribed reps
- [ ] Non-AMRAP set cannot go above prescribed reps
- [ ] Complete Workout works after confirming all sets
- [ ] Missing progression reps dialog fires if progression sets unconfirmed
- [ ] Progression banner shows TM increase after completing
- [ ] History page shows old workouts correctly (checkmark only, no "(X done)")
- [ ] History page shows new workouts with "(X done)" when reps differ from prescribed

**Step 3: Final commit if any fixes needed**
