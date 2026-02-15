# ConfirmDialog UX Review

## Context
Reviewed the ConfirmDialog component (added in commit 7684f27) at iPhone Pro viewport (393x852). Both danger variant ("Cancel Workout", "Complete Anyway") and default variant dialogs were inspected visually and via computed styles.

## Findings

### Critical: `--text-primary` CSS variable is undefined

**Files:** `frontend/src/styles/global.css`

The ConfirmDialog CSS (and 40+ other CSS files) reference `var(--text-primary)`, but this variable is **never defined** in `global.css`. The project only defines `--text: #1e293b`.

**Why it matters:** On most elements this is invisible because they inherit `color` from `body` (which uses `var(--text)`). But inside `<dialog>` elements, the browser applies its own user-agent color (`#000000` black), so the fallback is pure black instead of the project's slate-800 (`#1e293b`). This affects:
- ConfirmDialog title and message text
- ConflictDialog title and message text
- Any other dialog/modal content using `--text-primary`

**Fix:** Add `--text-primary: #1e293b;` to `:root` in `global.css`:

```css
:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --success: #16a34a;
  --danger: #dc2626;
  --muted: #94a3b8;
  --bg: #f8fafc;
  --bg-card: #ffffff;
  --text: #1e293b;
  --text-primary: #1e293b;   /* <-- add this */
  --text-muted: #64748b;
  --border: #e2e8f0;
  /* ... */
}
```

### What's good

- Uses native `<dialog>` with `showModal()` correctly
- Backdrop overlay via `::backdrop` (no JS reimplementation)
- Touch targets are 48px (3rem) minimum on all buttons
- Full-width stacked buttons work well on mobile
- No horizontal overflow
- Danger variant color (`--danger: #dc2626`) is correct and visually clear
- Content width (90% / max 25rem) is appropriate for mobile
- `close` event listener properly syncs parent state on Escape key

## Verification
After fixing, open a workout and trigger both "Cancel Workout" and "Complete Workout" (without AMRAP reps) dialogs. Verify that:
1. Title text color is `#1e293b` (not `#000000`)
2. Message text color is `#1e293b` (not `#000000`)
3. Both colors match the rest of the app's text
