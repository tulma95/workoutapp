# nSuns 4-Day LP Workout Tracker - Implementation Plan

## Overview

A multi-user workout tracking application for the nSuns 4-Day Linear Progression program. Users register, enter their 1 Rep Maxes (1RMs), and the app generates workouts with auto-calculated weights based on training max percentages. After each workout, training maxes update automatically based on AMRAP (As Many Reps As Possible) set performance.

### Tech Stack

| Layer                  | Technology                  |
| ---------------------- | --------------------------- |
| Backend                | Express.js + TypeScript     |
| Frontend               | React + TypeScript (Vite)   |
| Database               | PostgreSQL (latest, Docker) |
| Query builder          | Knex.js                     |
| Auth                   | JWT (jsonwebtoken + bcrypt) |
| Validation             | zod                         |
| Styling                | Plain CSS (mobile-first)    |
| Unit/integration tests | Vitest + supertest          |
| E2E tests              | Playwright                  |
| Package manager        | npm workspaces              |

---

## nSuns 4-Day LP Program Reference

### Training Maxes (TM)

4 lifts tracked: **Bench Press, Squat, Overhead Press (OHP), Deadlift**

TM = 90% of 1 Rep Max

### Weekly Schedule

| Day   | T1 Primary Lift (9 sets) | T2 Secondary Lift (8 sets) |
| ----- | ------------------------ | -------------------------- |
| Day 1 | Bench Press (Volume)     | Overhead Press             |
| Day 2 | Squat                    | Sumo Deadlift              |
| Day 3 | Bench Press (Heavy)      | Close Grip Bench Press     |
| Day 4 | Deadlift                 | Front Squat                |

### T2 Exercise → Training Max Mapping

| T2 Exercise      | Uses TM of   |
| ---------------- | ------------ |
| OHP              | OHP (own TM) |
| Sumo Deadlift    | Deadlift     |
| Close Grip Bench | Bench Press  |
| Front Squat      | Squat        |

### T1 Set Schemes (% of Training Max)

**Day 1 - Bench Volume:**

| Set | % TM | Reps           |
| --- | ---- | -------------- |
| 1   | 65%  | 8              |
| 2   | 75%  | 6              |
| 3   | 85%  | 4              |
| 4   | 85%  | 4              |
| 5   | 85%  | 4              |
| 6   | 80%  | 5              |
| 7   | 75%  | 6              |
| 8   | 70%  | 7              |
| 9   | 65%  | **8+ (AMRAP)** |

**Day 2 - Squat:**

| Set | % TM | Reps           |
| --- | ---- | -------------- |
| 1   | 75%  | 5              |
| 2   | 85%  | 3              |
| 3   | 95%  | **1+ (AMRAP)** |
| 4   | 90%  | 3              |
| 5   | 85%  | 3              |
| 6   | 80%  | 3              |
| 7   | 75%  | 5              |
| 8   | 70%  | 5              |
| 9   | 65%  | 5+             |

**Day 3 - Bench Heavy:**

| Set | % TM | Reps           |
| --- | ---- | -------------- |
| 1   | 75%  | 5              |
| 2   | 85%  | 3              |
| 3   | 95%  | **1+ (AMRAP)** |
| 4   | 90%  | 3              |
| 5   | 85%  | 5              |
| 6   | 80%  | 3              |
| 7   | 75%  | 5              |
| 8   | 70%  | 3              |
| 9   | 65%  | 5+             |

**Day 4 - Deadlift:**

| Set | % TM | Reps           |
| --- | ---- | -------------- |
| 1   | 75%  | 5              |
| 2   | 85%  | 3              |
| 3   | 95%  | **1+ (AMRAP)** |
| 4   | 90%  | 3              |
| 5   | 85%  | 3              |
| 6   | 80%  | 3              |
| 7   | 75%  | 3              |
| 8   | 70%  | 3              |
| 9   | 65%  | 3+             |

### T2 Set Schemes (% of parent T1's Training Max)

**OHP** (uses OHP TM):

| Set | % TM | Reps |
| --- | ---- | ---- |
| 1   | 50%  | 6    |
| 2   | 60%  | 5    |
| 3   | 70%  | 3    |
| 4   | 70%  | 5    |
| 5   | 70%  | 7    |
| 6   | 70%  | 4    |
| 7   | 70%  | 6    |
| 8   | 70%  | 8    |

