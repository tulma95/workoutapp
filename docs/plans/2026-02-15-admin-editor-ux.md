# Admin Plan Editor UX Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 17 UX issues in the admin plan editor (3 critical bugs, 6 major, 8 minor).

**Architecture:** Group changes by component to minimize file churn. 5 work units: SetSchemeEditorModal, PlanEditorPage, ProgressionRulesEditor, Toast system, Navigation blocker. Each unit gets one commit.

**Tech Stack:** React + TypeScript, React Router v7 (`useBlocker`), plain CSS, Playwright E2E tests.

**Design doc:** `docs/features/011-admin-plan-editor-ux/design.md`
**Test plan:** `docs/features/011-admin-plan-editor-ux/test-plan.md`
**UX issues:** `docs/features/011-admin-plan-editor-ux/ux-issues.md`

---

### Task 1: Create feature branch

**Step 1: Create and switch to branch**

```bash
git checkout -b admin-editor-ux
```

**Step 2: Verify clean state**

```bash
git status
```

---

### Task 2: Fix SetSchemeEditorModal (#1, #10, #11, #14, #15)

**Files:**
- Modify: `frontend/src/components/SetSchemeEditorModal.tsx`
- Modify: `frontend/src/components/SetSchemeEditorModal.css`

**Step 1: Fix percentage double-conversion bug (#1)**

In `SetSchemeEditorModal.tsx:112`, the `onChange` stores raw input without dividing by 100. Fix:

```tsx
// Line 112: Change from:
updateSet(set.setOrder, 'percentage', parseFloat(e.target.value) || 0)
// To:
updateSet(set.setOrder, 'percentage', (parseFloat(e.target.value) || 0) / 100)
```

This ensures the internal state stays in 0-1 range while the display (`Math.round(set.percentage * 100)` on line 110) shows 0-100.

**Step 2: Rename "Prog" column header (#11)**

In `SetSchemeEditorModal.tsx:96`, change the table header:

```tsx
// Line 96: Change from:
<th>Prog</th>
// To:
<th title="Mark which set determines training max progression">Progression</th>
```

**Step 3: Add bulk-add quick-add row (#15)**

Add state for bulk-add inputs and a `bulkAddSets` function. Insert a quick-add row in the modal body, above the table:

```tsx
// Add state at top of component:
const [bulkCount, setBulkCount] = useState(5);
const [bulkPercentage, setBulkPercentage] = useState(50);
const [bulkReps, setBulkReps] = useState(10);

// Add function:
function bulkAddSets() {
  const startOrder = sets.length + 1;
  const newSets: PlanSet[] = [];
  for (let i = 0; i < bulkCount; i++) {
    newSets.push({
      setOrder: startOrder + i,
      percentage: bulkPercentage / 100,
      reps: bulkReps,
      isAmrap: false,
      isProgression: false,
    });
  }
  setSets([...sets, ...newSets]);
}
```

Render the quick-add row inside `.set-scheme-body`, before the table:

```tsx
<div className="bulk-add-row">
  <label>
    Add
    <input type="number" min="1" max="20" value={bulkCount}
      onChange={(e) => setBulkCount(parseInt(e.target.value, 10) || 1)}
      className="bulk-input" />
  </label>
  <label>
    sets at
    <input type="number" min="0" max="100" value={bulkPercentage}
      onChange={(e) => setBulkPercentage(parseInt(e.target.value, 10) || 0)}
      className="bulk-input" />
    %
  </label>
  <label>
    for
    <input type="number" min="1" max="100" value={bulkReps}
      onChange={(e) => setBulkReps(parseInt(e.target.value, 10) || 1)}
      className="bulk-input" />
    reps
  </label>
  <button onClick={bulkAddSets} className="btn-bulk-add">+ Add</button>
</div>
```

**Step 4: Fix table column widths and styling (#14, #10)**

In `SetSchemeEditorModal.css`, update the table to use fixed layout and tighten columns:

```css
.sets-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  table-layout: fixed;
}

/* Explicit column widths */
.sets-table th:nth-child(1) { width: 50px; }   /* Set # */
.sets-table th:nth-child(2) { width: 100px; }  /* % of TM */
.sets-table th:nth-child(3) { width: 100px; }  /* Reps */
.sets-table th:nth-child(4) { width: 80px; }   /* AMRAP */
.sets-table th:nth-child(5) { width: 100px; }  /* Progression */
.sets-table th:nth-child(6) { width: 50px; }   /* Delete */
```

The percentage and reps inputs already share the same styling (`.percentage-input` and `.reps-input` both have border, background, padding) per the CSS. Issue #10 is already fixed in current CSS — verify visually.

Add CSS for the bulk-add row:

```css
.bulk-add-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.bulk-add-row label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  white-space: nowrap;
}

.bulk-input {
  width: 60px;
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn-bulk-add {
  background: var(--admin-accent, #7c3aed);
  color: white;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  font-size: 0.875rem;
  min-height: 32px;
}
```

**Step 5: Verify in browser**

Start dev servers if not running. Navigate to admin, create a plan, add exercise, open set scheme editor:
1. Type "65" in percentage — should display "65", not "6500"
2. Use bulk-add: add 5 sets at 50% for 10 reps
3. Save sets, reopen — values should persist correctly
4. Column header should say "Progression"

**Step 6: Commit**

```bash
git add frontend/src/components/SetSchemeEditorModal.tsx frontend/src/components/SetSchemeEditorModal.css
git commit -m "fix: SetSchemeEditorModal percentage bug, bulk-add, column fixes (#1,#10,#11,#14,#15)"
```

---

### Task 3: Create toast notification system (#6, #7)

**Files:**
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/components/Toast.css`
- Modify: `frontend/src/components/AdminLayout.tsx`

**Step 1: Create Toast context and component**

Create `frontend/src/components/Toast.tsx`:

```tsx
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import './Toast.css';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning';
  message: string;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctx: ToastContextType = {
    success: useCallback((msg: string) => addToast('success', msg), [addToast]),
    error: useCallback((msg: string) => addToast('error', msg), [addToast]),
    warning: useCallback((msg: string) => addToast('warning', msg), [addToast]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-dismiss" onClick={() => dismiss(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

**Step 2: Create Toast CSS**

Create `frontend/src/components/Toast.css`:

```css
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 400px;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: toast-slide-in 0.3s ease-out;
}

@keyframes toast-slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast--success {
  background: #065f46;
  color: #d1fae5;
}

.toast--error {
  background: #991b1b;
  color: #fee2e2;
}

.toast--warning {
  background: #92400e;
  color: #fef3c7;
}

.toast-message {
  flex: 1;
}

.toast-dismiss {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  opacity: 0.7;
  min-width: 24px;
  min-height: 24px;
}

.toast-dismiss:hover {
  opacity: 1;
}

@media (max-width: 768px) {
  .toast-container {
    left: 1rem;
    right: 1rem;
    max-width: none;
  }
}
```

**Step 3: Wrap AdminLayout with ToastProvider**

In `AdminLayout.tsx`, import and wrap the layout:

```tsx
import { ToastProvider } from './Toast';

// Wrap the return JSX:
return (
  <ToastProvider>
    {/* existing AdminLayout content */}
  </ToastProvider>
);
```

**Step 4: Verify toast renders**

In browser, temporarily add a test toast call to verify it works.

**Step 5: Commit**

```bash
git add frontend/src/components/Toast.tsx frontend/src/components/Toast.css frontend/src/components/AdminLayout.tsx
git commit -m "feat: add toast notification system for admin panel (#6)"
```

---

### Task 4: Fix PlanEditorPage (#2, #4, #7, #8, #9, #12, #13, #16, #17)

**Files:**
- Modify: `frontend/src/pages/admin/PlanEditorPage.tsx`
- Modify: `frontend/src/pages/admin/PlanEditorPage.css`

This is the largest task. Take it step by step.

**Step 1: Replace alert() with toast and add aggregated validation (#7)**

Import `useToast` and replace all `alert()` calls:

```tsx
import { useToast } from '../../components/Toast';

// Inside component:
const toast = useToast();
```

Replace the validation in `handleSave` — collect ALL errors instead of returning on first:

```tsx
async function handleSave() {
  const errors: string[] = [];

  if (!name.trim()) errors.push('Plan name is required');
  if (!slug.trim()) errors.push('Plan slug is required');

  // Validate all exercises have at least one set
  for (const day of days) {
    for (const ex of day.exercises) {
      if (ex.sets.length === 0) {
        const exerciseData = exercises.find(e => e.id === ex.exerciseId);
        errors.push(`Day ${day.dayNumber}: ${exerciseData?.name || 'Exercise'} has no sets defined`);
      }
    }
  }

  if (errors.length > 0) {
    setValidationErrors(errors);
    toast.error(`Plan has ${errors.length} validation error${errors.length > 1 ? 's' : ''}`);
    return;
  }
  setValidationErrors([]);

  // ... rest of save logic
```

Add state for validation errors:

```tsx
const [validationErrors, setValidationErrors] = useState<string[]>([]);
```

Replace the success `alert()` calls with toast:

```tsx
// Replace: alert('Plan updated successfully');
toast.success('Plan updated successfully');

// Replace: alert('Plan created successfully');
toast.success('Plan created successfully');
```

Render inline validation error summary below the header (replacing the existing `{error && ...}` block):

```tsx
{validationErrors.length > 0 && (
  <div className="validation-errors">
    <strong>Please fix the following errors:</strong>
    <ul>
      {validationErrors.map((err, idx) => (
        <li key={idx}>{err}</li>
      ))}
    </ul>
  </div>
)}
{error && <div className="plan-editor-error">{error}</div>}
```

**Step 2: Investigate and fix description field loss (#2)**

The description state is a standalone `useState('')`. The `useEffect` on line 63 runs when `id` changes. In create mode, `initializeNewPlan()` only sets `days` — it doesn't reset `description`. This should be fine.

Potential cause: if the component remounts due to a key change or route change, state resets. Check if the `ProgressionRulesEditor` `onChange` callback (`setProgressionRules`) triggers an issue. The `onChange` is called from ProgressionRulesEditor's internal state init (line 26-46) — when `initialRules` is empty, it creates a default rule and calls `onChange` on mount... actually no, it only calls `onChange` on user interaction, not on mount.

Most likely cause: the `useEffect` on line 63 has `[id]` dependency. In create mode, `id` is undefined. If React Router remounts the component (e.g., navigating from `/admin/plans/new` back to itself), all state resets. The real fix is to verify this behavior in the browser and then ensure state persistence.

Actually, looking more carefully at the code — when editing sets via `SetSchemeEditorModal`, the `saveSetScheme` function calls `setDays(...)` which is a completely new array. This triggers a re-render but shouldn't lose `description` state since it's separate `useState`.

**Investigate in browser**: Type description, add exercise, add sets, switch tabs. If description is lost, the issue is likely the component unmounting. If it's a React Router issue, we'll need to debug further.

For now, the most robust fix: ensure `initializeNewPlan` doesn't run on every re-render by guarding the `useEffect`:

```tsx
useEffect(() => {
  loadExercises();
  if (isEditMode) {
    loadPlan();
  } else if (days.length === 0) {
    initializeNewPlan();
  }
}, [id]);
```

Wait — `days.length === 0` would be stale in the closure. Better approach: use a ref to track initialization:

```tsx
const initialized = useRef(false);

useEffect(() => {
  loadExercises();
  if (isEditMode) {
    loadPlan();
  } else if (!initialized.current) {
    initialized.current = true;
    initializeNewPlan();
  }
}, [id]);
```

If this doesn't fix it, investigate further during implementation.

**Step 3: Verify slug auto-generation (#4)**

The existing code already has `slugManuallyEdited` logic and `generateSlug()`. Test it:
1. Type "531 BBB 4-Day" in name → slug should auto-fill "531-bbb-4-day"
2. Manually edit slug → stops auto-generating
3. Clear slug, keep typing name → slug should NOT auto-generate (manual flag is set)

If auto-gen already works, skip. If it needs a "reset to auto" button, add one:

```tsx
<div className="form-row slug-row">
  <label>
    Slug *
    <input type="text" value={slug}
      onChange={(e) => handleSlugChange(e.target.value)}
      placeholder="e.g., nsuns-4day-lp" />
  </label>
  {slugManuallyEdited && (
    <button className="btn-reset-slug" onClick={() => {
      setSlugManuallyEdited(false);
      setSlug(generateSlug(name));
    }}>
      Auto-generate
    </button>
  )}
</div>
```

**Step 4: Add day tab completion indicators (#8)**

Update the day tab buttons to show status dots:

```tsx
{days.map((day) => {
  const hasExercises = day.exercises.length > 0;
  const allHaveSets = hasExercises && day.exercises.every(ex => ex.sets.length > 0);
  const someHaveSets = hasExercises && day.exercises.some(ex => ex.sets.length > 0);

  let statusClass = '';
  if (allHaveSets) statusClass = 'day-tab--complete';
  else if (hasExercises) statusClass = 'day-tab--incomplete';

  return (
    <button
      key={day.dayNumber}
      className={`day-tab ${activeDay === day.dayNumber ? 'day-tab--active' : ''} ${statusClass}`}
      onClick={() => setActiveDay(day.dayNumber)}
    >
      {day.name && day.name !== `Day ${day.dayNumber}`
        ? `Day ${day.dayNumber}: ${day.name}`
        : `Day ${day.dayNumber}`}
    </button>
  );
})}
```

This also handles #9 (showing custom day names in tabs).

**Step 5: Add sticky save bar (#12)**

Move the save button to a sticky footer bar at the bottom of `.plan-editor-page`:

```tsx
{/* At the very end of plan-editor-page div, after ProgressionRulesEditor */}
<div className="sticky-save-bar">
  <button
    className="btn-save-plan"
    onClick={handleSave}
    disabled={saving}
  >
    {saving ? 'Saving...' : 'Save Plan'}
  </button>
</div>
```

Keep the original save button in the header as well, or replace it. Recommendation: keep only the sticky bar, remove the header button.

**Step 6: Fix exercise reorder button visibility (#13)**

In the CSS, increase contrast for enabled move buttons:

```css
.exercise-row-actions button {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  min-height: 32px;
  min-width: 32px;
  color: var(--admin-accent, #7c3aed);
  font-weight: 600;
}

.exercise-row-actions button:disabled {
  opacity: 0.25;
  cursor: not-allowed;
  color: var(--text-muted);
}
```

**Step 7: Add copy sets between exercises (#16)**

Add a "Copy sets from..." button on each exercise card, below the sets info line:

```tsx
function copySetsFrom(dayNumber: number, sourceTempId: string, targetTempId: string) {
  const day = days.find(d => d.dayNumber === dayNumber);
  if (!day) return;
  const source = day.exercises.find(ex => ex.tempId === sourceTempId);
  if (!source) return;

  // Deep clone sets with new set orders
  const copiedSets = source.sets.map(set => ({ ...set }));

  updateExerciseField(dayNumber, targetTempId, 'sets', copiedSets);
}
```

In the exercise card JSX, after the "Edit Sets" button:

```tsx
{/* Copy sets dropdown */}
{(() => {
  // Find exercises with sets in the same day
  const otherWithSets = currentDayData.exercises.filter(
    other => other.tempId !== ex.tempId && other.sets.length > 0
  );
  if (otherWithSets.length === 0) return null;
  return (
    <select
      className="copy-sets-select"
      value=""
      onChange={(e) => {
        if (e.target.value) copySetsFrom(activeDay, e.target.value, ex.tempId);
      }}
    >
      <option value="">Copy sets from...</option>
      {otherWithSets.map(other => {
        const otherExData = exercises.find(e => e.id === other.exerciseId);
        return (
          <option key={other.tempId} value={other.tempId}>
            {otherExData?.name || 'Exercise'} ({other.sets.length} sets)
          </option>
        );
      })}
    </select>
  );
})()}
```

**Step 8: Add delete confirmation for exercises with sets (#17)**

Modify `removeExercise`:

```tsx
function removeExercise(dayNumber: number, tempId: string) {
  const day = days.find(d => d.dayNumber === dayNumber);
  const exercise = day?.exercises.find(ex => ex.tempId === tempId);

  // Confirm if exercise has sets configured
  if (exercise && exercise.sets.length > 0) {
    const confirmed = window.confirm(
      `This exercise has ${exercise.sets.length} sets configured. Delete it?`
    );
    if (!confirmed) return;
  }

  setDays(days.map(day => {
    if (day.dayNumber !== dayNumber) return day;
    const filtered = day.exercises.filter(ex => ex.tempId !== tempId);
    return {
      ...day,
      exercises: filtered.map((ex, idx) => ({ ...ex, sortOrder: idx + 1 })),
    };
  }));
}
```

**Step 9: Add CSS for new features**

Add to `PlanEditorPage.css`:

```css
/* Validation errors */
.validation-errors {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: #991b1b;
}

.validation-errors ul {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}

.validation-errors li {
  margin-bottom: 0.25rem;
}

/* Day tab status indicators */
.day-tab--complete::after {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
  margin-left: 0.5rem;
}

.day-tab--incomplete::after {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ea580c;
  margin-left: 0.5rem;
}

/* Day tab name truncation */
.day-tab {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Sticky save bar */
.sticky-save-bar {
  position: sticky;
  bottom: 0;
  background: var(--bg-card);
  border-top: 1px solid var(--border-color);
  padding: 1rem;
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
  border-radius: 0 0 12px 12px;
  z-index: 10;
}

/* Slug auto-generate button */
.slug-row {
  position: relative;
}

.btn-reset-slug {
  background: transparent;
  border: none;
  color: var(--admin-accent, #7c3aed);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.25rem 0;
}

/* Copy sets dropdown */
.copy-sets-select {
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.75rem;
  background: var(--bg-primary);
  color: var(--text-muted);
  min-height: 32px;
}
```

**Step 10: Verify in browser**

1. Create plan, fill description, add exercise, switch tabs — description persists
2. Name "Test Plan" auto-generates slug "test-plan"
3. Day tabs show completion indicators
4. Day tabs show custom names
5. Save button sticks to bottom
6. Move buttons are visible (purple)
7. Validation shows all errors at once in inline summary + toast
8. Copy sets works between exercises
9. Delete exercise with sets shows confirmation

**Step 11: Commit**

```bash
git add frontend/src/pages/admin/PlanEditorPage.tsx frontend/src/pages/admin/PlanEditorPage.css
git commit -m "fix: PlanEditorPage UX overhaul — description, tabs, validation, sticky save (#2,#4,#7,#8,#9,#12,#13,#16,#17)"
```

---

### Task 5: Fix ProgressionRulesEditor default rule (#5)

**Files:**
- Modify: `frontend/src/components/ProgressionRulesEditor.tsx`

**Step 1: Remove pre-populated empty rule**

In `ProgressionRulesEditor.tsx:26-36`, change the empty state to start with zero rules:

```tsx
const [rules, setRules] = useState<EditorRule[]>(() => {
  if (initialRules.length === 0) {
    return [];
  }
  return initialRules.map((rule, idx) => ({
    tempId: rule.id ? `rule-${rule.id}` : `rule-${Date.now()}-${idx}`,
    exerciseId: rule.exerciseId,
    category: rule.category,
    minReps: rule.minReps,
    maxReps: rule.maxReps,
    increase: rule.increase,
  }));
});
```

**Step 2: Update addRule defaults**

In `addRule` function (line 72-81), use sensible defaults:

```tsx
function addRule() {
  const newRule: EditorRule = {
    tempId: `rule-${Date.now()}-${Math.random()}`,
    minReps: 1,
    maxReps: 5,
    increase: 2.5,
  };
  const updated = [...rules, newRule];
  setRules(updated);
  onChange(updated);
}
```

**Step 3: Add empty state message**

Add a message when no rules exist, before the table:

```tsx
{rules.length === 0 ? (
  <div className="progression-rules-empty">
    No progression rules defined. Click "+ Add Rule" to configure how training maxes increase.
  </div>
) : (
  <div className="progression-rules-table-wrapper">
    {/* existing table */}
  </div>
)}
```

**Step 4: Verify in browser**

1. Create new plan — progression section should show empty state, no pre-populated rule
2. Click "+ Add Rule" — new rule has minReps: 1, maxReps: 5, increase: 2.5
3. Edit existing plan — rules load correctly

**Step 5: Commit**

```bash
git add frontend/src/components/ProgressionRulesEditor.tsx
git commit -m "fix: remove pre-populated empty progression rule, use sensible defaults (#5)"
```

---

### Task 6: Add unsaved changes navigation blocker (#3)

**Files:**
- Modify: `frontend/src/pages/admin/PlanEditorPage.tsx`
- Modify: `frontend/src/pages/admin/PlanEditorPage.css`

**Step 1: Add isDirty tracking**

Add state and a helper to track form changes:

```tsx
const [isDirty, setIsDirty] = useState(false);

// Create wrapper functions that set isDirty
function markDirty() {
  setIsDirty(true);
}
```

Add `markDirty()` calls to all state-changing handlers: `handleNameChange`, `handleSlugChange`, `setDescription`, `handleDaysPerWeekChange`, `setIsPublic`, `addExerciseToDay`, `removeExercise`, `updateExerciseField`, `moveExerciseUp`, `moveExerciseDown`, `saveSetScheme`, `setProgressionRules`.

Reset on successful save:

```tsx
// After successful save in handleSave:
setIsDirty(false);
```

**Step 2: Add beforeunload handler**

```tsx
useEffect(() => {
  if (!isDirty) return;

  function handleBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault();
  }

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isDirty]);
```

**Step 3: Add React Router navigation blocker**

```tsx
import { useParams, useNavigate, useBlocker } from 'react-router';

// Inside component:
const blocker = useBlocker(isDirty);
```

Render a confirmation modal when blocker is active:

```tsx
{blocker.state === 'blocked' && (
  <div className="unsaved-modal" onClick={() => blocker.reset()}>
    <div className="unsaved-modal-content" onClick={(e) => e.stopPropagation()}>
      <h3>Unsaved Changes</h3>
      <p>You have unsaved changes. Leave without saving?</p>
      <div className="unsaved-modal-actions">
        <button className="btn-stay" onClick={() => blocker.reset()}>
          Stay
        </button>
        <button className="btn-leave" onClick={() => blocker.proceed()}>
          Leave
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 4: Add CSS for the unsaved changes modal**

```css
.unsaved-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.unsaved-modal-content {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
}

.unsaved-modal-content h3 {
  margin: 0 0 0.75rem;
  color: var(--text-primary);
}

.unsaved-modal-content p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.unsaved-modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-stay {
  background: var(--admin-accent, #7c3aed);
  color: white;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  min-height: 40px;
}

.btn-leave {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.625rem 1.25rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  min-height: 40px;
}
```

**Step 5: Verify in browser**

1. Create plan, type name → modify form
2. Click "Plans" tab → confirmation modal appears
3. Click "Stay" → stays on page
4. Click "Plans" tab again → click "Leave" → navigates away
5. Create plan, save → navigate away → NO confirmation (clean state)
6. Close browser tab with unsaved changes → browser shows native "Leave site?" dialog

**Step 6: Commit**

```bash
git add frontend/src/pages/admin/PlanEditorPage.tsx frontend/src/pages/admin/PlanEditorPage.css
git commit -m "feat: add unsaved changes warning with navigation blocker (#3)"
```

---

### Task 7: Write E2E tests

**Files:**
- Create: `e2e/admin-plan-editor.spec.ts`

**Step 1: Write tests**

Reference the test plan at `docs/features/011-admin-plan-editor-ux/test-plan.md` for all 15 test scenarios. Key tests to implement:

1. Plan creation happy path
2. Percentage input correct conversion (critical — verifies #1 fix)
3. Description field persistence (verifies #2 fix)
4. Unsaved changes warning (verifies #3 fix)
5. Validation shows all errors at once (verifies #7 fix)
6. Day tab completion indicators (verifies #8 fix)
7. Progression rules no default empty rule (verifies #5 fix)
8. Set scheme bulk add (verifies #15 fix)

Each test:
- Logs in as admin (use the seeded admin user or create one)
- Navigates to `/admin/plans/new` or existing plan
- Performs actions
- Asserts expected outcomes

Use `crypto.randomUUID()` for unique plan names/slugs to avoid conflicts.

**Step 2: Run tests**

```bash
./run_test.sh
```

Expected: All existing tests pass + new admin editor tests pass.

**Step 3: Fix any test failures**

If tests fail, check `backend-test.log` for API errors. Fix code or test assertions as needed.

**Step 4: Commit**

```bash
git add e2e/admin-plan-editor.spec.ts
git commit -m "test: add E2E tests for admin plan editor UX fixes"
```

---

### Task 8: Final verification and typecheck

**Step 1: Run typecheck**

```bash
cd frontend && npx tsc --noEmit && cd ..
npm run build -w backend
```

**Step 2: Run full test suite**

```bash
./run_test.sh
```

**Step 3: Fix any issues**

**Step 4: Commit any fixes**

---

### Task 9: Finish branch

Use `superpowers:finishing-a-development-branch` to decide how to integrate the work (merge, PR, etc.).
