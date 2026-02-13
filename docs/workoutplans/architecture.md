# Multiple Workout Plans - Architecture Design

## 1. Current State Analysis

### What exists today

The app is hardcoded to the nSuns 4-Day LP program:

- **`backend/src/lib/nsuns.ts`**: Defines `NSUNS_4DAY` as a static TypeScript array of 4 `ProgramDay` objects, each with T1 and T2 `ExerciseSlot` containing set schemes (percentage, reps, isAmrap).
- **`backend/src/lib/progression.ts`**: Hardcoded progression rules keyed by upper/lower body exercise classification.
- **Exercise keys**: `'bench' | 'squat' | 'ohp' | 'deadlift'` are string literals used everywhere (DB, services, routes, frontend).
- **Training maxes**: Stored per user per exercise string, append-only with `effective_date`.
- **Workout generation**: `startWorkout()` calls `generateWorkoutSets(dayNumber, tmMap, 'kg')` which indexes into the static `NSUNS_4DAY` array.
- **Workout completion**: `completeWorkout()` directly references `NSUNS_4DAY[dayNumber - 1]` to find the progression AMRAP set.
- **Routes**: `POST /api/workouts` takes `{ dayNumber: 1-4 }` (hardcoded to 4 days).

### Key coupling points

1. `workout.dayNumber` (1-4) maps directly to `NSUNS_4DAY` array index
2. `workoutSet.exercise` is a free string (`'bench'`, `'squat'`, etc.)
3. `trainingMax.exercise` is the same free string
4. Progression logic assumes exactly 4 exercises with upper/lower classification
5. Frontend `DashboardPage` renders exactly 4 day cards
6. Frontend `SetupPage` collects exactly 4 1RM inputs

---

## 2. New Data Model

### Design principles

- **Exercise library is global**: Exercises are shared entities (e.g., "Bench Press" exists once, referenced by many plans).
- **Plans are templates**: A plan defines a structure (days, exercises, set schemes). Users subscribe to plans.
- **Training maxes stay per-user-per-exercise**: When a user switches plans, their TM history carries over for exercises that overlap.
- **Plans are versioned implicitly**: Once a user starts a plan, their subscription captures a snapshot. Plan edits by admins don't retroactively change in-progress cycles.
- **Backward compatible**: The nSuns 4-day program becomes a seed data entry, not hardcoded logic.

### Prisma Schema

