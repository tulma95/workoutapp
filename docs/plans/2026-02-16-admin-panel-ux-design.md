# Admin Panel UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix mobile UX issues in the admin panel found during iPhone Pro (393x852) viewport review.

**Architecture:** CSS-only changes with minor TSX label additions. All changes are mobile-responsive improvements, primarily behind `@media (max-width: 768px)`. No backend, no new components, no API changes.

**Tech Stack:** CSS, React TSX (minor label additions only)

---

### Task 1: ProgressionRulesEditor — Convert px to rem + bump touch targets

**Files:**
- Modify: `frontend/src/components/ProgressionRulesEditor.css:1-154`

**Step 1: Convert all px values to rem and bump touch targets**

Replace the entire `ProgressionRulesEditor.css` with rem units. Key conversions:
- `32px` → `2rem`, `20px` → `1.25rem`, `16px` → `1rem`, `12px` → `0.75rem`, `8px` → `0.5rem`, `4px` → `0.25rem`
- `font-size: 18px` → `1.125rem`, `14px` → `0.875rem`, `13px` → `0.8125rem`
- `min-height: 40px` on `.btn-add-rule` → `2.75rem` (44px)
- `min-height: 32px` / `min-width: 32px` on `.btn-remove-rule` → `2.75rem`
- `border-radius: 12px` → `0.75rem`, `8px` → `0.5rem`, `6px` → `0.375rem`
- Keep `border: 1px`, `border: 2px`, `border: 3px` as px (project convention)

```css
.progression-rules-editor {
  margin-top: 2rem;
  padding: 1.25rem;
  background: var(--bg-card);
  border-radius: 0.75rem;
}

.progression-rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.progression-rules-header h3 {
  margin: 0;
  font-size: 1.125rem;
  color: var(--text-primary);
}

.btn-add-rule {
  background: var(--primary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  min-height: 2.75rem;
}

.btn-add-rule:hover {
  opacity: 0.9;
}

.progression-rules-table-wrapper {
  overflow-x: auto;
  margin-bottom: 1rem;
}

.progression-rules-table {
  width: 100%;
  border-collapse: collapse;
}

.progression-rules-table th {
  text-align: left;
  padding: 0.75rem;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  border-bottom: 2px solid var(--border);
}

.progression-rules-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.progression-rules-table tr:last-child td {
  border-bottom: none;
}

.target-select,
.reps-input,
.increase-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.target-select {
  min-width: 12.5rem;
}

.reps-input,
.increase-input {
  text-align: center;
  max-width: 6.25rem;
}

.btn-remove-rule {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.125rem;
  padding: 0.25rem 0.5rem;
  min-height: 2.75rem;
  min-width: 2.75rem;
}

.btn-remove-rule:hover {
  opacity: 0.7;
}

.progression-rules-empty {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.progression-rules-info {
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  border-left: 3px solid var(--primary);
}

.progression-rules-info p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.progression-rules-info strong {
  color: var(--text-primary);
}
```

Mobile breakpoint will be added in Task 2.

**Step 2: Verify the file has no px values except borders**

Grep the file for `px` — only `1px`, `2px`, `3px` border widths should remain.

**Step 3: Commit**

```bash
git add frontend/src/components/ProgressionRulesEditor.css
git commit -m "fix: convert ProgressionRulesEditor.css from px to rem units"
```

---

### Task 2: ProgressionRulesEditor — Mobile card layout

**Files:**
- Modify: `frontend/src/components/ProgressionRulesEditor.tsx:96-187` (add label spans for mobile)
- Modify: `frontend/src/components/ProgressionRulesEditor.css` (add mobile card layout)

**Step 1: Add inline label spans to TSX**

In each `<td>` for the number inputs, add a `<span className="mobile-label">` before the input. These will be hidden on desktop via CSS and shown on mobile. Also wrap the delete button td content.

For the min reps td (line ~139-148):
```tsx
<td>
  <span className="mobile-label">Min Reps</span>
  <input ... />
</td>
```

For the max reps td (line ~150-159):
```tsx
<td>
  <span className="mobile-label">Max Reps</span>
  <input ... />
</td>
```

For the increase td (line ~161-172):
```tsx
<td>
  <span className="mobile-label">TM Increase (kg)</span>
  <input ... />
</td>
```

**Step 2: Add mobile card CSS**

Append to `ProgressionRulesEditor.css`:

