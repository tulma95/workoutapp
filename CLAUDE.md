# Workout Tracker (Plan-Driven)

## Project Overview

A workout tracking application supporting configurable training plans. Ships with nSuns 4-Day LP as the default plan. Users register, subscribe to a plan, enter 1 Rep Maxes for the plan's exercises, and the app generates workouts with auto-calculated weights. Training maxes update automatically based on AMRAP performance and plan-specific progression rules.

## Tech Stack

- **Backend**: Express.js + TypeScript, Prisma v7 (ORM + migrations), bcrypt + jsonwebtoken, zod, vitest + supertest
- **Frontend**: React + TypeScript, Vite, TanStack Router + React Query, CSS Modules with rem units
- **E2E**: Playwright (parallel execution, 4 workers dev / 2 CI)
- **Database**: PostgreSQL latest (Dockerized via docker-compose)
- **Package manager**: npm workspaces (monorepo: `backend/`, `frontend/`)
- **Node**: v22 (`.nvmrc`)

## Architecture

- Monorepo with npm workspaces
- Backend on port 3001, frontend Vite dev server on 5173 with `/api` proxy
- JWT auth (`accessToken` in localStorage, `Authorization: Bearer` header)
- All weights in **kg** (no unit conversion)
- Training maxes are **append-only** rows (latest `effective_date` = current TM, older rows = history)
- **Plan-driven**: All workout generation and progression requires an active plan subscription (no hardcoded fallback)
- **Environment variables**: Exported by shell scripts (`start_local_env.sh`, `run_test.sh`), never loaded from .env files. Backend reads `process.env` directly without dotenv.

## Plan System

### How Plans Work

- **WorkoutPlan** defines the program: name, slug, days per week, system flag
- **PlanDay** defines each training day with exercises
- **PlanDayExercise** links exercises to days with display name, TM exercise reference, sort order
- **PlanSet** defines set schemes: percentage, reps, isAmrap, isProgression per exercise per day
- **PlanProgressionRule** defines TM increases: minReps/maxReps ranges with increase amounts, can be exercise-specific or category-based (upper/lower)
- **UserPlan** tracks user subscriptions with isActive flag

### User Flow

Register -> Dashboard -> /select-plan redirect -> subscribe to plan -> /setup (if missing TMs) -> Dashboard -> start workouts

### Progression

- Each plan defines its own progression rules (not hardcoded)
- Progression sets marked with `isProgression: true` in PlanSet
- Rule matching: exercise-specific rule takes precedence over category-based ('upper'/'lower')
- Category determined by `exercise.isUpperBody`: true = 'upper', false = 'lower'
- Completing a workout can produce multiple progressions (one per progression set)

## Default nSuns 4-Day LP Plan

Seeded via `backend/prisma/seed.ts`. 4 lifts tracked: Bench, Squat, OHP, Deadlift. TM = 90% of 1RM.

| Day | Primary (9 sets)        | Secondary (8 sets)                   |
| --- | ----------------------- | ------------------------------------ |
| 1   | Bench Volume (Bench TM) | OHP (OHP TM, 50-70%)                |
| 2   | Squat (Squat TM)        | Sumo Deadlift (Deadlift TM, 50-70%) |
| 3   | Bench Heavy (Bench TM)  | Close Grip Bench (Bench TM, 40-60%) |
| 4   | Deadlift (Deadlift TM)  | Front Squat (Squat TM, 35-55%)      |

### Weight Rounding

Round calculated weights to nearest **2.5 kg**.

## Database Schema

### Core Tables

- **users**: `id, email (unique), password_hash, display_name, is_admin (default false), created_at, updated_at`
- **exercises**: `id, name, slug (unique), category, is_compound, is_upper_body, created_at, updated_at`
- **training_maxes** (append-only): `id, user_id (FK), exercise, exercise_id (FK exercises), weight (kg), effective_date, created_at` - Unique constraint: (user_id, exercise, effective_date)
- **workouts**: `id, user_id (FK), day_number, plan_day_id (FK plan_days), status ('in_progress'/'completed'/'discarded'), completed_at, created_at`
- **workout_sets**: `id, workout_id (FK CASCADE), exercise, exercise_id (FK exercises), exercise_order (Int), set_order, prescribed_weight (kg), prescribed_reps, is_amrap, is_progression, actual_reps (nullable), completed, created_at`

### Plan Tables

