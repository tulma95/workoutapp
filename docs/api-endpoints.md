# API Endpoints

## Public

- `POST /api/auth/register` - `{ email, password, displayName }`
- `POST /api/auth/login` - `{ email, password }` -> `{ accessToken, refreshToken, user }`

## Protected (JWT required)

- `GET /api/users/me` | `PATCH /api/users/me`
- `GET /api/training-maxes` - current TMs (plan-aware: returns TMs for active plan exercises)
- `POST /api/training-maxes/setup` - accepts both `{ oneRepMaxes }` and `{ exerciseTMs: [{ exerciseId, oneRepMax }] }`
- `PATCH /api/training-maxes/:exercise` - manual TM override
- `GET /api/training-maxes/:exercise/history`
- `POST /api/workouts` - `{ dayNumber }` -> generates sets from active plan + TMs
- `GET /api/workouts/current` - in-progress workout (or null)
- `GET /api/workouts/:id`
- `PATCH /api/workouts/:id/sets/:setId` - `{ actualReps, completed }`
- `POST /api/workouts/:id/complete` - applies progression, returns `{ progressions: [...] }`
- `DELETE /api/workouts/:id` - soft-delete (sets status to 'discarded')
- `GET /api/workouts/history?page=1&limit=10`
- `GET /api/workouts/calendar?year=2026&month=2` - calendar view (must be before /:id route)

## Plan Endpoints (JWT required)

- `GET /api/plans` - list public, non-archived plans
- `GET /api/plans/current` - user's active plan (or null)
- `GET /api/plans/:id` - plan detail with full nested structure
- `POST /api/plans/:id/subscribe` - subscribe to plan, returns `{ userPlan, requiredExercises, missingTMs }`

## Admin Endpoints (JWT + isAdmin required)

- `GET/POST /api/admin/exercises` - list/create exercises
- `PATCH/DELETE /api/admin/exercises/:id` - update/delete exercises (delete fails if referenced by a plan)
- `GET/POST /api/admin/plans` - list/create plans (full nested structure in one transaction)
- `GET/PUT/DELETE /api/admin/plans/:id` - get/update/archive plans (system plans cannot be archived)
- `POST /api/admin/plans/:id/progression-rules` - replace progression rules for a plan