```css
/* Hidden on desktop, shown on mobile */
.mobile-label {
  display: none;
}

/* Mobile: card layout */
@media (max-width: 768px) {
  .progression-rules-table thead {
    display: none;
  }

  .progression-rules-table,
  .progression-rules-table tbody {
    display: block;
  }

  .progression-rules-table tr {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--border);
  }

  .progression-rules-table td {
    padding: 0;
    border-bottom: none;
  }

  .target-select {
    min-width: unset;
    width: 100%;
    min-height: 2.75rem;
  }

  .mobile-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  /* Inline row for the 3 number inputs */
  .progression-rules-table tr td:nth-child(2),
  .progression-rules-table tr td:nth-child(3),
  .progression-rules-table tr td:nth-child(4) {
    display: inline-block;
    width: calc(33.33% - 0.375rem);
  }

  /* Make a visual row for the 3 inputs */
  .progression-rules-table tr {
    flex-flow: row wrap;
  }

  /* Target select: full width */
  .progression-rules-table tr td:first-child {
    width: 100%;
  }

  /* Delete button: full width, align right */
  .progression-rules-table tr td:last-child {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }

  .reps-input,
  .increase-input {
    max-width: none;
    width: 100%;
    min-height: 2.75rem;
  }

  .btn-add-rule {
    font-size: 0.8125rem;
    padding: 0.375rem 0.75rem;
    width: 100%;
  }

  .progression-rules-table-wrapper {
    overflow-x: visible;
  }
}
```

**Step 3: Verify at 393px — no horizontal scroll, delete visible, inputs readable**

Run: open browser at 393px viewport, navigate to `/admin/plans/1`, scroll to Progression Rules section.

**Step 4: Commit**

```bash
git add frontend/src/components/ProgressionRulesEditor.tsx frontend/src/components/ProgressionRulesEditor.css
git commit -m "fix: mobile card layout for progression rules editor"
```

---

### Task 3: PlanEditorPage — Exercise row action button touch targets

**Files:**
- Modify: `frontend/src/styles/PlanEditorPage.css:336-347`

**Step 1: Bump touch target sizes**

Change `.exercise-row-actions button` (line 336-347):

```css
/* Before */
  min-height: 32px;
  min-width: 32px;

/* After */
  min-height: 2.75rem;
  min-width: 2.75rem;
```

**Step 2: Commit**

```bash
git add frontend/src/styles/PlanEditorPage.css
git commit -m "fix: bump exercise row action buttons to 44px touch targets"
```

---

### Task 4: PlanEditorPage — Stack exercise sets info on mobile

**Files:**
- Modify: `frontend/src/styles/PlanEditorPage.css:688-712` (add to mobile media query)

**Step 1: Add mobile stacking rules inside existing `@media (max-width: 768px)` block**

Add these rules inside the existing media query (after line 711):

```css
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
```

**Step 2: Commit**

```bash
git add frontend/src/styles/PlanEditorPage.css
git commit -m "fix: stack exercise sets info vertically on mobile"
```

---

### Task 5: SetSchemeEditorModal — Footer button heights

**Files:**
- Modify: `frontend/src/components/SetSchemeEditorModal.css:171-200`

**Step 1: Bump footer button min-heights**

Change `.btn-add-set` (line 179):
```css
/* Before */
  min-height: 40px;
/* After */
  min-height: 2.75rem;
```

Change `.btn-cancel, .btn-save` (line 198):
```css
/* Before */
  min-height: 40px;
/* After */
  min-height: 2.75rem;
```

**Step 2: Commit**

```bash
git add frontend/src/components/SetSchemeEditorModal.css
git commit -m "fix: bump set scheme editor footer buttons to 44px touch targets"
```

---

### Task 6: Visual verification

**Step 1: Start dev servers if not running**

```bash
./start_local_env.sh
```

**Step 2: Open browser and verify at 393px viewport**

Navigate to `/admin/plans/1` and check:
1. Progression rules: no horizontal scroll, card layout on mobile, delete buttons visible
2. Exercise row ↑/↓/🗑️ buttons are 44px touch targets
3. Exercise sets info stacks vertically, "Copy sets from..." dropdown is readable
4. Open Set Scheme Editor — footer buttons are 44px tall
5. No horizontal overflow: `document.documentElement.scrollWidth <= 393`

**Step 3: Test at desktop width too — ensure no regressions**

All mobile changes are behind `@media (max-width: 768px)`, desktop should be unchanged.