```prisma
// ============================================================
// EXERCISE LIBRARY
// ============================================================

model Exercise {
  id          Int      @id @default(autoincrement())
  slug        String   @unique                        // e.g. "bench-press", "squat", "ohp"
  name        String                                  // e.g. "Bench Press"
  muscleGroup String?  @map("muscle_group")           // e.g. "chest", "legs", "shoulders"
  category    String   @default("compound")           // "compound" | "isolation"
  isUpperBody Boolean  @default(false) @map("is_upper_body") // for progression rule selection
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  planExercises  PlanDayExercise[]
  trainingMaxes  TrainingMax[]
  workoutSets    WorkoutSet[]

  @@map("exercises")
}

// ============================================================
// WORKOUT PLANS (admin-created templates)
// ============================================================

model WorkoutPlan {
  id          Int      @id @default(autoincrement())
  slug        String   @unique                        // e.g. "nsuns-4day-lp"
  name        String                                  // e.g. "nSuns 4-Day LP"
  description String?
  daysPerWeek Int      @map("days_per_week")          // 3, 4, 5, 6
  isPublic    Boolean  @default(true) @map("is_public")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  days          PlanDay[]
  subscriptions UserPlan[]
  progressionRules PlanProgressionRule[]

  @@map("workout_plans")
}

model PlanDay {
  id         Int  @id @default(autoincrement())
  planId     Int  @map("plan_id")
  dayNumber  Int  @map("day_number")                  // 1-based
  name       String?                                  // e.g. "Bench Volume + OHP"

  plan      WorkoutPlan       @relation(fields: [planId], references: [id], onDelete: Cascade)
  exercises PlanDayExercise[]

  @@unique([planId, dayNumber])
  @@map("plan_days")
}

model PlanDayExercise {
  id           Int    @id @default(autoincrement())
  planDayId    Int    @map("plan_day_id")
  exerciseId   Int    @map("exercise_id")
  tier         String                                 // "T1", "T2", "T3", etc.
  sortOrder    Int    @map("sort_order")              // ordering within the day
  tmExerciseId Int    @map("tm_exercise_id")          // which exercise's TM to use for % calc
  displayName  String? @map("display_name")           // override name, e.g. "Bench Volume", "Close Grip Bench"

  planDay    PlanDay  @relation(fields: [planDayId], references: [id], onDelete: Cascade)
  exercise   Exercise @relation(fields: [exerciseId], references: [id])
  tmExercise Exercise @relation("tmExerciseRef", fields: [tmExerciseId], references: [id])
  sets       PlanSet[]

  @@unique([planDayId, sortOrder])
  @@map("plan_day_exercises")
}

model PlanSet {
  id                Int     @id @default(autoincrement())
  planDayExerciseId Int     @map("plan_day_exercise_id")
  setOrder          Int     @map("set_order")           // 1-based within this exercise slot
  percentage        Decimal @db.Decimal(5, 4)           // e.g. 0.9500
  reps              Int
  isAmrap           Boolean @default(false) @map("is_amrap")
  isProgression     Boolean @default(false) @map("is_progression") // THE progression AMRAP

  planDayExercise PlanDayExercise @relation(fields: [planDayExerciseId], references: [id], onDelete: Cascade)

  @@unique([planDayExerciseId, setOrder])
  @@map("plan_sets")
}

// ============================================================
// PROGRESSION RULES (per-plan, per-exercise or per-category)
// ============================================================

model PlanProgressionRule {
  id         Int     @id @default(autoincrement())
  planId     Int     @map("plan_id")
  exerciseId Int?    @map("exercise_id")              // null = applies to category
  category   String?                                  // "upper" | "lower" (used if exerciseId is null)
  minReps    Int     @map("min_reps")
  maxReps    Int     @map("max_reps")                 // inclusive range
  increase   Decimal @db.Decimal(5, 2)                // kg increase

  plan WorkoutPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@map("plan_progression_rules")
}

// ============================================================
// USER-PLAN ASSOCIATION
// ============================================================

model UserPlan {
  id        Int       @id @default(autoincrement())
  userId    Int       @map("user_id")
  planId    Int       @map("plan_id")
  isActive  Boolean   @default(true) @map("is_active")
  startedAt DateTime  @default(now()) @map("started_at") @db.Timestamptz(3)
  endedAt   DateTime? @map("ended_at") @db.Timestamptz(3)

  user User        @relation(fields: [userId], references: [id])
  plan WorkoutPlan @relation(fields: [planId], references: [id])

  @@map("user_plans")
}

// ============================================================
// MODIFIED EXISTING MODELS
// ============================================================

model User {
  id             Int      @id @default(autoincrement())
  email          String   @unique
  passwordHash   String   @map("password_hash")
  displayName    String   @map("display_name")
  unitPreference String   @default("kg") @map("unit_preference")
  isAdmin        Boolean  @default(false) @map("is_admin")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  trainingMaxes TrainingMax[]
  workouts      Workout[]
  plans         UserPlan[]

  @@map("users")
}

model TrainingMax {
  id            Int      @id @default(autoincrement())
  userId        Int      @map("user_id")
  exerciseId    Int      @map("exercise_id")          // FK to Exercise (was free string)
  weight        Decimal  @db.Decimal(6, 2)
  effectiveDate DateTime @default(now()) @map("effective_date") @db.Timestamptz(3)
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  user     User     @relation(fields: [userId], references: [id])
  exercise Exercise @relation(fields: [exerciseId], references: [id])

  @@unique([userId, exerciseId, effectiveDate])
  @@map("training_maxes")
}

model Workout {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  planDayId   Int?      @map("plan_day_id")           // which plan day this was generated from (nullable for legacy)
  dayNumber   Int       @map("day_number")            // kept for display convenience
  status      String    @default("in_progress")
  completedAt DateTime? @map("completed_at") @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  user User         @relation(fields: [userId], references: [id])
  sets WorkoutSet[]

  @@map("workouts")
}

model WorkoutSet {
  id               Int      @id @default(autoincrement())
  workoutId        Int      @map("workout_id")
  exerciseId       Int      @map("exercise_id")       // FK to Exercise (was free string)
  tier             String
  setOrder         Int      @map("set_order")
  prescribedWeight Decimal  @db.Decimal(6, 2) @map("prescribed_weight")
  prescribedReps   Int      @map("prescribed_reps")
  isAmrap          Boolean  @default(false) @map("is_amrap")
  isProgression    Boolean  @default(false) @map("is_progression") // marks THE progression set
  actualReps       Int?     @map("actual_reps")
  completed        Boolean  @default(false)
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  workout  Workout  @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  exercise Exercise @relation(fields: [exerciseId], references: [id])

  @@index([workoutId, tier, setOrder])
  @@map("workout_sets")
}
```

