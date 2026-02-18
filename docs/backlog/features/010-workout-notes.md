# Feature: Workout Notes

**Priority**: Low-Medium
**Effort**: Low (3-4 hours)
**Impact**: Quality of life, helps users remember context

## Problem

Users can't record notes about their workouts (e.g., "Left shoulder felt tight", "Switched to close grip for last 2 sets", "Gym was crowded, had to wait for rack"). This context is valuable when reviewing history and troubleshooting stalls.

## Solution

Optional free-text notes field on workouts, editable during and after the session.

## User Experience

1. During workout: "Add note" link at bottom of workout page
2. Tapping opens a text area (max 500 chars)
3. Auto-saves on blur/debounce
4. In history: Notes shown in workout detail view

## Technical Design

### Database

Add `notes` column to `workouts` table:
```sql
ALTER TABLE workouts ADD COLUMN notes TEXT;
```

### Backend

Update existing endpoints:
- `PATCH /api/workouts/:id` - Accept `{ notes: string }` (new endpoint or extend set update)
- `GET /api/workouts/:id` - Include notes in response
- `GET /api/workouts/history` - Include notes in response

### Frontend

- Add text area to WorkoutPage (collapsed by default, "Add note" link)
- Show notes in WorkoutDetail component on History page
- Auto-save with 1-second debounce

## Testing

- E2E: Add note during workout, verify it appears in history
- Backend: Notes saved and returned in workout responses