**Sumo Deadlift** (uses Deadlift TM):

| Set | % TM | Reps |
| --- | ---- | ---- |
| 1   | 50%  | 5    |
| 2   | 60%  | 5    |
| 3   | 70%  | 3    |
| 4   | 70%  | 5    |
| 5   | 70%  | 7    |
| 6   | 70%  | 4    |
| 7   | 70%  | 6    |
| 8   | 70%  | 8    |

**Close Grip Bench** (uses Bench TM):

| Set | % TM | Reps |
| --- | ---- | ---- |
| 1   | 40%  | 6    |
| 2   | 50%  | 5    |
| 3   | 60%  | 3    |
| 4   | 60%  | 5    |
| 5   | 60%  | 7    |
| 6   | 60%  | 4    |
| 7   | 60%  | 6    |
| 8   | 60%  | 8    |

**Front Squat** (uses Squat TM):

| Set | % TM | Reps |
| --- | ---- | ---- |
| 1   | 35%  | 5    |
| 2   | 45%  | 5    |
| 3   | 55%  | 3    |
| 4   | 55%  | 5    |
| 5   | 55%  | 7    |
| 6   | 55%  | 4    |
| 7   | 55%  | 6    |
| 8   | 55%  | 8    |

### Progression Rules

After each workout, the T1 exercise's Training Max is adjusted based on reps achieved in the **highest-percentage AMRAP set** (the "progression AMRAP"):

- Days 2, 3, 4: The 95%x1+ set (set 3)
- Day 1: The 65%x8+ set (set 9, the only AMRAP)

| AMRAP Reps Achieved | TM Increase           |
| ------------------- | --------------------- |
| 0-1 reps            | No increase           |
| 2-3 reps            | +2.5 kg / +5 lb       |
| 4-5 reps            | +2.5-5 kg / +5-10 lb  |
| 5+ reps             | +5-7.5 kg / +10-15 lb |

### Weight Rounding

All calculated weights are rounded to the nearest **2.5 kg** or **5 lb** depending on user unit preference.

---

## Database Design

### Design Decisions

- **Weights stored in kg internally** - converted to lb at the display layer to avoid precision drift from repeated conversions
- **Training maxes are append-only** - each progression inserts a new row; current TM = row with latest `effective_date`; this gives free progression history
- **Exercises are hardcoded** - the nSuns 4-day program is fixed; no dynamic exercises table needed

### Schema

#### `users`

| Column          | Type         | Constraints            |
| --------------- | ------------ | ---------------------- |
| id              | SERIAL       | PRIMARY KEY            |
| email           | VARCHAR(255) | UNIQUE, NOT NULL       |
| password_hash   | VARCHAR(255) | NOT NULL               |
| display_name    | VARCHAR(100) | NOT NULL               |
| unit_preference | VARCHAR(2)   | NOT NULL, DEFAULT 'kg' |
| created_at      | TIMESTAMP    | DEFAULT NOW()          |
| updated_at      | TIMESTAMP    | DEFAULT NOW()          |

#### `training_maxes`

| Column         | Type         | Constraints                                    |
| -------------- | ------------ | ---------------------------------------------- |
| id             | SERIAL       | PRIMARY KEY                                    |
| user_id        | INTEGER      | FK → users(id), NOT NULL                       |
| exercise       | VARCHAR(50)  | NOT NULL ('bench', 'squat', 'ohp', 'deadlift') |
| weight         | DECIMAL(6,2) | NOT NULL (stored in kg)                        |
| effective_date | DATE         | NOT NULL, DEFAULT CURRENT_DATE                 |
| created_at     | TIMESTAMP    | DEFAULT NOW()                                  |

Unique constraint: `(user_id, exercise, effective_date)`

#### `workouts`

| Column       | Type        | Constraints                     |
| ------------ | ----------- | ------------------------------- |
| id           | SERIAL      | PRIMARY KEY                     |
| user_id      | INTEGER     | FK → users(id), NOT NULL        |
| day_number   | SMALLINT    | NOT NULL (1-4)                  |
| status       | VARCHAR(20) | NOT NULL, DEFAULT 'in_progress' |
| completed_at | TIMESTAMP   | NULL                            |
| created_at   | TIMESTAMP   | DEFAULT NOW()                   |

