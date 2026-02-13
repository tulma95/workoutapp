# Multi-Plan Support: Unified Implementation Plan

> Synthesized from Architecture (architect), UX Design (designer), and Risk Analysis (devil's advocate).

---

## Executive Summary

Transform the app from a hardcoded nSuns 4-Day LP tracker into a multi-plan workout platform. Admins create and manage workout plans via an admin UI; users browse, select, and switch plans. The existing nSuns program becomes seed data in the new schema.

### v1 Scope Boundaries

**In scope:** Exercise library, admin plan CRUD, user plan selection/switching, dynamic workout generation, configurable progression rules, admin authorization.

**Explicitly out of scope (v2+):** User-created plans, accessories/optional sets, deload weeks/periodization, exercise substitutions, rest timers/supersets, plan analytics/comparison, social/sharing features.

---

## 1. Data Model

### 1.1 New Tables

```prisma
model Exercise {
  id          Int      @id @default(autoincrement())
  slug        String   @unique                        // "bench-press", "squat"
  name        String                                  // "Bench Press"
  muscleGroup String?  @map("muscle_group")           // "chest", "legs"
  category    String   @default("compound")           // "compound" | "isolation"
  isUpperBody Boolean  @default(false) @map("is_upper_body")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  planExercises  PlanDayExercise[]
  tmExerciseFor  PlanDayExercise[] @relation("tmExerciseRef")
  trainingMaxes  TrainingMax[]
  workoutSets    WorkoutSet[]

  @@map("exercises")
}

model WorkoutPlan {
  id          Int       @id @default(autoincrement())
  slug        String    @unique
  name        String
  description String?
  daysPerWeek Int       @map("days_per_week")
  isPublic    Boolean   @default(true) @map("is_public")   // false = draft
  isSystem    Boolean   @default(false) @map("is_system")   // true = seeded, non-deletable
  archivedAt  DateTime? @map("archived_at") @db.Timestamptz(3)  // soft delete
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  days             PlanDay[]
  subscriptions    UserPlan[]
  progressionRules PlanProgressionRule[]

  @@map("workout_plans")
}

model PlanDay {
  id        Int     @id @default(autoincrement())
  planId    Int     @map("plan_id")
  dayNumber Int     @map("day_number")
  name      String?

  plan      WorkoutPlan       @relation(fields: [planId], references: [id], onDelete: Cascade)
  exercises PlanDayExercise[]

  @@unique([planId, dayNumber])
  @@map("plan_days")
}

model PlanDayExercise {
  id           Int     @id @default(autoincrement())
  planDayId    Int     @map("plan_day_id")
  exerciseId   Int     @map("exercise_id")       // exercise performed
  tier         String                             // "T1", "T2"
  sortOrder    Int     @map("sort_order")
  tmExerciseId Int     @map("tm_exercise_id")    // which exercise's TM to use
  displayName  String? @map("display_name")      // "Bench Volume", "Close Grip Bench"

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
  setOrder          Int     @map("set_order")
  percentage        Decimal @db.Decimal(5, 4)      // 0.9500 = 95%
  reps              Int
  isAmrap           Boolean @default(false) @map("is_amrap")
  isProgression     Boolean @default(false) @map("is_progression")

  planDayExercise PlanDayExercise @relation(fields: [planDayExerciseId], references: [id], onDelete: Cascade)

  @@unique([planDayExerciseId, setOrder])
  @@map("plan_sets")
}

model PlanProgressionRule {
  id         Int     @id @default(autoincrement())
  planId     Int     @map("plan_id")
  exerciseId Int?    @map("exercise_id")    // null = category-level rule
  category   String?                        // "upper" | "lower"
  minReps    Int     @map("min_reps")
  maxReps    Int     @map("max_reps")
  increase   Decimal @db.Decimal(5, 2)      // kg

  plan WorkoutPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@map("plan_progression_rules")
}

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
```

### 1.2 Modified Existing Tables

```prisma
model User {
  // existing fields...
  isAdmin Boolean @default(false) @map("is_admin")
  plans   UserPlan[]
}

model TrainingMax {
  // exercise string column -> replaced by exerciseId FK
  exerciseId Int @map("exercise_id")
  exercise   Exercise @relation(fields: [exerciseId], references: [id])
  // drop old 'exercise' string column after migration
}

model Workout {
  // add plan context
  planDayId Int? @map("plan_day_id")  // nullable for legacy data
}

model WorkoutSet {
  // exercise string column -> replaced by exerciseId FK
  exerciseId    Int     @map("exercise_id")
  isProgression Boolean @default(false) @map("is_progression")
  exercise      Exercise @relation(fields: [exerciseId], references: [id])
  // drop old 'exercise' string column after migration
}
```

### 1.3 Key Design Decisions

| Decision | Rationale | Risk Addressed |
|----------|-----------|----------------|
| `PlanSet.isProgression` | Explicitly marks which set drives TM increase; no runtime computation | Progression set identification (DA #4.2) |
| `PlanDayExercise.tmExerciseId` | Decouples performed exercise from TM source (CG Bench uses Bench TM) | TM mapping flexibility |
| `WorkoutSet.isProgression` | Baked at workout creation; completion logic self-contained | Plan version safety (DA #3.2) |
| `WorkoutPlan.archivedAt` | Soft delete; archived plans still work for existing users | Plan deletion with active users (DA #3.1) |
| `WorkoutPlan.isSystem` | nSuns seed plan cannot be deleted | Backward compatibility (DA #9.1) |
| One active plan per user | Enforced in app logic on UserPlan | Complexity containment (DA #2.4) |
| TMs are per-user-per-exercise, plan-agnostic | TMs carry over on plan switch for shared exercises | Plan switching (DA #2.2, #2.3) |
| Workout sets snapshot all data at creation | In-progress workouts unaffected by plan edits | Plan versioning (DA #3.2) |
| Progression rules are per-plan data | Different plans can have different progression logic | Progression decoupling (DA #4.1) |

---

## 2. API Design

### 2.1 Admin Endpoints (require `isAdmin: true`)

```
POST   /api/admin/exercises              Create exercise
GET    /api/admin/exercises              List all exercises
PATCH  /api/admin/exercises/:id          Update exercise
DELETE /api/admin/exercises/:id          Delete (fails if referenced by plans)

POST   /api/admin/plans                  Create plan (with nested days/exercises/sets/rules)
GET    /api/admin/plans                  List all plans (including archived, with user counts)
GET    /api/admin/plans/:id              Get plan with full structure
PUT    /api/admin/plans/:id              Update plan (full replace of structure)
DELETE /api/admin/plans/:id              Archive plan (soft delete)

POST   /api/admin/plans/:id/progression-rules   Add/replace progression rules
```

### 2.2 User Endpoints

```
GET    /api/plans                        List available plans (public, non-archived)
GET    /api/plans/:id                    Get plan details
GET    /api/plans/current                Get user's active plan with full structure
POST   /api/plans/:id/subscribe          Subscribe (deactivates previous, returns missing TMs)
```

### 2.3 Modified Existing Endpoints

```
POST   /api/training-maxes/setup         Accepts { exerciseTMs: [{ exerciseId, oneRepMax }] }
GET    /api/training-maxes               Returns TMs for current plan's exercises
POST   /api/workouts                     { dayNumber } - resolves via active plan
POST   /api/workouts/:id/complete        Uses isProgression flag + plan's progression rules
```

### 2.4 Key Response: Plan Subscribe

```typescript
// POST /api/plans/:id/subscribe -> 200
{
  userPlan: { id, planId, startedAt },
  requiredExercises: [{ id, slug, name }],
  missingTMs: [{ exerciseId, slug, name }]   // need 1RM setup
}
```

---

## 3. Admin Authorization

- Add `isAdmin` boolean to User model (default false)
- Include `isAdmin` in JWT payload at login time
- `requireAdmin` middleware checks JWT claim; rejects with 403
- First admin created via seed script or CLI command
- Admin promotion: `PATCH /api/admin/users/:id { isAdmin: true }` (admin-only)

---

## 4. Workout Generation (Revised)

### `startWorkout(userId, dayNumber)`

1. Get user's active plan (UserPlan where isActive = true)
2. Get PlanDay for (plan, dayNumber) with exercises and sets
3. Collect unique tmExerciseIds
4. Fetch current TMs (latest effective_date per exercise)
5. For each PlanDayExercise + PlanSet:
   - `weight = roundWeight(tm * percentage, userUnit)`
   - Create WorkoutSet with exerciseId, tier, setOrder, weight, reps, isAmrap, **isProgression**
6. Insert Workout + WorkoutSets in transaction
7. Return formatted workout

### `completeWorkout(workoutId, userId)`

1. Fetch workout with sets
2. Find sets where `isProgression = true` (may be multiple)
3. For each progression set with actualReps:
   a. Get exercise's isUpperBody classification
   b. Look up plan's progression rules (exercise-specific > category fallback)
   c. If increase > 0, insert new TrainingMax row
4. Mark workout completed
5. Return array of progression results

**Key change**: Completion can produce **multiple progressions** per workout. Frontend ProgressionBanner must handle an array.

---

## 5. Frontend Architecture

### 5.1 Route Structure

```
/login, /register           - Auth (unchanged)
/select-plan                - PlanSelectionPage (onboarding + switching)
/setup                      - SetupPage (dynamic exercises from plan)
/                           - DashboardPage (requires active plan)
/workout/:dayNumber         - WorkoutPage (plan-driven)
/history                    - HistoryPage (unchanged)
/settings                   - SettingsPage (+ plan section)

/admin                      - AdminLayout wrapper
/admin/plans                - PlanListPage
/admin/plans/new            - PlanEditorPage (create)
/admin/plans/:id            - PlanEditorPage (edit)
/admin/exercises            - ExerciseListPage
```

### 5.2 New Components

**User-facing:**
- `PlanSelectionPage` - browse plans, full-width cards
- `PlanSelectionCard` - plan name, description, days/week, exercises, select button
- `PlanSwitchConfirmModal` - warnings about in-progress workout, shared/new exercises
- `PartialSetupPage` - enter 1RMs only for exercises missing TMs

**Admin:**
- `AdminLayout` - header with "Back to App" + tab bar (Plans, Exercises)
- `ExerciseListPage` / `ExerciseCard` / `ExerciseFormModal`
- `PlanListPage` / `PlanCard` (with Active/Draft badge, user count)
- `PlanEditorPage` - metadata form + day tabs + routine builder
- `SetSchemeEditorModal` - per-exercise % / reps / AMRAP / progression config
- `ProgressionRulesEditor` - editable rep-range-to-increase table

### 5.3 Modified Components

| Component | Change |
|-----------|--------|
| `Layout` | Dynamic plan name in header |
| `App.tsx` | Add admin routes, plan selection route, AdminRoute guard |
| `DashboardPage` | Dynamic day cards from plan API; "Current Plan" row with [Change] |
| `SetupPage` | Dynamic exercise inputs from plan's required TM exercises |
| `WorkoutPage` | Remove hardcoded PROGRESSION_AMRAP_INDEX; use isProgression from API |
| `SettingsPage` | Add "Current Plan" section with [Change Plan] button |
| `AuthContext` | Add isAdmin, activePlanId to user state |

### 5.4 Key User Flows

**New user onboarding:** Register -> Select Plan -> Enter 1RMs (dynamic) -> Dashboard

**Plan switching:** Dashboard/Settings [Change] -> PlanSelectionPage -> Confirm modal (warn about in-progress workout) -> If missing TMs: PartialSetupPage -> Dashboard

**No plan state:** Dashboard shows "Choose a workout plan to get started" with [Browse Plans] button

### 5.5 Design Notes

- Bottom nav stays at 3 items (Dashboard, History, Settings)
- Admin accessed via header icon (admin users only), not bottom nav
- Admin uses purple accent (`--admin-accent: #7c3aed`) for visual distinction
- Plan status badges: Active (green pill), Draft (gray pill)
- Mobile-first: 48px touch targets, horizontal scroll for day tabs, bottom-sheet modals

---

## 6. Migration Strategy

### Phase 1: Additive Schema Changes (non-breaking)

1. Create new tables: exercises, workout_plans, plan_days, plan_day_exercises, plan_sets, plan_progression_rules, user_plans
2. Add columns: `users.is_admin`, `workout_sets.exercise_id` (nullable), `workout_sets.is_progression`, `training_maxes.exercise_id` (nullable), `workouts.plan_day_id` (nullable)
3. Keep old string columns temporarily

### Phase 2: Seed Data

1. Seed 7 exercises (bench-press, squat, ohp, deadlift, close-grip-bench, sumo-deadlift, front-squat)
2. Seed nSuns 4-Day LP plan with full structure (4 days, 8 exercise slots, all sets, progression rules) — mark as `isSystem: true`
3. Auto-subscribe all existing users to nSuns plan

### Phase 3: Backfill Foreign Keys

1. Map `training_maxes.exercise` string -> `exercise_id` via slug lookup
2. Map `workout_sets.exercise` string -> `exercise_id`
3. Compute `is_progression` for existing workout_sets using old nSuns logic
4. Map `workouts.day_number` to `plan_day_id` for nSuns plan

### Phase 4: Make FKs Required, Drop Old Columns

1. Make `training_maxes.exercise_id` and `workout_sets.exercise_id` non-nullable
2. Drop `training_maxes.exercise` and `workout_sets.exercise` string columns
3. Update unique constraints

### Phase 5: Application Code Update

1. Update backend services to use exercise IDs and plan-based generation
2. Add admin routes and middleware
3. Update frontend pages and components
4. Remove hardcoded nSuns references

---

## 7. Risk Mitigations Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| Plan edit corrupts in-progress workouts | Critical | Sets snapshot all data at creation; isProgression baked in; completion reads from workout data, not plan |
| Progression logic tightly coupled | Critical | Progression rules become per-plan data; isProgression flag eliminates runtime computation |
| Frontend hardcoded to nSuns | High | All pages become plan-data-driven; remove WORKOUT_DAYS, PROGRESSION_AMRAP_INDEX, hardcoded exercise types |
| Existing user disruption | High | nSuns seeded as system plan; users auto-subscribed; TMs migrated; UI unchanged for nSuns users |
| Admin authorization missing | High | isAdmin on User; requireAdmin middleware; JWT claim; first admin via seed |
| Plan deletion with active users | Medium | Soft delete (archivedAt); archived plans continue working; users prompted to switch |
| TM mismatch on plan switch | Medium | Subscribe endpoint returns missingTMs; PartialSetupPage for new exercises only |
| Stale TMs when returning to plan | Low | TMs persist across plans; show last known TM with date on plan return |
| Scope creep | Medium | Explicit v1 scope boundary; 7 features explicitly deferred to v2+ |

---

## 8. Implementation Phases

### Phase A: Foundation (backend)
1. Database migration (new tables + additive columns)
2. Seed data (exercises + nSuns plan)
3. Backfill existing data
4. Exercise CRUD admin endpoints
5. Plan CRUD admin endpoints
6. Admin authorization middleware

### Phase B: Core Logic (backend)
7. User plan subscription endpoints
8. Refactor workout generation to use plan data
9. Refactor completion/progression to use isProgression + plan rules
10. Refactor training maxes to use exercise IDs
11. Drop old string columns

### Phase C: Frontend - User Flows
12. PlanSelectionPage + PlanSelectionCard
13. Dynamic SetupPage (plan-driven exercise inputs)
14. Dynamic DashboardPage (plan-driven day cards + plan name)
15. Updated WorkoutPage (isProgression from API)
16. Plan switching flow (confirm modal, partial setup)
17. Settings page plan section

### Phase D: Frontend - Admin UI
18. AdminLayout + routing + AdminRoute guard
19. ExerciseListPage + ExerciseFormModal
20. PlanListPage + PlanCard
21. PlanEditorPage (metadata + day tabs + routine builder)
22. SetSchemeEditorModal
23. ProgressionRulesEditor

### Phase E: Polish & Testing
24. E2E tests for plan selection, switching, admin flows
25. Backend integration tests for new endpoints
26. Migration testing with realistic data

---

## 9. Hardcoded Coupling Points to Refactor

| File | What | Priority |
|------|------|----------|
| `backend/src/lib/nsuns.ts` | Entire file → becomes seed data | Phase A |
| `backend/src/lib/progression.ts` | 4-value Exercise type, upper/lower logic → plan rules | Phase B |
| `backend/src/services/workout.service.ts` | NSUNS_4DAY array index, hardcoded exercise list → plan queries | Phase B |
| `backend/src/services/trainingMax.service.ts` | EXERCISES constant → exercise library | Phase B |
| `backend/src/routes/trainingMaxes.ts` | VALID_EXERCISES → dynamic from plan | Phase B |
| `backend/src/routes/workouts.ts` | dayNumber max(4) → dynamic from plan | Phase B |
| `frontend/src/pages/DashboardPage.tsx` | WORKOUT_DAYS (4 days) → plan API | Phase C |
| `frontend/src/pages/WorkoutPage.tsx` | WORKOUT_DAYS, PROGRESSION_AMRAP_INDEX → plan API | Phase C |
| `frontend/src/pages/SetupPage.tsx` | 4 hardcoded inputs → dynamic from plan | Phase C |
| `frontend/src/types.ts` | Exercise type union → exercise library types | Phase B |
| `backend/src/types/index.ts` | Same Exercise type → exercise library types | Phase B |

---

## 10. Resolved Decisions

1. **Exercise metadata scope**: Start minimal (slug, name, muscleGroup, category, isUpperBody). Add equipment/movement type in v1.1 if needed. Seed database with a rich set of common exercises.

2. **Plan versioning**: Implicit — workout sets snapshot all data at creation time. No explicit version tracking in v1.

3. **Progression rules**: Data-driven (per-plan, per-exercise or per-category rules in DB). Plans can have progression rules or none at all — plans without rules simply don't auto-adjust TMs.

## 11. Exercise Seed Data

Seed the database with common barbell/bodyweight exercises:

| slug | name | muscle_group | category | is_upper_body |
|------|------|-------------|----------|---------------|
| bench-press | Bench Press | chest | compound | true |
| squat | Squat | legs | compound | false |
| deadlift | Deadlift | back | compound | false |
| ohp | Overhead Press | shoulders | compound | true |
| barbell-row | Barbell Row | back | compound | true |
| pull-up | Pull Up | back | compound | true |
| close-grip-bench | Close Grip Bench Press | chest | compound | true |
| sumo-deadlift | Sumo Deadlift | back | compound | false |
| front-squat | Front Squat | legs | compound | false |
| incline-bench | Incline Bench Press | chest | compound | true |
| romanian-deadlift | Romanian Deadlift | back | compound | false |
| dumbbell-ohp | Dumbbell OHP | shoulders | compound | true |
| leg-press | Leg Press | legs | compound | false |
| chin-up | Chin Up | back | compound | true |
| dip | Dip | chest | compound | true |
| pendlay-row | Pendlay Row | back | compound | true |
| hip-thrust | Hip Thrust | legs | compound | false |
| lateral-raise | Lateral Raise | shoulders | isolation | true |
| bicep-curl | Bicep Curl | arms | isolation | true |
| tricep-pushdown | Tricep Pushdown | arms | isolation | true |
| face-pull | Face Pull | shoulders | isolation | true |
| leg-curl | Leg Curl | legs | isolation | false |
| leg-extension | Leg Extension | legs | isolation | false |
| calf-raise | Calf Raise | legs | isolation | false |