### Key design decisions

1. **`PlanSet.isProgression`**: Explicitly marks which AMRAP set drives TM progression, rather than computing it at runtime by finding the highest-percentage AMRAP. This is clearer, works for any plan structure, and is set by the admin at plan creation time.

2. **`PlanDayExercise.tmExerciseId`**: Decouples the performed exercise from the TM used. E.g., "Close Grip Bench" (`exerciseId` = close-grip-bench) uses Bench Press's TM (`tmExerciseId` = bench-press). This replaces the old `tmExercise` string field.

3. **`Exercise.isUpperBody`**: Used by progression rules as a fallback category classifier. The `PlanProgressionRule` model allows per-plan, per-exercise overrides.

4. **`WorkoutSet.isProgression`**: Baked into the generated workout set at creation time. `completeWorkout()` no longer needs to reference the plan definition -- it just finds `isProgression: true` sets.

5. **`UserPlan`**: Tracks which plan a user is on, with history (start/end dates). Only one active plan at a time (enforced in application logic).

6. **`Workout.planDayId`**: Links a workout to the specific plan day it was generated from. Nullable for legacy data.

### Entity relationship summary

```
WorkoutPlan 1--* PlanDay 1--* PlanDayExercise 1--* PlanSet
                               |         |
                               |         +-- tmExerciseId --> Exercise
                               +------------ exerciseId ----> Exercise

WorkoutPlan 1--* PlanProgressionRule
WorkoutPlan 1--* UserPlan *--1 User

User 1--* TrainingMax *--1 Exercise
User 1--* Workout 1--* WorkoutSet *--1 Exercise
```

---

## 3. API Design

### Admin endpoints (require `isAdmin: true`)

```
POST   /api/admin/exercises              Create exercise
GET    /api/admin/exercises              List all exercises
PATCH  /api/admin/exercises/:id          Update exercise
DELETE /api/admin/exercises/:id          Delete exercise (fails if referenced by plans)

POST   /api/admin/plans                  Create plan (with nested days/exercises/sets)
GET    /api/admin/plans                  List all plans
GET    /api/admin/plans/:id              Get plan with full structure
PUT    /api/admin/plans/:id              Update plan (full replace of structure)
DELETE /api/admin/plans/:id              Delete plan (fails if users subscribed)

POST   /api/admin/plans/:id/progression-rules    Add/replace progression rules
```

### User endpoints (existing + new)

```
GET    /api/plans                        List available plans (public, with summary)
GET    /api/plans/:id                    Get plan details (day structure, exercises, set counts)

POST   /api/plans/:id/subscribe          Subscribe to plan (deactivates previous)
DELETE /api/plans/current                 Unsubscribe from current plan
GET    /api/plans/current                 Get user's active plan

GET    /api/exercises                     List exercises (for TM setup UI)
```

### Modified existing endpoints

```
POST   /api/training-maxes/setup         Now accepts exercise IDs instead of hardcoded keys
                                         { exerciseTMs: [{ exerciseId: 1, oneRepMax: 100 }, ...] }

GET    /api/training-maxes               Returns TMs for exercises required by current plan

POST   /api/workouts                     { dayNumber: N } - generates from user's active plan
                                         (dayNumber still used, but resolved via UserPlan -> PlanDay)

POST   /api/workouts/:id/complete        Finds isProgression sets, looks up progression rules
                                         from user's plan, applies TM increase
```

### Request/response shapes

#### Create plan (admin)

