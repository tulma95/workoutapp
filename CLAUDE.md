# nSuns 4-Day LP Workout Tracker

## Project Overview

A workout tracking application for the nSuns 4-Day Linear Progression program. Users register, enter 1 Rep Maxes, and the app generates workouts with auto-calculated weights. Training maxes update automatically based on AMRAP performance.

## Tech Stack

- **Backend**: Express.js + TypeScript, Prisma (ORM + migrations), bcrypt + jsonwebtoken, zod, vitest + supertest
- **Frontend**: React + TypeScript, Vite, React Router v6, plain CSS
- **E2E**: Playwright
- **Database**: PostgreSQL latest (Dockerized via docker-compose)
- **Package manager**: npm workspaces (monorepo: `backend/`, `frontend/`)
- **Node**: v22 (`.nvmrc`)

## Architecture

- Monorepo with npm workspaces
- Backend on port 3001, frontend Vite dev server on 5173 with `/api` proxy
- JWT auth (token in localStorage, `Authorization: Bearer` header)
- Weights stored internally in **kg**, converted to lb at display layer
- Training maxes are **append-only** rows (latest `effective_date` = current TM, older rows = history)

## nSuns 4-Day LP Program

### Training Maxes

4 lifts tracked: **Bench, Squat, OHP, Deadlift**. TM = 90% of 1RM.

### Day Structure

| Day | T1 (9 sets)             | T2 (8 sets)                         |
| --- | ----------------------- | ----------------------------------- |
| 1   | Bench Volume (Bench TM) | OHP (OHP TM, 50-70%)                |
| 2   | Squat (Squat TM)        | Sumo Deadlift (Deadlift TM, 50-70%) |
| 3   | Bench Heavy (Bench TM)  | Close Grip Bench (Bench TM, 40-60%) |
| 4   | Deadlift (Deadlift TM)  | Front Squat (Squat TM, 35-55%)      |

### T1 Set Schemes (% of TM)

- **Bench Volume (Day 1)**: 65%x8, 75%x6, 85%x4, 85%x4, 85%x4, 80%x5, 75%x6, 70%x7, **65%x8+**
- **Squat (Day 2)**: 75%x5, 85%x3, **95%x1+**, 90%x3, 85%x3, 80%x3, 75%x5, 70%x5, 65%x5+
- **Bench Heavy (Day 3)**: 75%x5, 85%x3, **95%x1+**, 90%x3, 85%x5, 80%x3, 75%x5, 70%x3, 65%x5+
- **Deadlift (Day 4)**: 75%x5, 85%x3, **95%x1+**, 90%x3, 85%x3, 80%x3, 75%x3, 70%x3, 65%x3+

Bold = **progression AMRAP** (highest-% AMRAP set, used for TM adjustment).

### T2 Set Schemes (% of parent T1's TM)

- **OHP** (OHP TM): 50%x6, 60%x5, 70%x3, 70%x5, 70%x7, 70%x4, 70%x6, 70%x8
- **Sumo Deadlift** (Deadlift TM): 50%x5, 60%x5, 70%x3, 70%x5, 70%x7, 70%x4, 70%x6, 70%x8
- **Close Grip Bench** (Bench TM): 40%x6, 50%x5, 60%x3, 60%x5, 60%x7, 60%x4, 60%x6, 60%x8
- **Front Squat** (Squat TM): 35%x5, 45%x5, 55%x3, 55%x5, 55%x7, 55%x4, 55%x6, 55%x8

### Progression Rules

Based on reps achieved in the T1 **progression AMRAP** set:

| AMRAP Reps | TM Increase         |
| ---------- | ------------------- |
| 0-1        | No increase         |
| 2-3        | +2.5kg / +5lb       |
| 4-5        | +2.5-5kg / +5-10lb  |
| 5+         | +5-7.5kg / +10-15lb |

### Weight Rounding

Round calculated weights to nearest **2.5kg** or **5lb** depending on user preference.

## Database Schema

### users

`id, email (unique), password_hash, display_name, unit_preference ('kg'/'lb'), created_at, updated_at`

### training_maxes (append-only)

`id, user_id (FK), exercise ('bench'/'squat'/'ohp'/'deadlift'), weight (kg), effective_date, created_at`

- Unique constraint: (user_id, exercise, effective_date)
- Current TM = row with latest effective_date per exercise

### workouts

`id, user_id (FK), day_number (1-4), status ('in_progress'/'completed'), completed_at, created_at`

### workout_sets

`id, workout_id (FK CASCADE), exercise, tier ('T1'/'T2'), set_order (1-9), prescribed_weight (kg), prescribed_reps, is_amrap, actual_reps (nullable), completed, created_at`

## API Endpoints

### Public

- `POST /api/auth/register` - `{ email, password, displayName, unitPreference }`
- `POST /api/auth/login` - `{ email, password }` → `{ token, user }`

### Protected (JWT required)

