# Risks, Edge Cases, and Failure Scenarios

Analysis of the proposed expansion from hardcoded nSuns 4-Day LP to a multi-plan system with admin-created workout plans and a centralized exercise library.

---

## 1. Data Migration Risks

### 1.1 Existing Training Maxes Are Hardcoded to Four Exercises

**Risk**: The `training_maxes` table stores `exercise` as a free-form string (`'bench'`, `'squat'`, `'ohp'`, `'deadlift'`). If we introduce an exercise library with IDs, every existing row needs to be migrated to reference the new exercise entity. A failed or partial migration leaves orphaned training max data.

**Mitigation**: Create the exercise library entries for the four nSuns exercises first, then run a data migration that maps the string values to FK references. Do this in a single transaction. Keep the old `exercise` string column temporarily as a backup and drop it only after verifying the migration.

### 1.2 In-Progress Workouts During Migration

**Risk**: If a user has an `in_progress` workout when the migration runs, the workout's `workout_sets` rows reference exercise strings and are tied to the old nSuns program structure. The new schema may not know how to interpret these sets for completion/progression.

**Mitigation**: Either (a) force-complete or discard all in-progress workouts before migration (disruptive), or (b) ensure the migration preserves enough context in the workout/set rows that they can still be completed under old logic. Option (b) is safer -- keep a `plan_version_snapshot` or `program_id` on the workout row so completion logic knows which rules to apply.

### 1.3 Append-Only Training Max History Becomes Ambiguous

**Risk**: Currently, training max history is simple: one exercise, one timeline. With multiple plans, a user might track "bench" in nSuns and later switch to a plan that also has "bench" but with different progression rules. The training max history now mixes progression from different programs, making the timeline misleading.

**Mitigation**: Add a `plan_id` or `source` field to `training_maxes` rows so history can be filtered by which plan generated the progression. The "current TM" query should scope to the user's active plan.

---

## 2. Plan Switching Edge Cases

### 2.1 Switching Plans Mid-Workout

**Risk**: User starts a workout on Plan A, then their admin switches them to Plan B (or they switch themselves). The in-progress workout references Plan A's structure, but the system now thinks they're on Plan B. Completing the workout could apply wrong progression rules or crash.

**Mitigation**: Workouts must snapshot their plan at creation time. The `workout` row should store the `plan_id` (and ideally `plan_version`) used when it was generated. Completion logic reads from the snapshot, not the user's current plan assignment.

### 2.2 Training Max Mismatch Between Plans

**Risk**: User is on nSuns (tracks bench/squat/ohp/deadlift), switches to a plan that tracks bench/squat/incline press/Romanian deadlift. They have no training maxes for incline press or RDL. The new plan cannot generate workouts.

**Mitigation**: When assigning a user to a new plan, check which exercises require training maxes and prompt the user to enter missing ones (a "plan setup" flow). Do not allow workout generation until all required TMs exist. The frontend needs a dynamic setup page, not the current hardcoded 4-exercise form.

### 2.3 Orphaned Training Maxes After Plan Switch

**Risk**: After switching from nSuns to a plan without OHP, the user's OHP training max sits unused. If they switch back to nSuns later, should the old TM be reused? It may be months stale.

**Mitigation**: Training maxes should persist regardless of plan. When returning to a plan, show the user their last known TMs with dates and let them confirm or update. Do not silently reuse stale TMs.

### 2.4 Multiple Concurrent Plans

**Risk**: In v1, do users follow exactly one plan at a time, or can they be on multiple? If one plan, the constraint is simple. If multiple, the complexity explodes: which plan's progression applies? Which TMs are "current"?

**Mitigation**: v1 must enforce one active plan per user. This is a hard constraint, not a soft one. The schema should have a `user_active_plan` table with a unique constraint on `user_id`.

---

## 3. Admin Operations Edge Cases

### 3.1 Deleting a Plan That Users Are Currently Following

**Risk**: Admin deletes Plan A. 50 users are assigned to Plan A, 3 have in-progress workouts. What happens? Cascade delete destroys their workout history. Soft delete leaves zombie data.