#### `workout_sets`

| Column            | Type         | Constraints                                   |
| ----------------- | ------------ | --------------------------------------------- |
| id                | SERIAL       | PRIMARY KEY                                   |
| workout_id        | INTEGER      | FK → workouts(id) ON DELETE CASCADE, NOT NULL |
| exercise          | VARCHAR(50)  | NOT NULL                                      |
| tier              | VARCHAR(2)   | NOT NULL ('T1', 'T2')                         |
| set_order         | SMALLINT     | NOT NULL (1-9)                                |
| prescribed_weight | DECIMAL(6,2) | NOT NULL (kg)                                 |
| prescribed_reps   | SMALLINT     | NOT NULL                                      |
| is_amrap          | BOOLEAN      | DEFAULT FALSE                                 |
| actual_reps       | SMALLINT     | NULL                                          |
| completed         | BOOLEAN      | DEFAULT FALSE                                 |
| created_at        | TIMESTAMP    | DEFAULT NOW()                                 |

Index: `(workout_id, tier, set_order)`

---

## API Design

### Auth (public)

| Method | Endpoint             | Request Body                                       | Response          |
| ------ | -------------------- | -------------------------------------------------- | ----------------- |
| POST   | `/api/auth/register` | `{ email, password, displayName, unitPreference }` | `{ token, user }` |
| POST   | `/api/auth/login`    | `{ email, password }`                              | `{ token, user }` |

### User (protected)

| Method | Endpoint        | Request Body                        | Response   |
| ------ | --------------- | ----------------------------------- | ---------- |
| GET    | `/api/users/me` | -                                   | `{ user }` |
| PATCH  | `/api/users/me` | `{ displayName?, unitPreference? }` | `{ user }` |

### Training Maxes (protected)

| Method | Endpoint                                | Request Body                                       | Response                   |
| ------ | --------------------------------------- | -------------------------------------------------- | -------------------------- |
| GET    | `/api/training-maxes`                   | -                                                  | `{ trainingMaxes: [...] }` |
| POST   | `/api/training-maxes/setup`             | `{ oneRepMaxes: { bench, squat, ohp, deadlift } }` | `{ trainingMaxes: [...] }` |
| PATCH  | `/api/training-maxes/:exercise`         | `{ weight }`                                       | `{ trainingMax }`          |
| GET    | `/api/training-maxes/:exercise/history` | -                                                  | `{ history: [...] }`       |

### Workouts (protected)

| Method | Endpoint                        | Request Body                  | Response                      |
| ------ | ------------------------------- | ----------------------------- | ----------------------------- |
| POST   | `/api/workouts`                 | `{ dayNumber }`               | `{ workout, sets }`           |
| GET    | `/api/workouts/current`         | -                             | `{ workout, sets }` or `null` |
| GET    | `/api/workouts/:id`             | -                             | `{ workout, sets }`           |
| PATCH  | `/api/workouts/:id/sets/:setId` | `{ actualReps?, completed? }` | `{ set }`                     |
| POST   | `/api/workouts/:id/complete`    | -                             | `{ workout, progression }`    |
| GET    | `/api/workouts/history`         | `?page=1&limit=10`            | `{ workouts, total }`         |

### Key Flows

**Starting a workout** (`POST /api/workouts { dayNumber: 2 }`):

1. Look up current TMs for the day's exercises (Day 2 → Squat TM + Deadlift TM)
2. Generate all sets using program definition + TMs
3. Calculate weights: `round(TM * percentage)` per user's unit preference
4. Insert `workout` row + all `workout_sets` rows
5. Return full workout with sets

**Completing a workout** (`POST /api/workouts/:id/complete`):

1. Find the T1 AMRAP set with the **highest percentage** (the progression set)
2. Read `actual_reps` from that set
3. Calculate TM increase using progression rules
4. If increase > 0, insert new `training_maxes` row with updated weight
5. Mark workout as completed, return progression result

---

## Frontend Design

### Pages

