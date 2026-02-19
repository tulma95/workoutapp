# Database Schema

## Core Tables

- **users**: `id, email (unique), password_hash, display_name, is_admin (default false), created_at, updated_at`
- **exercises**: `id, name, slug (unique), category, is_compound, is_upper_body, created_at, updated_at`
- **training_maxes** (append-only): `id, user_id (FK), exercise_id (FK exercises), workout_id (FK workouts, nullable), weight (kg), previous_weight (kg, nullable), effective_date, reason (TEXT, nullable), created_at` - Unique constraint: (user_id, exercise_id, effective_date). `workout_id` links progression TM changes to the workout that caused them. `previous_weight` stores the TM before the increase. `reason` is set only on manual overrides (auto-progression rows leave it null).
- **workouts**: `id, user_id (FK), day_number, plan_day_id (FK plan_days), status ('in_progress'/'completed'/'discarded'), completed_at, created_at` — Index: (user_id, status) optimizes `getCurrentWorkout` (`WHERE user_id AND status = 'in_progress'`) and `getHistory` (`WHERE user_id AND status = 'completed'`). Calendar queries (`WHERE user_id AND status != 'discarded'`) benefit only from the user_id prefix since PostgreSQL cannot use a `!=` predicate as an index range scan on the status column.
- **workout_sets**: `id, workout_id (FK CASCADE), exercise, exercise_id (FK exercises), exercise_order (Int), set_order, prescribed_weight (kg), prescribed_reps, is_amrap, is_progression, actual_reps (nullable), completed, created_at`

## Plan Tables

- **workout_plans**: `id, name, slug (unique), description, days_per_week, is_public, is_system, archived_at, created_at, updated_at`
- **plan_days**: `id, plan_id (FK CASCADE), day_number, name` - Unique: (plan_id, day_number)
- **plan_day_exercises**: `id, plan_day_id (FK CASCADE), exercise_id (FK), tm_exercise_id (FK), display_name, sort_order`
- **plan_sets**: `id, plan_day_exercise_id (FK CASCADE), set_order, percentage (Decimal 5,4), reps, is_amrap, is_progression`
- **plan_progression_rules**: `id, plan_id (FK CASCADE), exercise_id (FK, nullable), category ('upper'/'lower', nullable), min_reps, max_reps, increase_amount (kg)`
- **user_plans**: `id, user_id (FK), plan_id (FK CASCADE), is_active, started_at, ended_at` — Index: (user_id) optimizes active plan lookups (`WHERE user_id AND is_active = true`).
- **user_plan_schedules**: `id, user_plan_id (FK user_plans CASCADE), day_number, weekday (0=Sun…6=Sat), created_at` — Unique: (user_plan_id, day_number). Stores which weekday each plan day is scheduled on. Rows are delete-and-recreated on every save (no updatedAt).

## Social Tables

- **friendships**: `id, requester_id (FK users), addressee_id (FK users), status (TEXT default 'pending'), created_at, updated_at` — Unique: (requester_id, addressee_id). Indexes: (requester_id), (addressee_id). CHECK constraint `requester_id < addressee_id` enforces canonical ordering (lower user ID is always stored as requester_id). Status values: `'pending'`, `'accepted'`, `'declined'`, `'removed'`. Application code must normalise by assigning `min(callerId, targetId)` → requester_id when inserting.
- **feed_events**: `id, user_id (FK users — the actor), event_type (TEXT), payload (JSONB), created_at` — Index: (user_id, created_at) for efficient feed queries. `event_type` values: `'workout_completed'` (payload: `{ workoutId, dayNumber }`), `'tm_increased'` (payload: `{ exerciseSlug, exerciseName, newTM, increase }`).