**Mitigation**: Plans should never be hard-deleted. Use soft delete (`archived_at` timestamp). Archived plans cannot be assigned to new users but existing assignments and in-progress workouts continue to work. Users on archived plans should be prompted to switch.

### 3.2 Modifying a Plan While Users Have In-Progress Workouts

**Risk**: Admin changes Day 2 of a plan from "Squat 5x5" to "Squat 3x3". Users with in-progress Day 2 workouts have sets generated from the old definition. If the system re-reads the plan definition on completion, the progression logic may not match the sets that were actually performed.

**Mitigation**: Plan modifications must be versioned. Each change creates a new `plan_version`. In-progress workouts are pinned to the version they were started with. New workouts use the latest version. This is the single most important architectural decision for correctness.

### 3.3 Admin Creates Invalid Plan Definitions

**Risk**: Admin creates a plan where a day references an exercise that has no sets defined, or sets with 0% weight, or AMRAP sets with no progression rules. The system generates broken workouts.

**Mitigation**: Validate plan definitions server-side at creation time. Every day must have at least one exercise slot. Every slot must have at least one set. Percentages must be 0-200% (some programs use >100% for overloading). If progression rules reference AMRAP sets, verify those sets exist. Reject invalid plans with clear error messages.

### 3.4 Admin Role Authorization

**Risk**: There is currently no admin role in the system. The `User` model has no `role` field. Adding admin capabilities requires a new authorization layer. If poorly implemented, any user could potentially access admin endpoints.

**Mitigation**: Add a `role` enum (`'user'` | `'admin'`) to the `User` model with default `'user'`. Create `requireAdmin` middleware that checks `req.user.role === 'admin'`. All plan management endpoints must use this middleware. The first admin must be seeded or promoted via a CLI command, not a public API endpoint.

### 3.5 Race Condition: Admin Deletes Plan While User Starts Workout

**Risk**: User clicks "Start Workout" at the exact moment admin archives the plan. The `POST /api/workouts` handler reads the plan, but by the time it inserts the workout, the plan is archived.

**Mitigation**: Use a database transaction that checks plan status (not archived) as part of workout creation. Alternatively, since we soft-delete, allow workout creation on archived plans (the plan data still exists) and only prevent new plan assignments.

---

## 4. Progression Logic Challenges

### 4.1 nSuns-Specific AMRAP Logic vs. Generic Plans

**Risk**: The current progression system is deeply coupled to nSuns. Key assumptions:
- `calculateProgression()` takes an exercise of type `'bench' | 'squat' | 'ohp' | 'deadlift'` and returns a kg increase.
- The increase differs for upper vs. lower body lifts.
- The "progression AMRAP" is identified as the highest-percentage AMRAP set in T1.
- The frontend hardcodes `PROGRESSION_AMRAP_INDEX` per day number.

None of these assumptions hold for arbitrary plans. A 5/3/1 plan has different progression rules. A simple 5x5 plan might progress by adding weight weekly regardless of reps. A hypertrophy plan might not progress at all.

**Mitigation**: Progression must be a plan-level configuration, not a global function. Options:
- **Option A**: Define a `progression_type` enum on the plan (e.g., `'amrap_based'`, `'linear'`, `'percentage_based'`, `'none'`). Each type has its own logic.
- **Option B**: Define progression rules as data on the plan (e.g., "if AMRAP reps > X on set Y, increase TM by Z"). More flexible but harder to implement and validate.
- **Recommendation for v1**: Option A with 2-3 built-in types. Option B is scope creep.

### 4.2 Which Set Drives Progression?

**Risk**: In nSuns, the progression set is always the highest-percentage AMRAP in T1. But what if a custom plan has AMRAP sets in T2? Or has multiple AMRAP sets at the same percentage? Or has no AMRAP sets?

**Mitigation**: The plan definition must explicitly mark which set is the "progression set" (or which sets contribute to progression). Do not rely on implicit rules like "highest percentage AMRAP." Make it a field on the set scheme: `isProgressionSet: boolean`.

### 4.3 Multiple Exercises Progressing in One Workout

