# API Endpoints

## Public

- `POST /api/auth/register` - `{ email, password, displayName }`
- `POST /api/auth/login` - `{ email, password }` -> `{ accessToken, refreshToken, user }`

## Protected (JWT required)

- `GET /api/users/me` | `PATCH /api/users/me`
- `GET /api/exercises` - all exercises sorted by name: `[{ id, slug, name, category, isUpperBody }]`
- `GET /api/training-maxes` - current TMs (plan-aware: returns TMs for active plan exercises)
- `POST /api/training-maxes/setup` - accepts both `{ oneRepMaxes }` and `{ exerciseTMs: [{ exerciseId, oneRepMax }] }`
- `PATCH /api/training-maxes/:exercise` - manual TM override; accepts `{ weight, reason? }` where `reason` is an optional string (max 500 chars) describing why the TM was changed (e.g. "deload reset", "injury setback")
- `GET /api/training-maxes/:exercise/history`
- `GET /api/progress` - all exercises from active plan with current TMs and full TM history; returns `{ exercises: [{ slug, name, currentTM, history: [{ weight, effectiveDate }] }], planSwitches: [{ date, planName }] }` (empty arrays if no active plan; `planSwitches` contains one entry per plan subscription after the first, representing each plan switch)
- `POST /api/workouts` - `{ dayNumber }` -> generates sets from active plan + TMs
- `POST /api/workouts/custom` - `{ date: "YYYY-MM-DD", exercises: [{ exerciseId, sets: [{ weight, reps }] }] }` -> creates a custom completed workout; returns workout with `isCustom: true`. **Must be registered before `/:id` routes in Express.**
- `GET /api/workouts/current` - in-progress workout (or null)
- `GET /api/workouts/:id` - includes `progressions` array (TM changes linked to this workout)
- `PATCH /api/workouts/:id/sets/:setId` - `{ actualReps, completed }`
- `POST /api/workouts/:id/complete` - applies progression, returns `{ progressions: [...] }`
- `DELETE /api/workouts/:id` - soft-delete (sets status to 'discarded'), works on both in_progress and completed workouts
- `GET /api/workouts/history?page=1&limit=10`
- `GET /api/workouts/calendar?year=2026&month=2` - calendar view (must be before /:id route); returns `{ workouts: [...], scheduledDays: [{ date: string, dayNumber: number, planDayName: string | null }] }` where `scheduledDays` contains projected dates for the active plan's schedule (dates already occupied by any workout record are excluded)

## Schedule Endpoints (JWT required)

- `GET /api/schedule` - returns `{ schedule: [{ dayNumber, weekday }] }` for active plan; empty array if no active plan
- `PUT /api/schedule` - `{ schedule: [{ dayNumber, weekday }] }` — atomically replaces all schedule rows for the active plan; validates weekday 0–6, dayNumber ≤ plan.daysPerWeek, no duplicate dayNumbers; empty array clears schedule

## Plan Endpoints (JWT required)

- `GET /api/plans` - list public, non-archived plans
- `GET /api/plans/current` - user's active plan (or null)
- `GET /api/plans/:id` - plan detail with full nested structure
- `POST /api/plans/:id/subscribe` - subscribe to plan, returns `{ userPlan, requiredExercises, missingTMs }`

## Social Endpoints (JWT required)

- `POST /api/social/request` - `{ email }` — send friend request; 404 if email not found, 400 if self-friending, 409 if relationship already exists; inserts with canonical ordering (`requesterId = min(callerId, targetId)`)
- `GET /api/social/friends` - list accepted friends: `{ friends: [{ id, userId, displayName }] }`
- `GET /api/social/requests` - list pending friend requests involving the caller: `{ requests: [{ id, requesterId, displayName }] }`
- `PATCH /api/social/requests/:id/accept` - accept a pending request; returns `{ id, status }`
- `PATCH /api/social/requests/:id/decline` - decline a pending request; returns `{ id, status }`
- `DELETE /api/social/friends/:id` - remove a friend (sets status to `'removed'`); returns `{ id, status }`
- `GET /api/social/feed` - last 20 feed events from confirmed friends ordered by `createdAt DESC`; returns `{ events: [{ id, userId, displayName, eventType, payload, createdAt }] }`
- `GET /api/social/leaderboard` - TM rankings across caller and accepted friends for each exercise in active plan; returns `{ exercises: [{ slug, name, rankings: [{ userId, displayName, weight }] }] }`; returns `{ exercises: [] }` if no active plan

## Achievement Endpoints (JWT required)

- `GET /api/achievements` - returns full list of achievements joined with user's unlocked rows: `{ achievements: [{ slug, name, description, unlockedAt: string | null, workoutId: number | null }] }`. All 4 achievement definitions are always returned; `unlockedAt` and `workoutId` are `null` for locked badges.

## Admin Endpoints (JWT + isAdmin required)

- `GET/POST /api/admin/exercises` - list/create exercises
- `PATCH/DELETE /api/admin/exercises/:id` - update/delete exercises (delete fails if referenced by a plan)
- `GET/POST /api/admin/plans` - list/create plans (full nested structure in one transaction)
- `GET/PUT/DELETE /api/admin/plans/:id` - get/update/archive plans (system plans cannot be archived)
- `POST /api/admin/plans/:id/progression-rules` - replace progression rules for a plan