| Page          | Route                 | Purpose                                                    |
| ------------- | --------------------- | ---------------------------------------------------------- |
| LoginPage     | `/login`              | Email + password form                                      |
| RegisterPage  | `/register`           | Registration with unit preference                          |
| SetupPage     | `/setup`              | Enter 4 x 1RM (shown once after first registration)        |
| DashboardPage | `/`                   | 4 workout day cards, current TMs, next workout highlighted |
| WorkoutPage   | `/workout/:dayNumber` | Active workout session with set logging                    |
| HistoryPage   | `/history`            | Paginated past workouts                                    |

### Components

| Component         | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| Layout            | Mobile shell with bottom nav bar (Dashboard, History, Settings) |
| PrivateRoute      | Auth guard, redirects to `/login`                               |
| WorkoutCard       | Day summary card on dashboard (day label, exercises, status)    |
| SetRow            | Single set row: weight, reps, completion toggle                 |
| AmrapInput        | +/- stepper buttons for mobile-friendly AMRAP rep entry         |
| ProgressionBanner | Color-coded TM change display after workout completion          |
| TrainingMaxForm   | View/edit current training maxes                                |

### User Flow

1. **Register** → pick kg/lb preference
2. **Setup** → enter 1RMs for Bench, Squat, OHP, Deadlift → TMs auto-calculated at 90%
3. **Dashboard** → see 4 training days, tap to start
4. **Workout** → see all sets with calculated weights → tap to mark complete → enter AMRAP reps
5. **Complete** → see progression banner ("Squat TM +5kg!") → return to dashboard
6. **Repeat** → next workout uses updated TMs

---

## Project Structure

```
treenisofta/
├── docker-compose.yml          # PostgreSQL (latest)
├── .nvmrc                      # Node 22
├── .env.example                # Environment variables template
├── .gitignore
├── package.json                # npm workspaces: [backend, frontend]
├── tsconfig.base.json          # Shared TypeScript config
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── knexfile.ts
│   ├── src/
│   │   ├── index.ts            # Server entry point
│   │   ├── app.ts              # Express app factory
│   │   ├── config.ts           # Environment config
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT verification
│   │   │   ├── validate.ts     # zod request validation
│   │   │   └── errorHandler.ts # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── trainingMaxes.ts
│   │   │   └── workouts.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── trainingMax.service.ts
│   │   │   └── workout.service.ts
│   │   ├── lib/
│   │   │   ├── db.ts           # Knex instance
│   │   │   ├── nsuns.ts        # Program definition (sets, %, exercises)
│   │   │   ├── progression.ts  # TM increase calculation
│   │   │   └── weightRounding.ts
│   │   └── types/
│   │       └── index.ts
│   └── db/
│       └── migrations/
│           ├── 001_create_users.ts
│           ├── 002_create_training_maxes.ts
│           ├── 003_create_workouts.ts
│           └── 004_create_workout_sets.ts
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts          # Proxy /api → backend
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx             # Router setup
│       ├── api/
│       │   ├── client.ts       # Fetch wrapper with JWT
│       │   ├── auth.ts
│       │   ├── workouts.ts
│       │   └── trainingMaxes.ts
│       ├── context/
│       │   └── AuthContext.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useWorkouts.ts
│       │   └── useTrainingMaxes.ts
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── SetupPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── WorkoutPage.tsx
│       │   └── HistoryPage.tsx
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── PrivateRoute.tsx
│       │   ├── WorkoutCard.tsx
│       │   ├── SetRow.tsx
│       │   ├── AmrapInput.tsx
│       │   ├── ProgressionBanner.tsx
│       │   └── TrainingMaxForm.tsx
│       └── styles/
│           └── global.css
│
└── docs/
    └── implementation-plan.md  # This file
```

---

## Epics & Tasks

### Epic 1: Project Scaffolding

**Goal**: Running dev environment with empty Express server and React app, test infrastructure ready.

