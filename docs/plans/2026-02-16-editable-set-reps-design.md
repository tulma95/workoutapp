# Editable Set Reps Design

## Problem

Workout sets use a binary checkbox for regular sets and a +/- stepper only for AMRAP sets. Sets marked `isProgression: true` but `isAmrap: false` have no way to enter actual reps, blocking TM progression. Users also can't record partial reps on regular sets, losing training history data.

## UX Design

### Regular Sets (not AMRAP)

1. **Pending**: Shows weight, "x5", and a "Confirm" button.
2. **Confirmed**: Button becomes `[- 5 +]` stepper pre-filled with prescribed reps, plus a checkmark. Green background.
3. **Edited down**: Tapping `-` decreases reps. Amber background indicates partial completion. Shows "target: 5" hint.
4. **Undo**: Tapping checkmark resets to pending state (`actualReps: null, completed: false`).
5. **Cap**: Cannot exceed prescribed reps on non-AMRAP sets.

### AMRAP Sets (isAmrap: true)

- Stepper shows immediately (no confirm step) to preserve visual distinction as "money sets."
- Can exceed prescribed reps (no cap).
- Label shows "x5+" to indicate AMRAP.

### Completion Flow

- "Missing Progression Reps" dialog fires when any `isProgression` set has `actualReps === null` (unconfirmed).
- With this UX it only triggers if user skips confirming a progression set entirely.

## Components

| Component | Change |
|-----------|--------|
| `SetRow` | Replace checkbox with Confirm button. After confirm, show stepper + checkmark undo button. |
| `AmrapInput` → `RepsInput` | Rename. Add `isAmrap` prop to cap reps at prescribed max for non-AMRAP sets. |
| Workout page route | New handlers: `handleConfirmSet`, `handleRepsChange`, `handleUndoSet`. Add per-set debounce (300ms) on PATCH calls. |
| `WorkoutDetail` | Show "(X done)" only when `actualReps !== null`. Old data (`completed=true, actualReps=null`) shows checkmark only. |

## Backend

One fix in `workouts.ts`:

```typescript
// Before
actualReps: z.number().int().min(0).optional()

// After
actualReps: z.number().int().min(0).nullable().optional()
```

And in `workout.service.ts` `logSet`, pass `null` through to Prisma update (currently only handles `number | undefined`).

## No DB/Schema Changes

`workout_sets.actualReps` is already `Int?` (nullable). No migration needed.

## Debounce

Trailing debounce (300ms) per set ID on PATCH calls. Optimistic UI updates immediately; API calls are batched. Prevents race conditions from rapid +/- tapping.

## Visual States (CSS)

- **Pending**: Default `--bg-card` background
- **Completed** (full reps): Green tint `rgba(22, 163, 74, 0.1)` (existing)
- **Edited** (partial reps): Amber tint `rgba(251, 146, 60, 0.1)` (new)