- **workout_plans**: `id, name, slug (unique), description, days_per_week, is_public, is_system, archived_at, created_at, updated_at`
- **plan_days**: `id, plan_id (FK CASCADE), day_number, name` - Unique: (plan_id, day_number)
- **plan_day_exercises**: `id, plan_day_id (FK CASCADE), exercise_id (FK), tm_exercise_id (FK), display_name, sort_order`
- **plan_sets**: `id, plan_day_exercise_id (FK CASCADE), set_order, percentage (Decimal 5,4), reps, is_amrap, is_progression`
- **plan_progression_rules**: `id, plan_id (FK CASCADE), exercise_id (FK, nullable), category ('upper'/'lower', nullable), min_reps, max_reps, increase_amount (kg)`
- **user_plans**: `id, user_id (FK), plan_id (FK CASCADE), is_active, started_at, ended_at`

## API Endpoints

### Public

- `POST /api/auth/register` - `{ email, password, displayName }`
- `POST /api/auth/login` - `{ email, password }` -> `{ accessToken, refreshToken, user }`

### Protected (JWT required)

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

### Plan Endpoints (JWT required)

- `GET /api/plans` - list public, non-archived plans
- `GET /api/plans/current` - user's active plan (or null)
- `GET /api/plans/:id` - plan detail with full nested structure
- `POST /api/plans/:id/subscribe` - subscribe to plan, returns `{ userPlan, requiredExercises, missingTMs }`

### Admin Endpoints (JWT + isAdmin required)

- `GET/POST /api/admin/exercises` - list/create exercises
- `PATCH/DELETE /api/admin/exercises/:id` - update/delete exercises (delete fails if referenced by a plan)
- `GET/POST /api/admin/plans` - list/create plans (full nested structure in one transaction)
- `GET/PUT/DELETE /api/admin/plans/:id` - get/update/archive plans (system plans cannot be archived)
- `POST /api/admin/plans/:id/progression-rules` - replace progression rules for a plan

## Key Business Logic

### Starting a Workout (`POST /api/workouts`)

1. Require active plan subscription
2. Load PlanDay with exercises and sets for the requested dayNumber
3. Look up current TMs for each exercise's tmExerciseId
4. Calculate weights: `round(TM * percentage)` using plan set schemes
5. Insert workout + workout_sets with exerciseId and isProgression from plan
6. Return full workout with sets

### Completing a Workout (`POST /api/workouts/:id/complete`)

1. Find all sets with `isProgression: true`
2. For each progression set: look up exercise, find matching progression rule
3. Rule matching: exercise-specific first, then category fallback (upper/lower)
4. Calculate TM increase from matched rule based on actual_reps
5. Insert new training_maxes rows if increase > 0
6. Return `{ progressions: [...] }` array (multiple possible per workout)

### Canceling a Workout (`DELETE /api/workouts/:id`)

- Soft delete: sets status to 'discarded' (not hard delete)
- Discarded workouts excluded from history, calendar, and current workout queries

## Frontend Structure

### Pages

- `LoginPage` / `RegisterPage` - auth forms
- `PlanSelectionPage` - browse and subscribe to workout plans
- `SetupPage` - dynamic 1RM inputs based on active plan's exercises (supports partial setup for missing TMs)
- `DashboardPage` - plan-driven workout day cards, current TMs, current plan section
- `WorkoutPage` - active session with conflict dialog for duplicate workouts
- `HistoryPage` - calendar view (WorkoutCalendar) + workout detail (WorkoutDetail) with View Transition animations
- `SettingsPage` - current plan display, training maxes, logout

### Admin Pages (purple accent, /admin/*)

- `PlanListPage` - list/archive plans
- `PlanEditorPage` - create/edit plans with day structure, exercise picker, set scheme editor
- `ExerciseListPage` - CRUD exercises

### Key Components