| #   | Task                         | Details                                                                                                                                                                                                                  |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1 | Create infrastructure files  | `.nvmrc` (Node 22), `docker-compose.yml` (Postgres latest with volume), `.gitignore` (node_modules, dist, .env, pgdata), `.env.example`                                                                                  |
| 1.2 | Create root workspace config | `package.json` with npm workspaces pointing to `backend/` and `frontend/`, `tsconfig.base.json` with strict TypeScript                                                                                                   |
| 1.3 | Scaffold backend             | `npm init` in backend/, install deps (express, typescript, ts-node-dev, knex, pg, cors, dotenv, zod, bcrypt, jsonwebtoken + @types/\*), create `src/index.ts` with health check endpoint, `tsconfig.json` extending base |
| 1.4 | Scaffold frontend            | `npm create vite@latest frontend -- --template react-ts`, configure `vite.config.ts` proxy (`/api` → `http://localhost:3001`), install react-router-dom                                                                  |
| 1.5 | Setup test infrastructure    | Install vitest + supertest in backend, vitest in frontend, Playwright in root. Configure `vitest.config.ts` for both workspaces. Add `npm test` script to root `package.json`. Create Playwright config                  |
| 1.6 | **Verify**                   | `docker compose up -d` starts Postgres, both dev servers start, health check responds, `npm test` runs (empty test suite passes)                                                                                         |

---

### Epic 2: Database Schema

**Goal**: All 4 tables created via Knex migrations.

| #   | Task                      | Details                                                                                                                                                                                 |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Configure Knex            | Create `knexfile.ts` (reads `DATABASE_URL` from env), create `src/lib/db.ts` (export Knex instance)                                                                                     |
| 2.2 | Migration: users          | `001_create_users.ts` - id, email (unique), password_hash, display_name, unit_preference, timestamps                                                                                    |
| 2.3 | Migration: training_maxes | `002_create_training_maxes.ts` - id, user_id FK, exercise, weight, effective_date, unique constraint on (user_id, exercise, effective_date)                                             |
| 2.4 | Migration: workouts       | `003_create_workouts.ts` - id, user_id FK, day_number, status, completed_at, created_at                                                                                                 |
| 2.5 | Migration: workout_sets   | `004_create_workout_sets.ts` - id, workout_id FK (CASCADE), exercise, tier, set_order, prescribed_weight/reps, is_amrap, actual_reps, completed. Index on (workout_id, tier, set_order) |
| 2.6 | **Verify**                | Run `npx knex migrate:latest`, connect to Postgres, confirm all tables and constraints exist                                                                                            |

---

### Epic 3: Authentication

**Goal**: Users can register, log in, and access protected routes via JWT.

| #   | Task             | Details                                                                                                                                                                                                                       |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Config and types | Create `config.ts` (load JWT_SECRET, DATABASE_URL, PORT from env). Create `types/index.ts` (User, JwtPayload, AuthRequest types)                                                                                              |
| 3.2 | Middleware       | `middleware/auth.ts` (extract + verify JWT from Authorization header, attach userId to req). `middleware/validate.ts` (generic zod schema validation factory). `middleware/errorHandler.ts` (catch-all error → JSON response) |
| 3.3 | Auth service     | `services/auth.service.ts` - `register()`: hash password with bcrypt, insert user, sign JWT. `login()`: find user by email, compare password, sign JWT                                                                        |
| 3.4 | Auth routes      | `routes/auth.ts` - POST `/register` with zod validation (email, password min 8, displayName, unitPreference). POST `/login` with zod validation                                                                               |
| 3.5 | User routes      | `routes/users.ts` - GET `/me` (return current user). PATCH `/me` (update displayName, unitPreference)                                                                                                                         |
| 3.6 | Wire into app    | Create `app.ts` express factory, mount all routes under `/api`, apply CORS + JSON body parser + error handler                                                                                                                 |
| 3.7 | Tests            | Vitest + supertest: register success + duplicate email, login success + wrong password, auth middleware (valid token, missing token, expired token), GET/PATCH `/me`                                                          |
| 3.8 | **Verify**       | All auth tests pass. Manual curl test: register → login → access protected route                                                                                                                                              |

---

### Epic 4: nSuns Program Logic

**Goal**: Pure domain logic for the nSuns 4-day program, testable without database.

_Can be done in parallel with Epic 3._

