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

## Reference Docs (read on demand, not loaded by default)

- **Database schema**: `docs/db-schema.md`
- **API endpoints**: `docs/api-endpoints.md`
- **React Query cache map & invalidation rules**: `docs/react-query-cache.md`

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

## Frontend Patterns

- **Zod schemas**: All API responses validated at runtime via `frontend/src/api/schemas.ts`
- **Weight display**: All display uses `formatWeight()` from `frontend/src/utils/weight.ts` (always kg, rounds to 2.5).
- **CSS Modules**: Component-scoped styles via `.module.css` files, rem units on 8-point grid, shared custom properties in `global.css`, border widths stay as px
- **Touch targets**: All interactive elements min 44px (3rem)
- **No view transitions**: Removed due to Safari/iOS issues.
- **Controlled components**: Complex stateful UI (e.g., WorkoutCalendar) uses props not internal state to prevent reset on re-render
- **Loading states**: Calendar uses a thin animated progress bar (not opacity fade). Skeleton loading screens for initial page loads. Never unmount components during loading.
- **Caching**: `defaultPreloadStaleTime: 0` delegates all caching to React Query. Route loaders use `ensureQueryData()` for preloading. Calendar uses `keepPreviousData` for smooth month transitions.
- **Workout creation**: Done in component `useEffect` with `useRef` guard (not in route loader) to prevent phantom workouts from preloading. Route preloading disabled on workout page.
- **Modals**: Use native `<dialog>` element with `showModal()`. Dialog fills viewport (transparent background), visual content in inner `__content` div. Gives free backdrop, focus trapping, and Escape key handling. Listen for `close` event to sync parent state.
- **Navigation**: Never use `<Button onClick={() => navigate(...)}>` for navigation. Use `<ButtonLink to="...">` (renders an `<a>` tag) for all navigational actions. Only use `navigate()` for post-action redirects (after form submit, login, logout, API call).

## Testing

Always write tests for new code.

- **Backend integration tests**: Run against a real PostgreSQL test database (port 5433). No `vi.mock` for DB, config, or bcrypt — use real modules.
- **Test infrastructure**: `./run_test.sh` handles the full lifecycle: starts test Postgres container, runs migrations, runs backend vitest tests, starts dev servers, runs Playwright E2E tests, cleans up.
- **Test isolation**: Backend `vitest.config.ts` uses `fileParallelism: false` and `setup.ts` truncates all tables in `beforeAll` per test file.
- **E2E tests**: Playwright for end-to-end user flows. Test files in `e2e/`, config in `playwright.config.ts`. Parallel execution with `crypto.randomUUID()` for unique test users.
- **Do not write frontend unit tests.** All frontend testing is done via Playwright E2E tests.
- **Playwright**: Use locator-based API, prefer `getByRole`/`getByLabel`/`getByText` over CSS selectors, wait with `expect` assertions (never `waitForTimeout`), use `.first()` when multiple elements match.
- Run tests before committing: `npm test` or `./run_test.sh`
- **Backend typecheck**: `npm run build -w backend`
- **Frontend typecheck**: `cd frontend && npx tsc --build --noEmit` (must use `--build` because `tsconfig.json` uses project references)

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
The backend build (`tsc`) does NOT clean `dist/` before compiling. If a source file is moved, the old `.js` remains and shadows the new one. The build script now runs `rm -rf dist && tsc` to prevent this.

### React StrictMode double-fires useEffect
In dev mode, effects run twice. Guard side-effectful API calls with `useRef`. The WorkoutPage uses `loadingRef` for this.

### E2E debugging: check backend-test.log
When E2E tests fail, check `backend-test.log` in the project root. Filter with `grep -i "error\|500\|409"` to find API failures the frontend swallows silently.

### Exercise names vs slugs
The workout API returns `exercise.name` (like "Bench Press") not `exercise.slug` (like "bench-press"). PlanDayExercise has `displayName` (like "Bench Volume") used only on dashboard day cards.

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

## Backlog Tickets

Always create a new ticket (`/ticket add`) when you discover a bug, identify a potential new feature, or notice an improvement opportunity during any work. Err on the side of adding — it's better to have a ticket you later delete than to lose track of an idea.

## Keeping Docs Up to Date

When you add or change API endpoints, DB schema, query keys, or invalidation rules, update the corresponding reference doc:
- New/changed endpoints -> `docs/api-endpoints.md`
- Schema migrations -> `docs/db-schema.md`
- New queries or invalidation changes -> `docs/react-query-cache.md`
- Architecture, patterns, or gotchas -> this file (`CLAUDE.md`)

Dont use typescript-code-review skill

dont use co-author in commits

After committing code, always invoke the `superpowers:requesting-code-review` skill on the recent commits.
