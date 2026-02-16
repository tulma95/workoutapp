# Admin Panel UX Improvements — Design

## Summary

CSS-focused mobile UX fixes for the admin panel, addressing issues found during iPhone Pro (393x852) viewport review. 5 changes across 3 files. No backend changes, no new components.

## Changes

### 1. Progression Rules: Card Layout on Mobile (Critical)
**Files:** `ProgressionRulesEditor.tsx`, `ProgressionRulesEditor.css`

Replace table layout with stacked cards on mobile (`@media (max-width: 768px)`):
- Hide `<thead>`, display each `<tr>` as a block card
- Card layout: target select (full width) → flex row of 3 number inputs with inline labels → delete button
- Eliminates horizontal scroll entirely
- Minor TSX changes for mobile-visible labels/aria attributes

### 2. Exercise Row Action Buttons: Touch Targets (Critical)
**Files:** `PlanEditorPage.css`

`.exercise-row-actions button`: change `min-height: 32px` / `min-width: 32px` → `min-height: 2.75rem` / `min-width: 2.75rem` (44px)

### 3. Exercise Sets Info: Stack on Mobile (Improvement)
**Files:** `PlanEditorPage.css`

At `@media (max-width: 768px)`: stack `.exercise-sets-info` vertically, make `.copy-sets-select` and `.btn-edit-sets` full-width with `flex: 1` and `min-height: 2.75rem`.

### 4. ProgressionRulesEditor: px → rem Conversion (Improvement)
**Files:** `ProgressionRulesEditor.css`

Convert all px values to rem (bundled with change #1 since same file). Bump touch targets to 2.75rem minimum.

### 5. Set Scheme Editor: Footer Button Heights (Convention)
**Files:** `SetSchemeEditorModal.css`

`.btn-add-set`, `.btn-cancel`, `.btn-save`: `min-height: 40px` → `min-height: 2.75rem`

## Verification

1. Navigate to `/admin/plans/1` at 393px viewport
2. Progression rules: no horizontal scroll, delete buttons visible, card layout
3. Exercise row ↑/↓/🗑️ buttons are 44px touch targets
4. Exercise sets info stacks vertically, "Copy sets from..." dropdown readable
5. Set Scheme Editor footer buttons are 44px tall
6. No horizontal overflow: `document.documentElement.scrollWidth <= 393`