| #   | Task               | Details                                                                                                                                                                                                                                                       |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Program definition | `lib/nsuns.ts` - Export `NSUNS_4DAY` constant defining all 4 days with T1/T2 exercises, each with: exercise name, exercise key, TM exercise reference, and array of sets (percentage, reps, isAmrap). Export types: `SetScheme`, `ExerciseSlot`, `ProgramDay` |
| 4.2 | Weight rounding    | `lib/weightRounding.ts` - `roundWeight(weight: number, unit: 'kg' \| 'lb'): number`. Round to nearest 2.5 for kg, 5 for lb                                                                                                                                    |
| 4.3 | Progression logic  | `lib/progression.ts` - `calculateProgression(amrapReps: number, exercise: string): { increase: number }`. Implement 0-1/2-3/4-5/5+ rules. Upper body (bench, ohp): smaller increments. Lower body (squat, deadlift): larger increments                        |
| 4.4 | Tests              | Vitest: test all progression thresholds (0,1,2,3,4,5,6+ reps for each exercise), weight rounding edge cases (kg + lb), nsuns.ts set generation against known CSV values (e.g. TM=270 bench → verify all 9 set weights match spreadsheet)                      |
| 4.5 | **Verify**         | All domain logic tests pass                                                                                                                                                                                                                                   |

---

### Epic 5: Training Max API

**Goal**: Users can set initial 1RMs and manage training maxes.

| #   | Task       | Details                                                                                                                                                                                                                                                                                        |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | TM service | `services/trainingMax.service.ts` - `getCurrentTMs(userId)`: latest TM per exercise. `setupFromOneRepMaxes(userId, oneRepMaxes)`: compute TM = 0.9 \* 1RM, round, insert 4 rows. `updateTM(userId, exercise, weight)`: insert new row. `getHistory(userId, exercise)`: all TMs ordered by date |
| 5.2 | TM routes  | `routes/trainingMaxes.ts` - GET `/` (current TMs), POST `/setup` (initial setup with zod validation), PATCH `/:exercise` (manual override), GET `/:exercise/history`                                                                                                                           |
| 5.3 | Tests      | Vitest + supertest: setup from 1RMs (verify TM = 90%), get current TMs, manual override inserts new row, history returns ordered entries, validation rejects invalid exercise names                                                                                                            |
| 5.4 | **Verify** | All TM tests pass                                                                                                                                                                                                                                                                              |

---

### Epic 6: Workout API

**Goal**: Complete workout flow - start, log sets, complete with progression.

| #   | Task            | Details                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Workout service | `services/workout.service.ts` - `startWorkout(userId, dayNumber)`: look up TMs, generate sets from nsuns.ts, insert workout + sets. `getCurrentWorkout(userId)`: find in-progress workout. `logSet(setId, userId, { actualReps, completed })`: update set with ownership check. `completeWorkout(workoutId, userId)`: find top AMRAP → calculate progression → insert new TM → mark complete. `getHistory(userId, page, limit)`: paginated results |
| 6.2 | Workout routes  | `routes/workouts.ts` - POST `/`, GET `/current`, GET `/:id`, PATCH `/:id/sets/:setId`, POST `/:id/complete`, GET `/history`. All with auth + ownership verification                                                                                                                                                                                                                                                                                |
| 6.3 | Tests           | Vitest + supertest: start workout generates correct number of sets with correct weights, log AMRAP reps, complete workout triggers correct TM progression, ownership check prevents cross-user access, prevent duplicate in-progress workouts, pagination works                                                                                                                                                                                    |
| 6.4 | **Verify**      | All workout API tests pass                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

### Epic 7: Frontend Auth & Layout

**Goal**: Working login/register with protected routing and mobile app shell.

| #   | Task             | Details                                                                                                                                                                                                |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7.1 | API client       | `api/client.ts` - Fetch wrapper that attaches JWT from localStorage to Authorization header, handles 401 → redirect to login. `api/auth.ts` - `register()`, `login()` functions                        |
| 7.2 | Auth context     | `context/AuthContext.tsx` - Provides `user`, `token`, `login()`, `logout()`, `register()`. Persists token in localStorage. On mount, validates token via GET `/api/users/me`                           |
| 7.3 | Layout component | `components/Layout.tsx` - Mobile-first shell: header with app name, bottom navigation bar with 3 tabs (Dashboard, History, Settings). `components/PrivateRoute.tsx` - redirects to `/login` if no auth |
| 7.4 | Auth pages       | `pages/LoginPage.tsx` - email + password form, error display, link to register. `pages/RegisterPage.tsx` - email, password, display name, kg/lb radio, link to login                                   |
| 7.5 | App router       | `App.tsx` - React Router with AuthContext wrapping all routes. Public routes: /login, /register. Protected routes: /, /setup, /workout/:dayNumber, /history                                            |
| 7.6 | Global styles    | `styles/global.css` - CSS reset, mobile-first defaults (max-width, padding), CSS custom properties for colors (--primary, --success, --muted, etc.), 44px min touch targets                            |
| 7.7 | Tests            | Vitest: test AuthContext (login sets token, logout clears it, expired token redirects). Vitest: test API client (attaches JWT header, handles 401)                                                     |
| 7.8 | **Verify**       | All frontend auth tests pass. Manual: register → login → logout flow works                                                                                                                             |