```typescript
// POST /api/admin/plans
{
  name: "nSuns 4-Day LP",
  slug: "nsuns-4day-lp",
  description: "Linear progression program by /u/nSuns",
  daysPerWeek: 4,
  isPublic: true,
  days: [
    {
      dayNumber: 1,
      name: "Bench Volume + OHP",
      exercises: [
        {
          exerciseId: 1,           // bench press
          tier: "T1",
          sortOrder: 1,
          tmExerciseId: 1,         // uses bench TM
          displayName: "Bench Volume",
          sets: [
            { setOrder: 1, percentage: 0.65, reps: 8, isAmrap: false, isProgression: false },
            { setOrder: 2, percentage: 0.75, reps: 6, isAmrap: false, isProgression: false },
            // ... all 9 sets
            { setOrder: 9, percentage: 0.65, reps: 8, isAmrap: true, isProgression: true },
          ]
        },
        {
          exerciseId: 3,           // OHP
          tier: "T2",
          sortOrder: 2,
          tmExerciseId: 3,         // uses OHP TM
          displayName: null,
          sets: [ /* 8 sets */ ]
        }
      ]
    },
    // ... days 2-4
  ],
  progressionRules: [
    { category: "upper", minReps: 0, maxReps: 1, increase: 0 },
    { category: "upper", minReps: 2, maxReps: 3, increase: 2.5 },
    { category: "upper", minReps: 4, maxReps: 5, increase: 2.5 },
    { category: "upper", minReps: 6, maxReps: 99, increase: 5 },
    { category: "lower", minReps: 0, maxReps: 1, increase: 0 },
    { category: "lower", minReps: 2, maxReps: 3, increase: 2.5 },
    { category: "lower", minReps: 4, maxReps: 5, increase: 5 },
    { category: "lower", minReps: 6, maxReps: 99, increase: 7.5 },
  ]
}
```

#### Subscribe to plan (user)

```typescript
// POST /api/plans/:id/subscribe
// Response:
{
  userPlan: { id: 1, planId: 2, startedAt: "2026-02-13T..." },
  requiredExercises: [
    { id: 1, slug: "bench-press", name: "Bench Press" },
    { id: 2, slug: "squat", name: "Squat" },
    // ...
  ],
  missingTMs: [
    { exerciseId: 3, slug: "ohp", name: "Overhead Press" }
  ]
}
```

---

## 4. Workout Generation (Revised)

### `startWorkout(userId, dayNumber)` flow

```
1. Get user's active plan (UserPlan where isActive = true)
2. Get PlanDay for (plan, dayNumber) with exercises and sets
3. Collect unique tmExerciseIds from the day's exercises
4. Fetch current TMs for those exercises (TrainingMax, latest effective_date)
5. For each PlanDayExercise:
   a. Look up TM for tmExerciseId
   b. For each PlanSet:
      - calculatedWeight = roundWeight(tm * percentage, userUnit)
      - Create WorkoutSet with exerciseId, tier, setOrder, weight, reps, isAmrap, isProgression
6. Insert Workout + WorkoutSets in transaction
7. Return formatted workout
```

### `completeWorkout(workoutId, userId)` flow

```
1. Fetch workout with sets
2. Find sets where isProgression = true
3. For each progression set:
   a. If actualReps is null, skip
   b. Get the exercise's TM exercise (from the original plan day exercise)
   c. Look up progression rules for user's plan + exercise category
   d. Find matching rule for actualReps
   e. If increase > 0, insert new TrainingMax row
4. Mark workout completed
5. Return workout + progression results (array, since multiple exercises could progress)
```

Key change: completion can now produce **multiple progression results** (e.g., if a plan has T1 exercises from different TM groups on the same day).

---

## 5. Migration Strategy

### Phase 1: Schema migration (additive, non-breaking)

1. **Create new tables**: `exercises`, `workout_plans`, `plan_days`, `plan_day_exercises`, `plan_sets`, `plan_progression_rules`, `user_plans`
2. **Add columns to existing tables**:
   - `users.is_admin` (default false)
   - `workout_sets.exercise_id` (nullable initially)
   - `workout_sets.is_progression` (default false)
   - `training_maxes.exercise_id` (nullable initially)
   - `workouts.plan_day_id` (nullable)
3. **Keep old columns**: `workout_sets.exercise` (string), `training_maxes.exercise` (string) remain for now

### Phase 2: Seed data

1. **Seed exercises**: Create the 6 exercises used by nSuns (bench, squat, ohp, deadlift, close-grip-bench, front-squat, sumo-deadlift). The 4 "main" exercises are TM-tracked; the 3 variants are exercise entries that reference main exercise TMs.
2. **Seed nSuns plan**: Insert the full nSuns 4-Day LP plan using the new schema (WorkoutPlan + PlanDays + PlanDayExercises + PlanSets + PlanProgressionRules)
3. **Auto-subscribe existing users**: Create `UserPlan` rows for all existing users pointing to the nSuns plan

### Phase 3: Backfill foreign keys

