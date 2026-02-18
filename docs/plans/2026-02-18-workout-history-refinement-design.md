# Workout History Refinement — Design

## Problem

The current history workout detail view has poor readability: completed and incomplete sets look nearly identical (only a subtle checkmark difference), 17 set rows create excessive vertical scroll, progression info is buried/wrong, and there's no way to delete old workouts.

## Design

### Workout Detail Card (redesigned)

**Header**: "Day 1 - Bench Press" + date + completion summary (e.g. "13/17 sets")

**Set rows per exercise** — reuse active workout's visual language:
- **Green tint** (`rgba(22, 163, 74, 0.1)`) — completed at or above prescribed reps
- **Orange tint** (`rgba(234, 146, 22, 0.15)`) — completed but under prescribed reps
- **No tint** (plain background) — not completed

**Progression banner** — shown per exercise, prominently: "Bench Press: 80 -> 85 kg (+5)". Only shown when there IS a progression (remove "No TM change" text).

**Delete button** — bottom of detail card, muted red style, triggers native `<dialog>` confirmation.

### Multi-workout Days

When a calendar day has multiple workouts:
- Calendar badge shows count (already works)
- Tapping the day shows a **picker list** of workouts (e.g. "Day 1 - Bench Press", "Day 3 - Bench Heavy")
- Tapping a workout in the picker shows its detail

### Backend Changes

- Extend `DELETE /api/workouts/:id` to allow soft-deleting `completed` workouts (currently only `in_progress`)
- Same soft-delete pattern: status -> `discarded`
- No TM rollback — progressions from deleted workouts are preserved

### Calendar API

- Already returns `dayNumber` per workout — used for count badge and picker
- Picker derives label from dayNumber (maps to plan day info)

## Colors

Reuse existing set row colors from `SetRow.module.css`:
- Green: `rgba(22, 163, 74, 0.1)`
- Orange: `rgba(234, 146, 22, 0.15)`
