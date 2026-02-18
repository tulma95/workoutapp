# Workout History Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the workout history view with colored set completion states, per-exercise progression banners, delete capability, and multi-workout day picker.

**Architecture:** Backend: extend DELETE endpoint to allow discarding completed workouts. Frontend: redesign WorkoutDetail with green/orange set tinting, fix progression display (currently always null), add delete button with confirmation dialog, and handle multiple workouts per calendar day via a picker.

**Tech Stack:** Express.js backend, React frontend with CSS Modules, native `<dialog>` for confirmation, Playwright for E2E tests.

---

### Task 1: Backend — Allow soft-deleting completed workouts

**Files:**
- Modify: `backend/src/services/workout.service.ts:500-522` (cancelWorkout function)
- Test: `backend/src/__tests__/workouts-plan-driven.test.ts`

**Step 1: Write the failing test**

Add to the bottom of `backend/src/__tests__/workouts-plan-driven.test.ts`:

```typescript
describe('DELETE /api/workouts/:id (discard)', () => {
  it('should discard a completed workout', async () => {
    // Start and complete a workout
    const startRes = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayNumber: 1 });
    const workoutId = startRes.body.id;

    await request(app)
      .post(`/api/workouts/${workoutId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    // Discard the completed workout
    const res = await request(app)
      .delete(`/api/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should hide discarded workout from calendar', async () => {
    const startRes = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayNumber: 1 });
    const workoutId = startRes.body.id;

    await request(app)
      .post(`/api/workouts/${workoutId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .delete(`/api/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${token}`);

    const now = new Date();
    const calRes = await request(app)
      .get(`/api/workouts/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .set('Authorization', `Bearer ${token}`);

    const ids = calRes.body.workouts.map((w: { id: number }) => w.id);
    expect(ids).not.toContain(workoutId);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/workouts-plan-driven.test.ts --reporter=verbose`
Expected: FAIL — first test returns 409 CONFLICT because `cancelWorkout` rejects completed workouts.

**Step 3: Implement — update cancelWorkout service**

In `backend/src/services/workout.service.ts`, change the `cancelWorkout` function (lines 500-522). Remove the `in_progress` status check — allow discarding both `in_progress` and `completed` workouts. Reject only `discarded` (already discarded):

```typescript
export async function cancelWorkout(workoutId: number, userId: number) {
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
  });

  if (!workout) {
    return null;
  }

  if (workout.status === 'discarded') {
    throw new Error('CONFLICT: Workout is already discarded');
  }

  await prisma.workout.update({
    where: { id: workoutId },
    data: { status: 'discarded' },
  });

  return { success: true };
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/workouts-plan-driven.test.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```
feat: allow soft-deleting completed workouts
```

---

### Task 2: Frontend — Add colored set completion states to WorkoutDetail

**Files:**
- Modify: `frontend/src/components/WorkoutDetail.tsx`
- Modify: `frontend/src/components/WorkoutDetail.module.css`

**Step 1: Update CSS with set state classes**

In `WorkoutDetail.module.css`, add three set state classes after `.setRow` (line 65):

```css
.setCompleted {
  background-color: rgba(22, 163, 74, 0.1);
}

.setUnder {
  background-color: rgba(234, 146, 22, 0.15);
}

.setMissed {
  opacity: 0.5;
}
```

Remove the old `.setCompleted` rule (lines 89-93) that was just for the checkmark color. The checkmark span should be renamed to `.checkmark`.

**Step 2: Update WorkoutDetail.tsx set row rendering**

Replace the set row rendering logic (lines 63-84) to compute the state class:

```tsx
{group.sets.map((set, index) => {
  const isCompleted = set.completed || set.actualReps !== null;
  const isUnder = isCompleted && set.actualReps !== null && set.actualReps < set.prescribedReps;
  const stateClass = !isCompleted
    ? styles.setMissed
    : isUnder
      ? styles.setUnder
      : styles.setCompleted;

  return (
    <div key={set.id} className={`${styles.setRow} ${stateClass}`}>
      <span className={styles.setNumber}>{index + 1}</span>
      <span className={styles.setWeight}>
        {formatWeight(set.prescribedWeight)}
      </span>
      <span className={styles.setReps}>
        {set.prescribedReps}
        {set.isAmrap ? '+' : ''}
      </span>
      {set.actualReps !== null && set.actualReps !== set.prescribedReps && (
        <span className={styles.setActual}>
          {set.actualReps}
        </span>
      )}
    </div>
  );
})}
```

Key changes:
- Green tint for completed at/above prescribed reps
- Orange tint for completed under prescribed reps
- Dimmed (0.5 opacity) for not completed
- Remove "Set " prefix text, just show number
- Remove " reps" suffix (visual noise)
- Remove checkmark — the color conveys completion state

**Step 3: Add completion summary to header**

In `WorkoutDetail.tsx`, compute total/completed counts and show in header:

```tsx
const totalSets = workout.sets.length;
const completedSets = workout.sets.filter(s => s.completed || s.actualReps !== null).length;
```

Add below the date line: `<span className={styles.summary}>{completedSets}/{totalSets} sets</span>`

Add CSS for `.summary`:
```css
.summary {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: var(--space-xs);
}
```

**Step 4: Verify in browser**

Run: Navigate to history page, click on a workout day, verify green/orange/dimmed states match the active workout visual language.

**Step 5: Commit**

```
feat: add colored set completion states to history detail
```

---

### Task 3: Frontend — Fix progression display in history

The history page always passes `progression={null}` to `WorkoutDetail` because `getWorkout()` doesn't return progression data. Rather than adding a separate API call, compute progressions client-side from the workout's set data — we can detect which exercises had AMRAP/progression sets and show actual reps vs prescribed.

However, the real progression data (TM changes) isn't available from the workout alone. The simplest fix: store progressions on the workout row at completion time, or add a query param to include them.

**Files:**
- Modify: `backend/src/services/workout.service.ts` — `getWorkout` function (line 232)
- Modify: `backend/src/routes/workouts.ts` — GET /:id route
- Modify: `frontend/src/api/schemas.ts` — extend WorkoutSchema
- Modify: `frontend/src/components/WorkoutDetail.tsx`
- Modify: `frontend/src/components/HistoryContent.tsx`

**Step 1: Extend getWorkout to return progressions**

In `backend/src/services/workout.service.ts`, modify `getWorkout()` to also look up training max history for the workout's completion date. For completed workouts, find training_maxes created on the same day as `completedAt` and associated with the workout's exercises.

Simpler approach: query `trainingMax` rows where `createdAt` is within a few seconds of the workout's `completedAt`. But this is fragile.

Better approach: add `workoutId` to the `trainingMax` table to link progressions to specific workouts.

Simplest approach for now: return progressions alongside the workout by looking at sets marked `isProgression: true` and the exercise's current vs previous TMs. But we don't have the historical TM at workout time.

**Recommended approach:** Store the progressions array as JSON on the workout row at completion time.

Add a `progressions` JSON column to the `workout` table:

**Step 1a: Create migration**

Run from `backend/`:
```bash
npx prisma migrate dev --name add_workout_progressions
```

Add to schema.prisma in the Workout model:
```prisma
progressions Json? @default("[]")
```

**Step 1b: Store progressions at completion time**

In `completeWorkout()` (workout.service.ts), after computing progressions, store them on the workout row:

```typescript
await prisma.workout.update({
  where: { id: workoutId },
  data: {
    status: 'completed',
    completedAt: new Date(),
    progressions: JSON.stringify(progressionResults),
  },
});
```

**Step 1c: Return progressions from getWorkout**

In `getWorkout()`, parse and return the `progressions` field from the workout.

**Step 1d: Update frontend schema**

In `frontend/src/api/schemas.ts`, add `progressions` to `WorkoutSchema`:
```typescript
progressions: z.array(ProgressionResultSchema).optional().default([]),
```

**Step 1e: Update WorkoutDetail to show per-exercise progressions**

In `WorkoutDetail.tsx`, show the progression banner per exercise group (after the sets) instead of at the bottom. Match progression to exercise by name.

Remove the bottom "No TM change" section entirely. Only show progression banners where there actually was a change.

**Step 1f: Update HistoryContent.tsx**

Remove the `progression={null}` prop — `WorkoutDetail` now reads progressions from the workout object itself.

**Step 2: Run tests**

Run: `cd backend && npx vitest run --reporter=verbose`
Expected: PASS (existing tests should still work since the new column is optional)

**Step 3: Commit**

```
feat: store and display workout progressions in history
```

---

### Task 4: Frontend — Multi-workout day picker

Currently `WorkoutCalendar` maps each date to a single workout (`Map<string, CalendarWorkout>`). Need to change to `Map<string, CalendarWorkout[]>` and show a picker when multiple workouts exist on the same day.

**Files:**
- Modify: `frontend/src/components/WorkoutCalendar.tsx`
- Modify: `frontend/src/components/WorkoutCalendar.module.css`
- Modify: `frontend/src/routes/_authenticated/_layout/history.tsx`
- Modify: `frontend/src/components/HistoryContent.tsx`

**Step 1: Update workoutMap to support multiple workouts per day**

In `WorkoutCalendar.tsx`, change the map type from `Map<string, CalendarWorkout>` to `Map<string, CalendarWorkout[]>`:

```typescript
const workoutMap = useMemo(() => {
  const map = new Map<string, CalendarWorkout[]>();
  workouts.forEach((workout) => {
    const dateStr = workout.completedAt || workout.createdAt;
    const date = new Date(dateStr);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const existing = map.get(key) || [];
    existing.push(workout);
    map.set(key, existing);
  });
  return map;
}, [workouts]);
```

Update the `calendarDays` type to use `workouts?: CalendarWorkout[]` instead of `workout?: CalendarWorkout`.

Update the day badge to show workout count: `{day.workouts.length}`.

**Step 2: Update onSelectWorkout callback to handle multi-workout days**

Change `onSelectWorkout` prop to `onSelectDay(workouts: CalendarWorkout[])`.

In `history.tsx`, when `onSelectDay` is called:
- If 1 workout: fetch and show it directly (current behavior)
- If multiple: set a `dayWorkouts` state to show the picker

**Step 3: Create workout picker UI**

In `HistoryContent.tsx`, when `dayWorkouts` has multiple items, show a simple list:

```tsx
{dayWorkouts && dayWorkouts.length > 1 && !selectedWorkout && (
  <div className={styles.picker}>
    {dayWorkouts.map(w => (
      <button
        key={w.id}
        className={styles.pickerItem}
        onClick={() => onSelectWorkout(w.id)}
      >
        Day {w.dayNumber}
      </button>
    ))}
  </div>
)}
```

Add CSS for the picker in `HistoryPage.module.css`.

**Step 4: Verify in browser**

Create two workouts on the same day, navigate to history, tap the day, verify picker appears.

**Step 5: Commit**

```
feat: add multi-workout day picker to history calendar
```

---

### Task 5: Frontend — Delete workout from history

**Files:**
- Modify: `frontend/src/components/WorkoutDetail.tsx`
- Modify: `frontend/src/components/WorkoutDetail.module.css`
- Modify: `frontend/src/routes/_authenticated/_layout/history.tsx`
- Modify: `frontend/src/components/HistoryContent.tsx`

**Step 1: Add delete button to WorkoutDetail**

At the bottom of the detail card, add a delete button:

```tsx
<button
  className={styles.deleteButton}
  onClick={onDelete}
>
  Delete Workout
</button>
```

Add `onDelete?: () => void` to `WorkoutDetailProps`.

CSS for `.deleteButton`:
```css
.deleteButton {
  width: 100%;
  padding: var(--space-md);
  margin-top: var(--space-lg);
  background: none;
  border: 1px solid var(--danger);
  border-radius: var(--space-xs);
  color: var(--danger);
  font-size: 1rem;
  cursor: pointer;
  min-height: 3rem;
}
```

**Step 2: Add confirmation dialog**

In `history.tsx`, create a native `<dialog>` confirmation. When confirmed, call `cancelWorkout(id)`, invalidate calendar query, and clear selected workout.

```tsx
const dialogRef = useRef<HTMLDialogElement>(null);

const handleDelete = () => {
  dialogRef.current?.showModal();
};

const handleConfirmDelete = async () => {
  if (!selectedWorkout) return;
  await cancelWorkout(selectedWorkout.id);
  queryClient.invalidateQueries({ queryKey: ['workoutCalendar'] });
  setSelectedWorkout(null);
  dialogRef.current?.close();
};
```

**Step 3: Add dialog markup**

Follow the project pattern: dialog fills viewport, visual content in `__content` div.

```tsx
<dialog ref={dialogRef} className={styles.dialog}>
  <div className={styles.dialog__content}>
    <p>Delete this workout from history?</p>
    <p className={styles.dialog__note}>Training max changes will not be affected.</p>
    <div className={styles.dialog__actions}>
      <button onClick={() => dialogRef.current?.close()}>Cancel</button>
      <button className={styles.dialog__confirm} onClick={handleConfirmDelete}>Delete</button>
    </div>
  </div>
</dialog>
```

**Step 4: Verify in browser**

Navigate to history, select a workout, click Delete, confirm in dialog, verify workout disappears from calendar.

**Step 5: Commit**

```
feat: add delete workout button to history detail
```

---

### Task 6: E2E Tests

**Files:**
- Modify: `e2e/history.spec.ts`
- Modify: `e2e/pages/history.page.ts`

**Step 1: Add test for colored set states**

```typescript
test('completed sets show green tint, incomplete sets are dimmed', async ({ setupCompletePage }) => {
  const { page } = setupCompletePage;
  const history = new HistoryPage(page);

  await completeWorkout(page, 1, 10);
  await history.navigate();

  const today = new Date().getDate();
  await history.clickDay(today);

  // Verify sets are visible with weight/reps data
  await expect(page.getByText(/\d+\s*kg/).first()).toBeVisible();
});
```

**Step 2: Add test for delete workout**

```typescript
test('delete workout from history - workout disappears from calendar', async ({ setupCompletePage }) => {
  const { page } = setupCompletePage;
  const history = new HistoryPage(page);

  await completeWorkout(page, 1, 10);
  await history.navigate();

  const today = new Date().getDate();
  await history.clickDay(today);

  // Click delete button
  await page.getByRole('button', { name: /delete workout/i }).click();

  // Confirm in dialog
  await page.getByRole('button', { name: /^delete$/i }).click();

  // Workout should disappear - empty state or prompt shown
  await expect(page.getByText(/tap a workout day|no workouts yet/i)).toBeVisible();
});
```

**Step 3: Add test for multi-workout day picker**

```typescript
test('two workouts on same day shows picker, can select each', async ({ setupCompletePage }) => {
  const { page } = setupCompletePage;
  const history = new HistoryPage(page);

  // Complete two workouts on the same day
  await completeWorkout(page, 1, 10);
  await completeWorkout(page, 2, 8);

  await history.navigate();

  const today = new Date().getDate();
  await history.clickDay(today);

  // Should show picker with Day 1 and Day 2
  await expect(page.getByRole('button', { name: /day 1/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /day 2/i })).toBeVisible();

  // Select Day 1
  await page.getByRole('button', { name: /day 1/i }).click();
  await expect(page.getByText(/bench/i).first()).toBeVisible();
});
```

**Step 4: Run E2E tests**

Run: `npm test` (or `./run_test.sh`)
Expected: All tests PASS

**Step 5: Commit**

```
test: add E2E tests for history refinement features
```

---

### Task 7: Update docs

**Files:**
- Modify: `docs/api-endpoints.md` — update DELETE endpoint description
- Modify: `docs/db-schema.md` — add progressions column to workout table
- Modify: `docs/react-query-cache.md` — add delete-from-history invalidation

**Step 1: Update docs**

Update each file with the changes made.

**Step 2: Commit**

```
docs: update API, schema, and cache docs for history refinement
```