1. **Map exercise strings to IDs**: For each existing `training_maxes` row, set `exercise_id` based on `exercise` string -> `exercises.slug` lookup
2. **Map workout_sets**: Same mapping for `workout_sets.exercise` -> `exercise_id`
3. **Mark progression sets**: For existing workout_sets, compute `is_progression` using the old nSuns logic (highest-% AMRAP in T1)
4. **Set plan_day_id on workouts**: Map `workout.day_number` to the corresponding nSuns `plan_day.id`

### Phase 4: Make FKs required, drop old columns

1. Make `training_maxes.exercise_id` non-nullable
2. Make `workout_sets.exercise_id` non-nullable
3. Drop `training_maxes.exercise` string column
4. Drop `workout_sets.exercise` string column
5. Update unique constraint on `training_maxes` to use `exercise_id`

### Phase 5: Update application code

1. Replace `nsuns.ts` static data with DB queries
2. Update `workout.service.ts` to use plan-based generation
3. Update `trainingMax.service.ts` to use exercise IDs
4. Update `progression.ts` to query `PlanProgressionRule`
5. Add admin routes and middleware
6. Update frontend to handle plan selection

### Migration SQL sketch (Phase 1-3 in a single Prisma migration)

```sql
-- Phase 1: New tables
CREATE TABLE exercises (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT,
  category TEXT NOT NULL DEFAULT 'compound',
  is_upper_body BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE TABLE workout_plans ( /* ... */ );
CREATE TABLE plan_days ( /* ... */ );
CREATE TABLE plan_day_exercises ( /* ... */ );
CREATE TABLE plan_sets ( /* ... */ );
CREATE TABLE plan_progression_rules ( /* ... */ );
CREATE TABLE user_plans ( /* ... */ );

-- Phase 1: Add columns
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE training_maxes ADD COLUMN exercise_id INTEGER REFERENCES exercises(id);
ALTER TABLE workout_sets ADD COLUMN exercise_id INTEGER REFERENCES exercises(id);
ALTER TABLE workout_sets ADD COLUMN is_progression BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE workouts ADD COLUMN plan_day_id INTEGER;

-- Phase 2: Seed (done in a separate seed script or migration)
INSERT INTO exercises (slug, name, muscle_group, category, is_upper_body) VALUES
  ('bench-press', 'Bench Press', 'chest', 'compound', true),
  ('squat', 'Squat', 'legs', 'compound', false),
  ('ohp', 'Overhead Press', 'shoulders', 'compound', true),
  ('deadlift', 'Deadlift', 'back', 'compound', false),
  ('close-grip-bench', 'Close Grip Bench Press', 'chest', 'compound', true),
  ('sumo-deadlift', 'Sumo Deadlift', 'back', 'compound', false),
  ('front-squat', 'Front Squat', 'legs', 'compound', false);

-- Phase 3: Backfill
UPDATE training_maxes SET exercise_id = (
  SELECT id FROM exercises WHERE slug = CASE
    WHEN training_maxes.exercise = 'bench' THEN 'bench-press'
    WHEN training_maxes.exercise = 'squat' THEN 'squat'
    WHEN training_maxes.exercise = 'ohp' THEN 'ohp'
    WHEN training_maxes.exercise = 'deadlift' THEN 'deadlift'
  END
);

UPDATE workout_sets SET exercise_id = (
  SELECT id FROM exercises WHERE slug = CASE
    WHEN workout_sets.exercise = 'bench' THEN 'bench-press'
    WHEN workout_sets.exercise = 'squat' THEN 'squat'
    WHEN workout_sets.exercise = 'ohp' THEN 'ohp'
    WHEN workout_sets.exercise = 'deadlift' THEN 'deadlift'
  END
);
```

---

## 6. Admin Authorization

### Middleware

```typescript
// middleware/admin.ts
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  // userId is set by authenticate middleware
  // Fetch user and check isAdmin
  // Or: include isAdmin in JWT payload to avoid DB lookup
}
```

### Admin user creation

- First admin is created via a CLI command or seed script (`npx prisma db seed`)
- Subsequent admins are promoted by existing admins via `PATCH /api/admin/users/:id { isAdmin: true }`
- The `isAdmin` flag is added to the JWT payload at login time so the middleware can check it without a DB query

---

## 7. Frontend Changes (Summary)

### New pages

