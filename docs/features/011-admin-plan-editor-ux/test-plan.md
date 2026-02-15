# Admin Plan Editor — Test Plan

E2E tests (Playwright) covering the admin plan editor. No frontend unit tests per project convention.

## Prerequisites

- Admin user seeded in test DB
- At least one exercise seeded (for exercise picker)
- nSuns default plan seeded (for edit mode tests)

## Test File: `e2e/admin-plan-editor.spec.ts`

---

## 1. Plan creation — happy path

1. Login as admin
2. Navigate to /admin/plans
3. Click "Create Plan"
4. Fill name: "Test Plan", verify slug auto-generates to "test-plan"
5. Set days per week to 3
6. Name Day 1 "Push Day"
7. Verify tab shows "Day 1: Push Day"
8. Add an exercise to Day 1
9. Open set scheme editor, add 3 sets at 65% for 5 reps using bulk-add
10. Verify 3 sets appear with correct values
11. Save plan
12. Verify success toast appears (not alert)
13. Verify plan appears in plan list

## 2. Percentage input — correct conversion

1. Create plan, add exercise to Day 1
2. Open set scheme editor
3. Add a set, type "70" in percentage field
4. Verify field displays "70" (not "7000")
5. Save sets, reopen editor
6. Verify field still shows "70"

## 3. Description field persistence

1. Create plan, fill name and description
2. Add exercise to Day 1, add sets
3. Switch to Day 2 tab, switch back to Day 1
4. Verify description text is still present
5. Save plan, reload page
6. Verify description persists after save

## 4. Unsaved changes warning — browser navigation

1. Create plan, fill in name
2. Attempt to navigate to /admin/plans (via tab click)
3. Verify confirmation modal appears
4. Click "Stay" — verify still on editor
5. Click the Plans tab again, click "Leave"
6. Verify navigation to plan list

## 5. Unsaved changes warning — no warning when clean

1. Create plan, fill all fields, save
2. Navigate away
3. Verify NO confirmation appears

## 6. Validation — all errors shown at once

1. Create a 3-day plan with name and slug
2. Add exercise to Day 1 only (no sets)
3. Leave Day 2 and Day 3 empty
4. Click Save
5. Verify inline error summary shows all errors (exercise has no sets, etc.)
6. Verify NO alert() dialog appears

## 7. Day tab completion indicators

1. Create a 3-day plan
2. Verify all tabs show no completion indicator
3. Add exercise to Day 1 (no sets yet)
4. Verify Day 1 tab shows warning indicator (orange)
5. Add sets to Day 1 exercise
6. Verify Day 1 tab shows complete indicator (green)

## 8. Progression rules — no default empty rule

1. Create new plan
2. Scroll to progression rules section
3. Verify no rules are pre-populated
4. Click "+ Add Rule"
5. Verify new rule has sensible defaults (minReps: 1, maxReps: 5, increase: 2.5)

## 9. Set scheme — bulk add

1. Open set scheme editor for an exercise
2. Enter 5 sets at 50% for 10 reps in quick-add row
3. Click Add
4. Verify 5 sets added, all showing 50% and 10 reps
5. Verify setOrder is sequential (1-5)

## 10. Copy sets between exercises

1. Create plan, add two exercises to Day 1
2. Add sets to Exercise 1 (e.g., 3 sets at 70% for 5 reps)
3. On Exercise 2, use "Copy sets from..." and select Exercise 1
4. Open Exercise 2 set editor
5. Verify sets match Exercise 1

## 11. Delete exercise confirmation

1. Add exercise with configured sets
2. Click delete button
3. Verify confirmation dialog appears
4. Cancel — exercise remains
5. Click delete again, confirm — exercise removed

## 12. Delete exercise — no confirmation when empty

1. Add exercise with no sets
2. Click delete button
3. Verify exercise removed immediately (no confirmation)

## 13. Exercise reorder visibility

1. Add two exercises to a day
2. Verify up/down arrows are visually distinct (not faded) for movable exercises
3. Verify first exercise's up arrow is disabled/dimmed
4. Verify last exercise's down arrow is disabled/dimmed

## 14. Sticky save button

1. Create plan with enough content to scroll
2. Scroll to bottom of page
3. Verify Save button is visible (sticky at bottom)

## 15. Edit existing plan

1. Navigate to nSuns plan in admin
2. Verify all data loads correctly (days, exercises, sets, progression rules)
3. Modify description
4. Save
5. Verify success toast
6. Reload and verify changes persisted

---

## Notes

- All tests use `crypto.randomUUID()` for unique plan names to avoid conflicts
- Tests should clean up created plans (or rely on test DB truncation)
- Check `backend-test.log` if tests fail to find API-level errors