**Risk**: nSuns only progresses the T1 exercise per workout. But a custom plan might have two T1 exercises that both need to progress. Or a plan where T2 exercises also progress based on performance.

**Mitigation**: The completion logic must iterate over all exercise slots that have progression rules enabled, not just a single T1 slot. The response format must return an array of progressions, not a single object.

### 4.4 Progression Amounts in Different Units

**Risk**: `calculateProgression()` returns increases in kg (e.g., 2.5kg, 5kg, 7.5kg). These are sensible for kg users but need conversion for lb users. The current code does this conversion at the display layer. If custom plans define progression amounts, they need to be stored in a canonical unit (kg) and converted, or stored per-unit.

**Mitigation**: Always store progression amounts in kg internally, same as weights. Convert at display time. This is consistent with the existing approach and should not change.

---

## 5. Frontend Coupling Risks

### 5.1 Hardcoded Day Structure in Dashboard

**Risk**: `DashboardPage.tsx` hardcodes `WORKOUT_DAYS` with 4 specific days and their T1/T2 names. A custom plan with 3 days, 5 days, or 6 days breaks the dashboard entirely. A plan with 3 tiers (T1/T2/T3) won't render the third tier.

**Mitigation**: The dashboard must dynamically render workout days from the plan definition returned by the API. The `GET /api/users/me` or a new `GET /api/plans/active` endpoint must return the full day structure.

### 5.2 Hardcoded Progression AMRAP Index

**Risk**: `WorkoutPage.tsx` hardcodes `PROGRESSION_AMRAP_INDEX` mapping day numbers to set indices. This is fragile even for nSuns (if set order changes, the index is wrong) and completely broken for custom plans.

**Mitigation**: The backend should return which set is the progression set (e.g., a `isProgressionSet` flag on the workout set response). The frontend should not need to know nSuns-specific set ordering.

### 5.3 Hardcoded Exercise Type (`'bench' | 'squat' | 'ohp' | 'deadlift'`)

**Risk**: `types.ts` and multiple frontend files use the `Exercise` type union with 4 specific values. `formatExerciseName()` likely has a hardcoded mapping. Custom exercises like "Romanian Deadlift" or "Incline Bench" would fail to format or render correctly.

**Mitigation**: Exercises should come from the API with display names. The frontend should not maintain its own exercise name mapping. The exercise library API should return `{ id, name, muscleGroups }`.

### 5.4 Setup Page Assumes Exactly 4 Exercises

**Risk**: `SetupPage.tsx` renders exactly 4 hardcoded inputs (bench, squat, ohp, deadlift). A custom plan requiring 6 exercises or 2 exercises renders wrong.

**Mitigation**: The setup flow must be dynamic: fetch the list of exercises required by the active plan, render an input for each. Reuse the same form component pattern but drive it from plan data.

### 5.5 Route Structure Assumes `dayNumber` 1-4

**Risk**: `/workout/:dayNumber` uses the day number as a URL param. The validation `dayNumber >= 1 && dayNumber <= 4` is hardcoded on the backend. A 6-day plan fails validation.

**Mitigation**: The validation range must come from the plan definition (1 to `plan.dayCount`). The route itself (`/workout/:dayNumber`) can stay, but validation must be dynamic.

---

## 6. Security and Authorization

### 6.1 No Existing Admin Role System

**Risk**: The system has zero admin infrastructure. Adding admin features requires: role field on users, admin middleware, admin-only routes, admin UI with proper routing and auth guards. This is a significant surface area for security mistakes.

**Mitigation**: Keep admin features minimal in v1. Admin-only middleware must check the JWT role claim (not just a frontend check). Add the role to the JWT payload so it's available without a DB query per request. But also verify against DB for sensitive operations (role could be stale in long-lived tokens).

### 6.2 Plan Visibility and Access Control

**Risk**: Can all users see all plans? Can users see plan definitions they're not assigned to? Can a user assign themselves to any plan, or does an admin assign them?

**Mitigation**: Define clear access rules:
- Users can see a list of available (non-archived) plans with basic info.
- Users can view the full definition of their assigned plan.
- Users can request to switch plans (self-service) or admin assigns them.
- Plan creation/editing/archiving is admin-only.