- **PlanBrowsePage** (`/plans`): Grid of available plans with name, description, days/week
- **PlanDetailPage** (`/plans/:id`): Full breakdown of the plan (days, exercises, set schemes)
- **AdminPage** (`/admin`): Exercise library management + plan builder (only visible to admins)

### Modified pages

- **SetupPage**: Instead of 4 hardcoded 1RM inputs, dynamically shows inputs for exercises required by the selected plan
- **DashboardPage**: Shows N day cards (from `plan.daysPerWeek`) instead of hardcoded 4
- **WorkoutPage**: No structural changes needed -- it already renders sets from the API response

### Plan selection flow

```
1. User registers -> redirected to /plans (instead of /setup)
2. User picks a plan -> POST /api/plans/:id/subscribe
3. Response includes requiredExercises and missingTMs
4. If missingTMs.length > 0 -> redirect to /setup with those exercises
5. User enters 1RMs -> POST /api/training-maxes/setup
6. Redirect to dashboard
```

---

## 8. Exercise Seed Data

The initial exercise library should include at minimum:

| slug | name | muscle_group | is_upper_body |
|------|------|-------------|---------------|
| bench-press | Bench Press | chest | true |
| squat | Squat | legs | false |
| ohp | Overhead Press | shoulders | true |
| deadlift | Deadlift | back | false |
| close-grip-bench | Close Grip Bench Press | chest | true |
| sumo-deadlift | Sumo Deadlift | back | false |
| front-squat | Front Squat | legs | false |
| incline-bench | Incline Bench Press | chest | true |
| barbell-row | Barbell Row | back | true |
| romanian-deadlift | Romanian Deadlift | back | false |
| leg-press | Leg Press | legs | false |
| dumbbell-ohp | Dumbbell OHP | shoulders | true |

Admins can add more exercises via the API.

---

## 9. Progression System (Generalized)

The current hardcoded progression in `progression.ts`:

```
0-1 reps  -> 0 kg
2-3 reps  -> 2.5 kg
4-5 reps  -> 2.5 kg (upper) / 5 kg (lower)
6+  reps  -> 5 kg (upper) / 7.5 kg (lower)
```

This becomes data in `PlanProgressionRule`:

```
plan_id | exercise_id | category | min_reps | max_reps | increase
1       | NULL        | upper    | 0        | 1        | 0
1       | NULL        | upper    | 2        | 3        | 2.5
1       | NULL        | upper    | 4        | 5        | 2.5
1       | NULL        | upper    | 6        | 99       | 5.0
1       | NULL        | lower    | 0        | 1        | 0
1       | NULL        | lower    | 2        | 3        | 2.5
1       | NULL        | lower    | 4        | 5        | 5.0
1       | NULL        | lower    | 6        | 99       | 7.5
```

Resolution order: exercise-specific rule > category rule. If no rule matches, increase = 0.

### `calculateProgression()` revised

```typescript
async function calculateProgression(
  planId: number,
  exerciseId: number,
  isUpperBody: boolean,
  amrapReps: number,
): Promise<{ increase: number }> {
  // Try exercise-specific rule first
  let rule = await prisma.planProgressionRule.findFirst({
    where: {
      planId,
      exerciseId,
      minReps: { lte: amrapReps },
      maxReps: { gte: amrapReps },
    },
  });

  // Fall back to category rule
  if (!rule) {
    rule = await prisma.planProgressionRule.findFirst({
      where: {
        planId,
        exerciseId: null,
        category: isUpperBody ? 'upper' : 'lower',
        minReps: { lte: amrapReps },
        maxReps: { gte: amrapReps },
      },
    });
  }

  return { increase: rule ? Number(rule.increase) : 0 };
}
```

---

## 10. Implementation Order

1. **Database migration**: Add new tables and columns (Phase 1-3)
2. **Exercise CRUD**: Admin routes for exercise management
3. **Plan CRUD**: Admin routes for plan creation/editing
4. **Seed nSuns**: Migrate hardcoded program to DB
5. **User plan subscription**: Subscribe/unsubscribe endpoints
6. **Refactor workout generation**: Use plan data instead of `NSUNS_4DAY`
7. **Refactor completion/progression**: Use `isProgression` flag and `PlanProgressionRule`
8. **Refactor training maxes**: Use `exerciseId` instead of string
9. **Update frontend**: Plan selection, dynamic setup, dynamic dashboard
10. **Drop old columns**: Final cleanup migration
11. **Admin UI**: Exercise library and plan builder interface