- `Layout` - mobile shell with bottom nav (Dashboard, History, Settings) + admin icon for admins
- `AdminLayout` - purple (#7c3aed) themed layout with Plans/Exercises tabs
- `WorkoutCalendar` - controlled component, Monday-first calendar with workout indicators
- `WorkoutDetail` - read-only workout display with set data
- `SetRow` - single set: weight, prescribed reps, +/- stepper for rep entry, undo support
- `RepsInput` - +/- stepper for mobile-friendly rep entry (used by SetRow)
- `Button` - reusable button component with variant support
- `ButtonLink` - TanStack Router `Link` styled as a button (same variants/sizes as Button)
- `ProgressionBanner` - supports both single and array progressions
- `ConflictDialog` - duplicate workout resolution (continue/discard)
- `ConfirmDialog` - generic confirmation dialog
- `Toast` - toast notifications
- `WorkoutCard` - workout day card for dashboard
- `ExerciseFormModal` - admin create/edit exercise form
- `SetSchemeEditorModal` - admin set scheme editor (bulk add, percentage/reps/AMRAP/progression per set)
- `ProgressionRulesEditor` - admin progression rules editor
- `PlanSwitchConfirmModal` - plan switch warnings (in-progress workout, new/existing TMs)
- `LoadingSpinner` / `ErrorMessage` - shared UI state components

### Frontend Patterns

- **Zod schemas**: All API responses validated at runtime via `frontend/src/api/schemas.ts`
- **Weight display**: All display uses `formatWeight()` from `frontend/src/utils/weight.ts` (always kg, rounds to 2.5).
- **CSS Modules**: Component-scoped styles via `.module.css` files, rem units on 8-point grid, shared custom properties in `global.css`, border widths stay as px
- **Touch targets**: All interactive elements min 44px (3rem)
- **View Transitions**: `document.startViewTransition()` with feature detection for calendar navigation
- **Controlled components**: Complex stateful UI (e.g., WorkoutCalendar) uses props not internal state to prevent reset on re-render
- **Loading overlays**: Keep components mounted during loading, use opacity + pointer-events: none instead of unmounting
- **Modals**: Use native `<dialog>` element with `showModal()`. Dialog fills viewport (transparent background), visual content in inner `__content` div. Gives free backdrop, focus trapping, and Escape key handling. Listen for `close` event to sync parent state.
- **Navigation**: Never use `<Button onClick={() => navigate(...)}>` for navigation. Use `<ButtonLink to="...">` (renders an `<a>` tag) for all navigational actions. Only use `navigate()` for post-action redirects (after form submit, login, logout, API call).

## Testing

Always write tests for new code.

- **Backend integration tests**: Run against a real PostgreSQL test database (port 5433). No `vi.mock` for DB, config, or bcrypt — use real modules.
- **Test infrastructure**: `./run_test.sh` handles the full lifecycle: starts test Postgres container, runs migrations, runs backend vitest tests, starts dev servers, runs Playwright E2E tests, cleans up.
- **Test isolation**: Backend `vitest.config.ts` uses `fileParallelism: false` and `setup.ts` truncates all tables in `beforeAll` per test file.
- **E2E tests**: Playwright for end-to-end user flows (registration, login, workout session, progression). Test files located in `e2e/`, configuration in `playwright.config.ts` at project root. Parallel execution with `crypto.randomUUID()` for unique test users.
- **Do not write frontend unit tests.** All frontend testing is done via Playwright E2E tests.

### Playwright Best Practices

- **Use `await page.locator().click()` instead of `await page.click()`** — locator-based API is more reliable and auto-waits.
- **Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors** — use `page.getByRole('button', { name: /save/i })` instead of `page.click('button[type="submit"]')`, `page.getByLabel(/email/i)` instead of `page.fill('#email', ...)`, `page.getByRole('link', { name: /settings/i })` instead of `page.click('a[href="/settings"]')`.
- **Wait with `expect` assertions, not `waitForTimeout` or `waitForSelector`** — use `await expect(page.getByText('Workout Days')).toBeVisible()` instead of `page.waitForSelector('text=Workout Days')` or `page.waitForTimeout(500)`. Never use `waitForTimeout`; if you need to wait for async data, use `waitForResponse` or `expect` with a timeout.
- **Use `expect(...).toBeVisible()` instead of `.waitFor()`** — e.g. `await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible()` instead of `page.getByRole('heading', { name: /log in/i }).waitFor()`.
- **Add `.first()` when multiple elements match** — e.g. `page.getByRole('button', { name: /select plan/i }).first().click()` when there are multiple "Select Plan" buttons.
- **Target elements within specific containers** to avoid position-dependent `nth()` — e.g. `page.locator('.workout-card').filter({ has: page.getByRole('heading', { name: 'Day 2' }) }).getByRole('button')` instead of `page.getByRole('button').nth(1)`.
- **Wait for page render after navigation** before interacting with forms that share input IDs across routes — e.g. `await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible()` before filling the register form, since login and register both have `id="email"`.
- **Extract shared helpers** for repetitive flows (registration, login, logout, workout completion) to reduce duplication across test files.
- Run tests before committing: `npm test` or `./run_test.sh`
- If tests fail, fix code or test and then you can commit. Never skip tests if they fail
- **Backend typecheck**: `npm run build -w backend` (no separate typecheck script)
- **Frontend typecheck**: `cd frontend && npx tsc --noEmit`

## Design Decisions

- **Weights in kg only**: All weights stored and displayed in kg. No unit conversion.
- **Append-only training_maxes**: Free progression history. Current TM = `ORDER BY effective_date DESC LIMIT 1`.
- **Plan-driven architecture**: All workout generation uses plan data (exercises, sets, progression rules). No hardcoded exercise logic.
- **Seed script for default plan**: nSuns 4-Day LP defined in `backend/prisma/seed.ts` with idempotent upsert logic.
- **Prisma ORM**: Type-safe database client, declarative schema with migrations, auto-generated types.
- **CSS Modules**: Component-scoped styles via `.module.css`, shared custom properties in `global.css`, rem units on 8-point grid.
- **Soft-delete workouts**: Canceled workouts set to 'discarded' status, preserving data integrity.
- **No dotenv**: Environment variables exported by shell scripts. Backend reads `process.env` directly.
- **Percentages as decimals**: Stored as Decimal(5,4) in DB (e.g., 0.6500 for 65%).

## Commands

```bash
# Start full local dev environment (Docker + backend + frontend in tmux)
./start_local_env.sh      # Creates/attaches to tmux session 'treenisofta'

# Or start services manually:
docker compose up -d
npm install
cd backend && npx prisma generate && npx prisma migrate dev && cd ..
npm run dev -w backend    # Express on :3001
npm run dev -w frontend   # Vite on :5173

# Run tests (starts test DB, migrates, runs backend + E2E tests, cleans up)
npm test                  # or ./run_test.sh directly

# Prisma commands (MUST run from backend/ directory, not workspace flag)
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

## Prisma v7 Notes

- Uses `prisma-client` generator (not `prisma-client-js`)
- No `url` in `schema.prisma` datasource; connection URL goes in `prisma.config.ts`
- Requires `@prisma/adapter-pg`: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
- Client generated to `backend/src/generated/prisma/` (gitignored)
- Seed config in `prisma.config.ts` (`migrations.seed` field), not `package.json`
- Prisma CLI does NOT support npm workspace `-w` flag — must `cd backend` first
- Export `DATABASE_URL` before running Prisma CLI commands

## Known Gotchas

### Stale dist/ artifacts
The backend build (`tsc`) does NOT clean `dist/` before compiling. If a source file is moved (e.g., `src/types.ts` → `src/types/index.ts`), the old `dist/types.js` remains and shadows the new `dist/types/index.js` at runtime. The build script now runs `rm -rf dist && tsc` to prevent this. **Symptom**: `instanceof` checks fail with "Right-hand side of 'instanceof' is not an object" because the class is `undefined`.

### React StrictMode double-fires useEffect
In dev mode, React StrictMode runs effects twice. If a `useEffect` calls a backend endpoint that creates resources (like `POST /api/workouts`), it will create duplicate records. **Fix**: Use a `useRef` guard to prevent concurrent execution. The WorkoutPage uses `loadingRef` for this.

### E2E debugging: check backend-test.log
When E2E tests fail, always check `backend-test.log` in the project root. It contains all backend request/response logs during E2E execution. Filter with `grep -i "error\|500\|409"` to find API failures that the frontend swallows silently (e.g., "Failed to discard workout" hides the real 409/500 from the backend).

### Exercise names vs slugs
The workout API returns `exercise.name` (human-readable like "Bench Press") not `exercise.slug` (like "bench-press"). PlanDayExercise has `displayName` (like "Bench Volume") but that's only used on the dashboard day cards, not in workout sets.

## Ralph Post-Completion

When Ralph finishes a task, read `progress.txt` to review what was done. Based on the progress, either create a new skill or add relevant insights into this CLAUDE.md if needed.

## Environment Variables

```
DATABASE_URL=postgresql://treenisofta:treenisofta_dev@localhost:5432/treenisofta
JWT_SECRET=change-me-in-production
PORT=3001
NODE_ENV=development
```

These are exported by `start_local_env.sh` and `run_test.sh`. No .env files.

Dont use typescript-code-review skill

dont use co-author in commits