### 6.3 User-Submitted Data in Plan Definitions

**Risk**: If admins can enter exercise names, descriptions, etc., these strings are displayed to other users. XSS risk if not properly escaped.

**Mitigation**: Sanitize all admin-submitted strings server-side. The React frontend escapes by default (JSX), but verify no `dangerouslySetInnerHTML` is used for plan content. Validate string lengths and character sets on the backend.

---

## 7. Performance Concerns

### 7.1 Dynamic Plan Loading vs. Hardcoded

**Risk**: Currently, `NSUNS_4DAY` is a constant imported at module load time. Zero DB queries to know the program structure. With dynamic plans, every workout start requires querying the plan definition, its days, exercise slots, and set schemes. This is multiple JOINs or queries.

**Mitigation**: Plan definitions are read-heavy and rarely change. Cache the active plan definition in memory (or Redis) with invalidation on plan update. For v1 with few plans, even without caching, the query is probably fine (a plan has ~4 days x 2 slots x ~9 sets = ~72 rows -- trivial).

### 7.2 Training Max Queries Scale with Exercise Count

**Risk**: Currently, `getCurrentTMs` queries 4 exercises in parallel. A plan with 10 exercises means 10 parallel queries. The training max query (`findFirst ORDER BY effective_date DESC`) does a sort per exercise.

**Mitigation**: Replace the N parallel queries with a single query using `DISTINCT ON (exercise) ORDER BY exercise, effective_date DESC`. Prisma may not support `DISTINCT ON` natively, so a raw query might be needed. This should be done regardless of the multi-plan feature.

### 7.3 Workout History Grows with More Plans

**Risk**: Users switching between plans accumulate more workout history. The history page and calendar queries may slow down. Currently, queries filter by `userId` which is indexed via the FK.

**Mitigation**: Ensure indexes on `(userId, status)` and `(userId, completedAt)` for the workouts table. These likely already exist implicitly. Not a major concern for v1 scale.

---

## 8. Scope Creep Risks -- What NOT to Include in v1

### 8.1 Custom User-Created Plans

**Risk**: If users can create their own plans (not just admins), the complexity of validation, sharing, and support explodes. Users will create broken plans and report bugs.

**Mitigation**: v1 is admin-created plans only. Users select from the available catalog. User-created plans is a v2+ feature.

### 8.2 Plan Sharing / Social Features

**Risk**: "Let me share my plan with a friend" leads to copy/fork semantics, version tracking across users, attribution, etc.

**Mitigation**: Out of scope for v1. All plans are global (visible to all users).

### 8.3 Customizable Accessories / Optional Sets

**Risk**: Many programs (including nSuns) have optional accessory work after the main lifts. Supporting user-customizable accessories per workout day is a significant feature.

**Mitigation**: Out of scope for v1. Plans define fixed set schemes. Accessories can be a v2 feature.

### 8.4 Deload Weeks / Periodization

**Risk**: Some programs have built-in deload weeks (e.g., every 4th week is lighter). This requires tracking which "cycle week" the user is on.

**Mitigation**: Out of scope for v1. Linear progression only. Periodized programs are a v2+ feature.

### 8.5 Exercise Substitutions

**Risk**: "I don't have a front squat rack, can I swap it for leg press?" per-user exercise substitutions require a mapping layer.

**Mitigation**: Out of scope for v1. Users do the exercises as defined in the plan.

### 8.6 Rest Timers / Supersets / Circuit Definitions

**Risk**: Feature creep into workout execution details beyond weight/reps/sets.

**Mitigation**: Out of scope for v1. Keep the workout tracking model identical to current: sets with weight, reps, and completion status.

### 8.7 Plan Analytics / Comparison

**Risk**: "Show me how I progressed on Plan A vs Plan B" requires cross-plan reporting.

**Mitigation**: Out of scope for v1. The existing TM history with plan_id filtering is sufficient.

---

## 9. Backward Compatibility

### 9.1 Existing nSuns Users Must Not Be Disrupted

