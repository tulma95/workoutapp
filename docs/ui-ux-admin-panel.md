# Admin Panel UX Improvements

## Context
Reviewed the admin panel at iPhone Pro viewport (393x852): Exercise List, ExerciseFormModal, PlanEditorPage (exercise cards, day tabs, set scheme editor, progression rules). The Exercise List page and ExerciseFormModal are solid. The Set Scheme Editor modal is clean and fits the viewport well. The main issues are in the PlanEditorPage exercise cards and Progression Rules table.

## Changes

### 1. [Critical] Progression Rules: delete buttons hidden by horizontal overflow
**Files:** `frontend/src/components/ProgressionRulesEditor.tsx`, `frontend/src/components/ProgressionRulesEditor.css`

The progression rules table overflows horizontally on mobile (scrollWidth 334 > clientWidth 289). The delete buttons in the last column are completely hidden — users must side-scroll to find them. The table layout doesn't work at 393px with `min-width: 140px` on the target select + 3 number inputs + delete button.

**Fix:** Switch from table layout to stacked card layout on mobile:
- Add a `@media (max-width: 768px)` rule that hides the `<thead>` and displays each `<tr>` as a block/card
- Each card shows: target select (full width), then a row of 3 number inputs (min/max/increase) with inline labels, then a delete button
- This eliminates horizontal scroll entirely
- Alternative simpler fix: reduce `target-select` `min-width` to `120px` on mobile AND move the delete button outside the table as a row action

### 2. [Critical] Exercise row action buttons too small for touch
**Files:** `frontend/src/styles/PlanEditorPage.css`

The move up (↑), move down (↓), and delete (🗑️) buttons on exercise cards are 32x32px — well below the 44px minimum touch target. Users will struggle to tap these accurately.

**Fix:**
- `.exercise-row-actions button`: change `min-height: 32px` and `min-width: 32px` to `min-height: 2.75rem` (44px) and `min-width: 2.75rem`

### 3. [Improvement] Exercise sets info row is cramped on mobile
**Files:** `frontend/src/styles/PlanEditorPage.css`

The `.exercise-sets-info` area tries to fit the set summary text, "Edit Sets" button, and "Copy sets from..." dropdown all on one line. On mobile the "Copy sets from..." dropdown squishes to 45px wide (unreadable/unusable) and the set summary wraps to 3 lines.

**Fix:** Stack the sets info vertically on mobile:
```css
@media (max-width: 768px) {
  .exercise-sets-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .exercise-sets-actions {
    width: 100%;
  }

  .btn-edit-sets {
    flex: 1;
  }

  .copy-sets-select {
    flex: 1;
    min-height: 2.75rem;
  }
}
```

### 4. [Improvement] ProgressionRulesEditor uses px units instead of rem
**Files:** `frontend/src/components/ProgressionRulesEditor.css`

The file uses `px` values throughout (e.g., `padding: 20px`, `margin-bottom: 16px`, `font-size: 18px`, `min-height: 40px`). Project convention is `rem` units on 8-point grid, with px only for borders.

**Fix:** Convert all px values to rem equivalents (16px = 1rem baseline):
- `32px` → `2rem`, `20px` → `1.25rem`, `16px` → `1rem`, `12px` → `0.75rem`, `8px` → `0.5rem`, `4px` → `0.25rem`
- `font-size: 18px` → `1.125rem`, `14px` → `0.875rem`, `13px` → `0.8125rem`
- `min-height: 40px` → `2.75rem` (bump to 44px / 2.75rem to meet touch target)
- `min-height: 32px` / `min-width: 32px` on `.btn-remove-rule` → `2.75rem` (44px touch target)

### 5. [Convention] Set Scheme Editor footer buttons below 44px touch target
**Files:** `frontend/src/components/SetSchemeEditorModal.css`

`.btn-add-set`, `.btn-cancel`, `.btn-save` all have `min-height: 40px` — 4px below the 44px (2.75rem) project minimum.

**Fix:** Change `min-height: 40px` to `min-height: 2.75rem` on:
- `.btn-add-set`
- `.btn-cancel, .btn-save`

## Verification
1. Navigate to `/admin/plans/1` at 393px viewport
2. Confirm progression rules section has no horizontal scroll and delete buttons are visible
3. Confirm exercise row ↑/↓/🗑️ buttons are 44px touch targets
4. Confirm exercise sets info stacks vertically with readable "Copy sets from..." dropdown
5. Open Set Scheme Editor modal — confirm footer buttons are 44px tall
6. Check that no horizontal overflow exists on any admin page: `document.documentElement.scrollWidth <= 393`