---

### Epic 8: Setup & Training Max UI

**Goal**: New users enter 1RMs, existing users can view/edit TMs.

| #   | Task           | Details                                                                                                                                                                                                                                          |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8.1 | TM API hooks   | `api/trainingMaxes.ts` - API functions for all TM endpoints. `hooks/useTrainingMaxes.ts` - fetch + cache current TMs                                                                                                                             |
| 8.2 | Setup page     | `pages/SetupPage.tsx` - 4 number inputs (Bench, Squat, OHP, Deadlift) labeled "1 Rep Max", unit suffix from preference. Submit calls POST `/api/training-maxes/setup`. Shows calculated TMs before confirming. Redirects to dashboard on success |
| 8.3 | Setup redirect | In DashboardPage, check if TMs exist. If not, redirect to `/setup`                                                                                                                                                                               |
| 8.4 | Tests          | Vitest: test useTrainingMaxes hook, test SetupPage form validation (positive numbers only). Playwright: register → setup → enter 1RMs → verify dashboard shows correct TMs                                                                       |
| 8.5 | **Verify**     | All tests pass                                                                                                                                                                                                                                   |

---

### Epic 9: Dashboard

**Goal**: Users see their 4 training days and can start a workout.

| #   | Task              | Details                                                                                                                                                                                                    |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1 | Workout card      | `components/WorkoutCard.tsx` - Card showing day number, label, T1 + T2 exercise names. States: upcoming (outlined), in-progress (highlighted), completed (muted + checkmark)                               |
| 9.2 | Dashboard page    | `pages/DashboardPage.tsx` - Fetch current workout + recent history to determine day statuses. Render 4 WorkoutCards vertically. Show current TMs summary. In-progress workout card shows "Continue" button |
| 9.3 | Workout API hooks | `api/workouts.ts` + `hooks/useWorkouts.ts` - fetch functions for all workout endpoints                                                                                                                     |
| 9.4 | Tests             | Vitest: test WorkoutCard renders correct state (upcoming, in-progress, completed). Playwright: dashboard shows 4 days, navigation to workout page works                                                    |
| 9.5 | **Verify**        | All tests pass                                                                                                                                                                                             |

---

### Epic 10: Workout Session (Core UX)

**Goal**: Users can perform a workout, log sets and AMRAP reps, see progression.

| #    | Task               | Details                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | Set row component  | `components/SetRow.tsx` - Shows: set # (1-9), weight (in user's unit), target reps. Non-AMRAP: tap toggles completed checkbox. AMRAP: shows AmrapInput. Visual: completed = green background, pending = default                                                                                                                              |
| 10.2 | AMRAP input        | `components/AmrapInput.tsx` - Number with large +/- stepper buttons for mobile. Shows target reps as hint. Min value = 0                                                                                                                                                                                                                     |
| 10.3 | Progression banner | `components/ProgressionBanner.tsx` - "Squat TM +5kg! New TM: 85kg". Color: green (increase), neutral (no change). Shown after workout completion                                                                                                                                                                                             |
| 10.4 | Workout page       | `pages/WorkoutPage.tsx` - On mount: check for existing in-progress workout for this day, or create new via API. Render T1 section header + 9 SetRows, then T2 section header + 8 SetRows. "Complete Workout" button at bottom (disabled until all sets marked). On complete: call API, show ProgressionBanner, button to return to dashboard |
| 10.5 | Tests              | Vitest: test SetRow renders weight/reps correctly, AmrapInput increments/decrements, ProgressionBanner shows correct message. Playwright: full workout E2E - start Day 2 → log all sets → enter AMRAP reps → complete → verify progression banner → return to dashboard                                                                      |
| 10.6 | **Verify**         | All tests pass                                                                                                                                                                                                                                                                                                                               |