- `GET /api/users/me` | `PATCH /api/users/me`
- `GET /api/training-maxes` - current TMs for all 4 lifts
- `POST /api/training-maxes/setup` - `{ oneRepMaxes: { bench, squat, ohp, deadlift } }` → TM = 90% \* 1RM
- `PATCH /api/training-maxes/:exercise` - manual TM override
- `GET /api/training-maxes/:exercise/history`
- `POST /api/workouts` - `{ dayNumber }` → generates all sets from current TMs
- `GET /api/workouts/current` - in-progress workout (or null)
- `GET /api/workouts/:id`
- `PATCH /api/workouts/:id/sets/:setId` - `{ actualReps, completed }`
- `POST /api/workouts/:id/complete` - applies progression, returns TM changes
- `GET /api/workouts/history?page=1&limit=10`

## Key Business Logic

### Starting a Workout (`POST /api/workouts`)

1. Look up current TMs for the day's exercises
2. Generate sets using program definition (nsuns.ts) + TMs
3. Calculate actual weights: `round(TM * percentage)` using user's unit rounding
4. Insert workout + all workout_sets rows
5. Return full workout with sets

### Completing a Workout (`POST /api/workouts/:id/complete`)

1. Find the T1 AMRAP set with the **highest percentage** (this is the progression set)
2. Read `actual_reps` from that set
3. Calculate TM increase using progression rules
4. If increase > 0, insert new `training_maxes` row with updated weight
5. Mark workout as completed
6. Return progression result

### Key Insight: Progression AMRAP Selection

- Days 2, 3, 4 have TWO T1 AMRAP sets (95%x1+ and a lighter final AMRAP)
- Day 1 has ONE T1 AMRAP (65%x8+)
- Always use the **highest percentage AMRAP** for progression calculation

## Frontend Structure

### Pages

- `LoginPage` / `RegisterPage` - auth forms
- `SetupPage` - enter 4 x 1RM inputs (shown once, redirected if no TMs)
- `DashboardPage` - 4 workout day cards, current TMs, next workout highlighted
- `WorkoutPage` - active session: T1 + T2 set lists, tap to complete, AMRAP input, completion → progression banner
- `HistoryPage` - paginated past workouts with expandable details

### Key Components

- `Layout` - mobile shell with bottom nav (Dashboard, History, Settings)
- `SetRow` - single set: weight, reps, completion toggle
- `AmrapInput` - +/- stepper for mobile-friendly rep entry
- `ProgressionBanner` - color-coded TM change display after completion
- `WorkoutCard` - day summary card for dashboard

## Testing

Always write tests for new code.

- **Backend integration tests**: Run against a real PostgreSQL test database (port 5433). No `vi.mock` for DB, config, or bcrypt — use real modules.
- **Test infrastructure**: `./run_test.sh` handles the full lifecycle: starts test Postgres container, runs migrations, runs backend vitest tests, starts dev servers, runs Playwright E2E tests, cleans up.
- **Test isolation**: Backend `vitest.config.ts` uses `fileParallelism: false` and `setup.ts` truncates all tables in `beforeAll` per test file.
- **E2E tests**: Playwright for end-to-end user flows (registration, login, workout session, progression). Test files located in `e2e/`, configuration in `playwright.config.ts` at project root.
- **Do not write frontend unit tests.** All frontend testing is done via Playwright E2E tests.
- Run tests before committing: `npm test` or `./run_test.sh`

## Design Decisions

- **Weights in kg internally**: Avoids precision loss from repeated lb↔kg conversions. Convert once at display layer.
- **Append-only training_maxes**: Free progression history. Current TM = `ORDER BY effective_date DESC LIMIT 1`.
- **Hardcoded exercises in nsuns.ts**: Fixed 4-day program, no need for dynamic exercises table.
- **Prisma ORM**: Type-safe database client, declarative schema with migrations, auto-generated types.
- **No CSS framework**: ~10 components total, plain CSS with custom properties is simpler.
- **T2 exercises reference parent TM**: No separate T2 training maxes. OHP has its own TM; Sumo Dead uses Deadlift TM; CG Bench uses Bench TM; Front Squat uses Squat TM.

## Commands

```bash
# Start full local dev environment (Docker + backend + frontend in tmux)
./start_local_env.sh      # Creates/attaches to tmux session 'treenisofta'

# Or start services manually:
# Start Postgres
docker compose up -d

# Install dependencies
npm install

# Run migrations
npx prisma migrate dev -w backend

# Dev servers
npm run dev -w backend    # Express on :3001
npm run dev -w frontend   # Vite on :5173

# Run tests (starts test DB, migrates, runs backend + E2E tests, cleans up)
npm test                  # or ./run_test.sh directly
```

## Ralph Post-Completion

When Ralph finishes a task, read `progress.txt` to review what was done. Based on the progress, either create a new skill or add relevant insights into this CLAUDE.md if needed.

## Environment Variables (.env)

```
DATABASE_URL=postgresql://treenisofta:treenisofta_dev@localhost:5432/treenisofta
JWT_SECRET=change-me-in-production
PORT=3001
NODE_ENV=development
```

Dont use typescript-code-review skill
