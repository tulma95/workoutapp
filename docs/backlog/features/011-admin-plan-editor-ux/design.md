# Admin Plan Editor UX Overhaul — Design

## Scope

Fix all 17 issues from `ux-issues.md`: 3 critical bugs, 6 major UX issues, 8 minor UX issues.

## Approach: Group by component

Organize work into 5 units, each touching one component/concern. This minimizes file churn and produces reviewable commits.

## Work Unit 1: SetSchemeEditorModal (#1, #10, #11, #14, #15)

**Files:** `SetSchemeEditorModal.tsx`, `SetSchemeEditorModal.css`

### #1 — Percentage input double-conversion bug (Critical)

The `onChange` handler stores raw input (0-100) without dividing by 100, but the display multiplies internal state by 100. After typing "65", state becomes `65`, displayed as `6500`.

Fix: divide by 100 in onChange:
```tsx
onChange={(e) =>
  updateSet(set.setOrder, 'percentage', (parseFloat(e.target.value) || 0) / 100)
}
```

### #10 — Percentage input styling (Minor)

Apply consistent border/background to percentage inputs matching reps inputs. Shared `.set-input` class.

### #11 — "Prog" column header (Minor)

Rename to "Progression" with `title` tooltip: "Mark which set determines training max progression."

### #14 — Column gap (Minor)

Tighten table with `table-layout: fixed` and explicit column widths.

### #15 — Bulk-add sets (Minor)

Quick-add row above the sets table:
```
Add [ 5 ] sets at [ 50 ]% for [ 10 ] reps  [+ Add]
```
Three number inputs + button. Appends N sets with specified percentage and reps, auto-incrementing setOrder.

## Work Unit 2: PlanEditorPage (#2, #4, #8, #9, #12, #13, #16, #17)

**Files:** `PlanEditorPage.tsx`, `PlanEditorPage.css`

### #2 — Description field loses value (Critical)

Investigate and fix the state management bug causing description to reset on re-render. Likely caused by a key prop change or component remount. Ensure `description` state survives all interactions.

### #4 — Slug auto-generation (Major)

Verify the existing `slugManuallyEdited` logic works correctly. Ensure auto-generation produces clean slugs: lowercase, hyphens, strip special chars. e.g., "531 BBB 4-Day" -> "531-bbb-4-day".

### #8 — Day tabs completion status (Major)

Visual indicators on day tab buttons:
- Green dot: day has exercises, all with sets configured
- Orange dot: day has exercises but some lack sets
- No dot: empty day

Check: `day.exercises.length > 0 && day.exercises.every(e => e.sets.length > 0)`

### #9 — Day tabs show custom names (Major)

Tab text changes from "Day 1" to "Day 1: Squat Day" when custom name exists. Truncate with ellipsis for long names.

### #12 — Sticky save button (Minor)

Floating save bar at bottom: `position: sticky; bottom: 1rem;`. Contains Save button and inline validation error summary.

### #13 — Exercise reorder buttons visibility (Minor)

Increase contrast for enabled state. Use admin purple (`#7c3aed`) for enabled arrows, light grey for disabled.

### #16 — Copy sets between exercises (Minor)

"Copy sets from..." dropdown on each exercise card. Lists other exercises with sets configured. Copies sets to current exercise on selection.

### #17 — Delete confirmation (Minor)

`window.confirm()` before deleting exercises that have sets configured. No confirmation for empty exercises.

## Work Unit 3: ProgressionRulesEditor (#5)

**Files:** `ProgressionRulesEditor.tsx`

### #5 — Remove pre-populated empty rule (Major)

Start with zero rules instead of one empty invalid rule. The "+ Add Rule" button is sufficient. New rule defaults: `minReps: 1, maxReps: 5, increase: 2.5`.

## Work Unit 4: Toast notification system (#6, #7)

**Files:** New `ToastContext.tsx`, `Toast.css`; modify `AdminLayout.tsx`, `PlanEditorPage.tsx`

### #6 — Replace alert() dialogs (Major)

Custom toast system (no library):
- `ToastProvider` wraps admin layout, renders fixed-position toast container (bottom-right)
- `useToast()` hook: `{ success(msg), error(msg), warning(msg) }`
- Auto-dismiss after 5s, manual dismiss via X button
- Types: success (green), error (red), warning (orange)
- CSS slide-in from right, fade-out animation

### #7 — Show all validation errors at once (Major)

Replace one-at-a-time `alert()` with:
1. Collect ALL validation errors in one pass
2. Inline error summary at top of form (red border, list of errors)
3. Each error indicates the relevant day (clickable to switch tab)
4. Toast: "Plan has N validation errors"

## Work Unit 5: Navigation blocker (#3)

**Files:** New `UnsavedChangesGuard.tsx`; modify `PlanEditorPage.tsx`

### #3 — Unsaved changes warning (Critical)

- Track `isDirty` state: set true on any form change, reset on successful save
- `beforeunload` event handler when dirty (browser close/refresh)
- React Router `useBlocker` for in-app navigation blocking
- Custom confirmation modal: "You have unsaved changes. Leave without saving?" with Stay/Leave buttons