---

### Epic 11: History

**Goal**: Users can review past workouts.

| #    | Task         | Details                                                                                                                                                                                                                                                    |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.1 | History page | `pages/HistoryPage.tsx` - Fetch paginated workout history. List items: date, day label (e.g. "Day 2 - Squat"), completion status. Expandable rows showing set details (weight, prescribed reps, actual reps for AMRAPs). "Load More" button for pagination |
| 11.2 | Tests        | Playwright: complete multiple workouts → verify history page shows them in correct order with correct data, expandable details work, pagination loads more                                                                                                 |
| 11.3 | **Verify**   | All tests pass                                                                                                                                                                                                                                             |

---

### Epic 12: Polish & Edge Cases

**Goal**: Handle edge cases, improve mobile UX.

| #    | Task                       | Details                                                                                                                                       |
| ---- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 12.1 | Unit conversion            | Ensure all displayed weights use user's preferred unit. Backend stores kg, frontend converts for lb users (× 2.20462, rounded to nearest 5lb) |
| 12.2 | Prevent duplicate workouts | Backend rejects POST `/api/workouts` if user has in-progress workout. Frontend handles gracefully (offer to continue existing or discard)     |
| 12.3 | Discard workout            | Add DELETE or PATCH endpoint to abandon an in-progress workout                                                                                |
| 12.4 | Loading & error states     | Spinners during API calls, error messages with retry, disabled buttons during submission                                                      |
| 12.5 | Touch targets              | Ensure all interactive elements are ≥ 44px height for comfortable mobile tapping                                                              |

---

## Implementation Order

```
Epic 1 (Scaffolding)
  │
  ▼
Epic 2 (Database)
  │
  ├──────────────────┐
  ▼                  ▼
Epic 3 (Auth)    Epic 4 (nSuns Logic)  ← parallel
  │                  │
  ▼                  │
Epic 5 (TM API) ◄───┘
  │
  ▼
Epic 6 (Workout API)
  │
  ▼
Epic 7 (Frontend Auth + Layout)
  │
  ▼
Epic 8 (Setup + TM UI)
  │
  ▼
Epic 9 (Dashboard)
  │
  ▼
Epic 10 (Workout Session)
  │
  ▼
Epic 11 (History)
  │
  ▼
Epic 12 (Polish)
```

Epics 3 and 4 can be done in parallel (auth is infrastructure, nSuns logic is pure domain). Everything else is sequential.

---

## Environment Setup

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:latest
    environment:
      POSTGRES_DB: treenisofta
      POSTGRES_USER: treenisofta
      POSTGRES_PASSWORD: treenisofta_dev
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### .env

```
DATABASE_URL=postgresql://treenisofta:treenisofta_dev@localhost:5432/treenisofta
JWT_SECRET=change-me-in-production
PORT=3001
NODE_ENV=development
```

### Dev Commands

```bash
docker compose up -d              # Start Postgres
npm install                       # Install all workspace deps
npm run migrate -w backend        # Run Knex migrations
npm run dev -w backend            # Express on :3001
npm run dev -w frontend           # Vite on :5173
```

---

## End-to-End Verification

1. `docker compose up -d` → Postgres running
2. `npm run dev -w backend` → Express on :3001
3. `npm run dev -w frontend` → Vite on :5173
4. Open browser → Register new user (kg preference)
5. Enter 1RMs: Bench 100kg, Squat 140kg, OHP 60kg, Deadlift 180kg
6. Dashboard shows TMs: Bench 90kg, Squat 126kg, OHP 54kg, Deadlift 162kg
7. Start Day 2 (Squat) → see 9 sets with correct weights (Set 3: 119.7→120kg at 95%)
8. Log all sets, enter 3 reps for the 95%x1+ AMRAP
9. Complete workout → see "Squat TM +2.5kg → 128.5kg"
10. Check History page → Day 2 workout visible with all set data
11. Start Day 2 again → weights now based on TM 128.5kg