**Risk**: The highest priority risk. Current users have working accounts, training maxes, workout history, and possibly in-progress workouts. Any migration that breaks their flow is unacceptable.

**Mitigation**:
- Create the nSuns 4-Day LP as a system plan (seeded, not deletable).
- Auto-assign all existing users to this plan.
- Migrate existing training maxes to reference the exercise library entries.
- Existing workouts remain valid (they have all data inline in workout_sets).
- The dashboard should look and function identically for nSuns users after migration.

### 9.2 API Backward Compatibility

**Risk**: Frontend clients hitting old API shapes will break if we change response formats. If the mobile app or other clients exist, this is worse.

**Mitigation**: Currently this is a single web app, so frontend and backend deploy together. But still: version the API or ensure new fields are additive (never remove fields from responses in v1). The existing endpoints (`POST /api/workouts`, `POST /api/workouts/:id/complete`) should continue to work with the same request/response shape, with optional new fields.

### 9.3 The `dayNumber` Concept

**Risk**: Currently `dayNumber` is 1-4 and is stored on the workout. With dynamic plans, day numbers are plan-relative. If a user switches plans, their old workouts have `dayNumber: 3` which meant "Bench Heavy + CG Bench" on nSuns but might mean something else on the new plan.

**Mitigation**: `dayNumber` on existing workouts is fine because it's historical data. The workout_sets already contain the full exercise/weight/rep data. The `dayNumber` on old workouts can be displayed with the plan name for context. New workouts should also store `plan_day_id` (FK to the plan's day definition) for unambiguous reference.

---

## 10. Technical Debt and Coupling Inventory

A comprehensive list of hardcoded nSuns assumptions that must be refactored:

| Location | Coupling | Severity |
|---|---|---|
| `backend/src/lib/nsuns.ts` | Entire file is nSuns-specific | High -- must become one of many plan definitions |
| `backend/src/lib/progression.ts` | `Exercise` type is 4-value union, upper/lower body logic | High -- must become plan-configurable |
| `backend/src/services/workout.service.ts:84` | Hardcodes `['bench', 'squat', 'ohp', 'deadlift']` for TM lookup | High |
| `backend/src/services/workout.service.ts:214` | `NSUNS_4DAY[workout.dayNumber - 1]` for completion logic | High |
| `backend/src/services/trainingMax.service.ts:6` | `EXERCISES` constant with 4 values | High |
| `backend/src/routes/trainingMaxes.ts:11` | `VALID_EXERCISES` with 4 values | High |
| `backend/src/routes/workouts.ts:13` | `dayNumber` validation `min(1).max(4)` | Medium |
| `frontend/src/pages/DashboardPage.tsx:12` | `WORKOUT_DAYS` array with 4 hardcoded days | High |
| `frontend/src/pages/WorkoutPage.tsx:21` | `WORKOUT_DAYS` duplicated | High |
| `frontend/src/pages/WorkoutPage.tsx:29` | `PROGRESSION_AMRAP_INDEX` per day | High |
| `frontend/src/pages/SetupPage.tsx:12` | 4 hardcoded exercise inputs | High |
| `frontend/src/types.ts:3` | `Exercise` type with 4 values | Medium |
| `backend/src/types/index.ts:1` | Same `Exercise` type | Medium |

---

## 11. Summary of Critical Risks (Ordered by Severity)

1. **Plan versioning for in-progress workouts** -- Without this, any plan edit corrupts active workouts. Must be in the architecture from day one.

2. **Progression logic decoupling** -- The current AMRAP-based progression is deeply embedded. Extracting it into a configurable system is the hardest engineering task.

3. **Frontend hardcoding** -- Nearly every frontend page assumes nSuns structure. The refactor is extensive but straightforward.

4. **Data migration for existing users** -- Must be seamless. Auto-assign to nSuns plan, migrate TMs to exercise library references.

5. **Admin authorization** -- No existing infrastructure. Must be built correctly from scratch.

6. **Scope creep** -- The temptation to add accessories, periodization, exercise substitutions, and user-created plans will be strong. Resist until v1 ships.
