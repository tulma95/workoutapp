# UX/UI Design: Multi-Plan Support & Admin Interface

## Current State Analysis

### Existing Pages & Navigation

The app currently has a mobile-first layout with a fixed bottom nav bar (Dashboard, History, Settings). All pages sit inside a `<Layout>` component that provides the header ("nSuns 4-Day LP") and bottom nav. The container is max 30rem wide, centered.

**Current page inventory:**
- `LoginPage` / `RegisterPage` - standalone auth pages (no Layout wrapper)
- `SetupPage` - 1RM entry for 4 hardcoded exercises (bench/squat/ohp/deadlift)
- `DashboardPage` - shows training maxes + 4 hardcoded workout day cards
- `WorkoutPage` - active workout session with T1/T2 set lists
- `HistoryPage` - calendar view of past workouts
- `SettingsPage` - display name, email, unit preference, logout

**Existing UI patterns:**
- Cards with white background, 1px border, 8px border-radius
- Two button styles: `btn-primary` (blue), `btn-secondary` (white/border)
- Modal pattern: overlay + centered card (used for TM editing)
- Loading: `<LoadingSpinner>`, errors: `<ErrorMessage>` with retry
- Inline styles mixed with CSS files (both patterns exist)
- CSS custom properties for colors and spacing (8-point grid)

### What Must Change

The dashboard currently hardcodes `WORKOUT_DAYS` as a 4-element array. The SetupPage hardcodes 4 exercises. The WorkoutPage hardcodes `PROGRESSION_AMRAP_INDEX`. All of these become dynamic based on the user's selected plan.

---

## 1. Admin Interface Design

Admin pages live under `/admin/*` routes and use a separate `AdminLayout` component. Admin is accessed via a gear/wrench icon in the header (visible only to admin users). Admin pages are desktop-friendly but still functional on mobile.

### 1.1 Admin Navigation

Admin uses a top-level tab bar (not the bottom nav) since admin tasks are different from user workout flows.

```
+------------------------------------------+
| <- Back to App    Admin Panel            |
+------------------------------------------+
| [Plans]  [Exercises]                     |
+------------------------------------------+
|                                          |
|  (tab content area)                      |
|                                          |
+------------------------------------------+
```

- "Back to App" link returns to user dashboard
- Two tabs: Plans, Exercises
- No bottom nav in admin (admin is a separate context)

### 1.2 Exercise Library (`/admin/exercises`)

```
+------------------------------------------+
| Exercises                    [+ Add New] |
+------------------------------------------+
| Search: [___________________________]    |
+------------------------------------------+
|                                          |
| +--------------------------------------+ |
| | Bench Press                          | |
| | barbell / push / chest               | |
| | Used in: nSuns 4-Day, 5/3/1          | |
| | [Edit]                               | |
| +--------------------------------------+ |
|                                          |
| +--------------------------------------+ |
| | Squat                                | |
| | barbell / push / legs                | |
| | Used in: nSuns 4-Day                 | |
| | [Edit]                               | |
| +--------------------------------------+ |
|                                          |
| (scrollable list)                        |
+------------------------------------------+
```

**Exercise Card** shows: name, equipment type, movement type, muscle group, how many plans use it.

#### Add/Edit Exercise (modal or inline page)

```
+------------------------------------------+
| Add Exercise                             |
+------------------------------------------+
| Name:      [_________________________]   |
| Equipment: [barbell        v]            |
| Movement:  [compound       v]            |
| Muscles:   [chest, triceps v]            |
|                                          |
| [Cancel]              [Save Exercise]    |
+------------------------------------------+
```

Fields:
- **Name** (text, required)
- **Equipment** (select: barbell, dumbbell, cable, machine, bodyweight)
- **Movement type** (select: compound, isolation)
- **Primary muscles** (multi-select or tags)

Delete: only allowed if exercise is not used in any active plan. Show warning otherwise.

### 1.3 Plan Management (`/admin/plans`)

#### Plan List

```
+------------------------------------------+
| Workout Plans                [+ Create]  |
+------------------------------------------+
|                                          |
| +--------------------------------------+ |
| | nSuns 4-Day LP            [Active]   | |
| | 4 days / week                        | |
| | 12 users on this plan                | |
| | [Edit] [Duplicate]                   | |
| +--------------------------------------+ |
|                                          |
| +--------------------------------------+ |
| | 5/3/1 BBB                 [Draft]    | |
| | 4 days / week                        | |
| | 0 users on this plan                 | |
| | [Edit] [Duplicate] [Delete]          | |
| +--------------------------------------+ |
|                                          |
+------------------------------------------+
```

**Plan Card** shows: name, days/week, user count, status badge (Active/Draft), action buttons.

- **Active** plans are visible to users for selection
- **Draft** plans are admin-only, not selectable by users
- Delete only available for plans with 0 users

#### Plan Editor (`/admin/plans/:id`)

The plan editor is the most complex admin screen. It has a top section for plan metadata and a tabbed/scrollable section for day routines.

```
+------------------------------------------+
| <- Plans    Edit Plan                    |
+------------------------------------------+
| Plan Name: [nSuns 4-Day LP____________]  |
| Description: [Linear progression........]|
| Days/Week:  [4]                          |
| Status:     [Active v]                   |
+------------------------------------------+
| DAYS                                     |
+------------------------------------------+
| [Day 1] [Day 2] [Day 3] [Day 4] [+]     |
+------------------------------------------+
|                                          |
| Day 1                                    |
| Label: [Bench / OHP___________________] |
|                                          |
| -- T1 Exercises --                       |
| +--------------------------------------+ |
| | Bench Press (T1)                     | |
| | TM Source: bench                     | |
| | Sets: 9                             | |
| | [Edit Sets] [Remove]                | |
| +--------------------------------------+ |
|                                          |
| [+ Add T1 Exercise]                     |
|                                          |
| -- T2 Exercises --                       |
| +--------------------------------------+ |
| | OHP (T2)                             | |
| | TM Source: ohp                       | |
| | Sets: 8                             | |
| | [Edit Sets] [Remove]                | |
| +--------------------------------------+ |
|                                          |
| [+ Add T2 Exercise]                     |
|                                          |
+------------------------------------------+
| [Save Plan]                              |
+------------------------------------------+
```

#### Set Scheme Editor (modal, opens from "Edit Sets")

```
+------------------------------------------+
| Bench Press - Set Scheme                 |
+------------------------------------------+
| Progression AMRAP set: [Set 9  v]        |
+------------------------------------------+
| Set 1: [65]% x [8] reps  [ ] AMRAP      |
| Set 2: [75]% x [6] reps  [ ] AMRAP      |
| Set 3: [85]% x [4] reps  [ ] AMRAP      |
| Set 4: [85]% x [4] reps  [ ] AMRAP      |
| Set 5: [85]% x [4] reps  [ ] AMRAP      |
| Set 6: [80]% x [5] reps  [ ] AMRAP      |
| Set 7: [75]% x [6] reps  [ ] AMRAP      |
| Set 8: [70]% x [7] reps  [ ] AMRAP      |
| Set 9: [65]% x [8] reps  [x] AMRAP  <-- |
|                                          |
| [+ Add Set]                             |
|                                          |
| [Cancel]                    [Save Sets]  |
+------------------------------------------+
```

Each set row: percentage input, reps input, AMRAP checkbox. The "Progression AMRAP set" dropdown selects which AMRAP set drives TM progression for this exercise.

#### Progression Rules Editor (section within Plan Editor)

```
+------------------------------------------+
| PROGRESSION RULES                        |
+------------------------------------------+
| AMRAP Reps   | TM Increase              |
| 0-1          | [0   ] kg                |
| 2-3          | [2.5 ] kg                |
| 4-5          | [5   ] kg                |
| 6+           | [7.5 ] kg                |
+------------------------------------------+
```

Editable table. Each row: rep range (fixed labels) + weight increase input.

### 1.4 Admin Components Hierarchy

```
AdminLayout
  AdminNav (top tab bar: Plans, Exercises)

ExerciseListPage
  ExerciseCard
  ExerciseFormModal (add/edit)

PlanListPage
  PlanCard (with status badge, action buttons)

PlanEditorPage
  PlanMetadataForm (name, description, days, status)
  DayTabBar (horizontal scrollable day tabs)
  DayRoutineEditor
    RoutineExerciseCard (shows exercise + set count)
    AddExerciseModal (search + select from exercise library)
  SetSchemeEditor (modal)
  ProgressionRulesEditor
```

---

## 2. User-Facing Plan Selection UX

### 2.1 Onboarding Flow (New User)

After registration, the user currently goes to `/setup` to enter 1RMs. With multi-plan support, an intermediate step is added.

**Flow: Register -> Select Plan -> Enter 1RMs -> Dashboard**

#### Plan Selection Page (`/select-plan`)

Shown after registration (before setup). Also accessible from Settings.

```
+------------------------------------------+
|          Choose Your Program             |
+------------------------------------------+
| Pick a workout plan to get started.      |
| You can change this later in Settings.   |
+------------------------------------------+
|                                          |
| +--------------------------------------+ |
| | nSuns 4-Day LP                       | |
| | 4 days/week                          | |
| | Linear progression with AMRAP sets   | |
| | for intermediate lifters.            | |
| |                                      | |
| | Exercises: Bench, Squat, OHP, Dead   | |
| |                                      | |
| |              [Select This Plan]      | |
| +--------------------------------------+ |
|                                          |
| +--------------------------------------+ |
| | 5/3/1 Boring But Big                 | |
| | 4 days/week                          | |
| | Wendler's classic program with       | |
| | 5x10 supplemental work.             | |
| |                                      | |
| | Exercises: Bench, Squat, OHP, Dead   | |
| |                                      | |
| |              [Select This Plan]      | |
| +--------------------------------------+ |
|                                          |
+------------------------------------------+
```

Each **PlanSelectionCard** shows:
- Plan name (large, bold)
- Days per week
- Short description (2-3 lines)
- List of primary exercises
- "Select This Plan" button

Tapping "Select This Plan" navigates to `/setup` where the required 1RM inputs are **dynamically generated** based on the plan's required exercises (no longer hardcoded to 4).

#### Dynamic Setup Page

The SetupPage receives the list of required exercises from the selected plan. Instead of hardcoded bench/squat/ohp/deadlift inputs, it renders one input per unique TM source exercise required by the plan.

```
+------------------------------------------+
| Enter Your 1 Rep Maxes                   |
+------------------------------------------+
| These will be used to calculate your     |
| training maxes (90% of 1RM) for the     |
| nSuns 4-Day LP program.                 |
+------------------------------------------+
|                                          |
| Bench Press (kg)                         |
| [___________________________________]   |
|                                          |
| Squat (kg)                               |
| [___________________________________]   |
|                                          |
| Overhead Press (kg)                      |
| [___________________________________]   |
|                                          |
| Deadlift (kg)                            |
| [___________________________________]   |
|                                          |
| [Calculate Training Maxes]               |
+------------------------------------------+
```

### 2.2 Dashboard with Active Plan

The dashboard header area shows the current plan name. Workout day cards are dynamically generated from the plan definition.

```
+------------------------------------------+
| nSuns 4-Day LP                   header  |
+------------------------------------------+
| Dashboard                                |
|                                          |
| Current Plan: nSuns 4-Day LP  [Change]   |
|                                          |
| -- Training Maxes --                     |
| Bench Press      80 kg         [Edit]    |
| Squat            100 kg        [Edit]    |
| OHP              50 kg         [Edit]    |
| Deadlift         120 kg        [Edit]    |
|                                          |
| -- Workout Days --                       |
| +--------------------------------------+ |
| | Day 1                                | |
| | T1: Bench Volume  T2: OHP           | |
| |              [Start Workout]         | |
| +--------------------------------------+ |
| | Day 2                                | |
| | T1: Squat  T2: Sumo Deadlift        | |
| |              [Start Workout]         | |
| +--------------------------------------+ |
| ...                                      |
+------------------------------------------+
```

**Key change:** "Current Plan" row with the plan name and a [Change] link. The [Change] link navigates to plan selection/switching flow.

The Layout header can also update to show the plan name instead of hardcoded "nSuns 4-Day LP".

### 2.3 Plan Switching Flow

Accessible from:
1. Dashboard "Change" link next to plan name
2. Settings page "Change Plan" button

#### From Settings

```
+------------------------------------------+
| Settings                                 |
+------------------------------------------+
| Display Name                             |
| John Doe                                 |
+------------------------------------------+
| Email                                    |
| john@example.com                         |
+------------------------------------------+
| Unit Preference                          |
| [kg] [lb]                                |
+------------------------------------------+
| Current Plan                             |
| nSuns 4-Day LP                           |
| [Change Plan]                            |
+------------------------------------------+
| [Log Out]                                |
+------------------------------------------+
```

#### Plan Switch Confirmation

When switching plans, we must handle the case where the user has an in-progress workout or existing training maxes that may not apply to the new plan.

```
+------------------------------------------+
| Switch to 5/3/1 BBB?                     |
+------------------------------------------+
|                                          |
| You're currently on nSuns 4-Day LP.      |
|                                          |
| (!) You have a workout in progress.      |
|     It will be discarded if you switch.  |
|                                          |
| Your training maxes for shared           |
| exercises (Bench, Squat, OHP, Deadlift)  |
| will carry over to the new plan.         |
|                                          |
| New exercises in this plan will need     |
| 1RM setup after switching.               |
|                                          |
| [Cancel]           [Switch Plan]         |
+------------------------------------------+
```

**Logic for plan switching:**

1. **In-progress workout**: Show warning, auto-discard on switch
2. **Shared TM exercises**: If the new plan uses exercises that already have TMs (e.g., both plans use bench), those TMs carry over automatically
3. **New exercises**: If the new plan requires TMs for exercises the user doesn't have, redirect to a partial setup page showing only the missing exercises
4. **Orphaned TMs**: TMs for exercises not in the new plan are kept in the database (for history) but not displayed

#### Partial Setup Page (after switch)

If switching to a plan that requires exercises without existing TMs:

```
+------------------------------------------+
| Set Up New Exercises                     |
+------------------------------------------+
| Your new plan requires 1RM data for      |
| exercises you haven't used before.       |
+------------------------------------------+
|                                          |
| Front Squat (kg)                         |
| [___________________________________]   |
|                                          |
| [Save and Start Plan]                    |
+------------------------------------------+
```

### 2.4 Active Plan Indication

The user should always know which plan they're on:

1. **Layout header**: Shows plan name instead of hardcoded "nSuns 4-Day LP"
2. **Dashboard**: "Current Plan: X" row at top
3. **Settings**: Plan name with change button
4. **Workout page**: Header shows plan context (e.g., "Day 1 - Bench Volume" remains the same, plan-driven)

### 2.5 No Plan Selected State

If a user has no plan (e.g., after reset or on first load without a plan):

```
+------------------------------------------+
|          Welcome!                        |
+------------------------------------------+
| To get started, choose a workout plan.   |
|                                          |
| [Browse Plans]                           |
+------------------------------------------+
```

This replaces the dashboard content. The bottom nav still shows but Dashboard redirects to plan selection.

---

## 3. Component Architecture

### New Components

```
User-Facing:
  PlanSelectionPage        - browse and select a plan (used in onboarding + switching)
    PlanSelectionCard      - individual plan card with description and select button
  PlanSwitchConfirmModal   - confirmation dialog when switching plans mid-use
  PartialSetupPage         - enter 1RMs for only new/missing exercises

Admin (under /admin):
  AdminLayout              - header with back link + tab bar (no bottom nav)
  AdminNav                 - Plans / Exercises tab bar

  ExerciseListPage         - searchable list of exercises
    ExerciseCard           - single exercise display
    ExerciseFormModal      - add/edit exercise form

  PlanListPage             - list of all plans with status
    PlanCard               - plan summary with actions

  PlanEditorPage           - full plan editing interface
    PlanMetadataForm       - name, description, days, status fields
    DayTabBar              - horizontal scrollable tabs for days
    DayRoutineEditor       - exercises within a day
      RoutineExerciseCard  - exercise + set count display
      AddExerciseModal     - search exercise library to add
    SetSchemeEditorModal   - edit sets for an exercise
    ProgressionRulesEditor - editable progression table
```

### Modified Existing Components

| Component | Change |
|-----------|--------|
| `Layout` | Header shows dynamic plan name from user context |
| `App.tsx` | Add `/admin/*` routes, `/select-plan` route |
| `PrivateRoute` | Add `AdminRoute` variant that checks `user.role === 'admin'` |
| `DashboardPage` | Remove hardcoded `WORKOUT_DAYS`, fetch from plan; add plan name row |
| `SetupPage` | Accept dynamic exercise list from plan (not hardcoded 4) |
| `WorkoutPage` | Remove hardcoded `PROGRESSION_AMRAP_INDEX`, get from plan definition |
| `WorkoutCard` | No structural change, just receives dynamic data |
| `SettingsPage` | Add "Current Plan" section with change button |
| `AuthContext` | Add `role` field to user, add `activePlanId` |

### Route Structure

```
/login                    - LoginPage
/register                 - RegisterPage
/select-plan              - PlanSelectionPage (onboarding + switching)
/setup                    - SetupPage (dynamic exercises)
/                         - DashboardPage (requires active plan)
/workout/:dayNumber       - WorkoutPage
/history                  - HistoryPage
/settings                 - SettingsPage

/admin                    - AdminLayout wrapper
  /admin/plans            - PlanListPage
  /admin/plans/new        - PlanEditorPage (create)
  /admin/plans/:id        - PlanEditorPage (edit)
  /admin/exercises        - ExerciseListPage
```

---

## 4. User Flow Diagrams

### Flow 1: New User Onboarding

```
Register
  |
  v
[Has active plan?] --no--> PlanSelectionPage
  |                              |
  yes                      Select a plan
  |                              |
  v                              v
[Has TMs?] --no--> SetupPage (dynamic exercises)
  |                              |
  yes                       Submit 1RMs
  |                              |
  v                              v
DashboardPage <-----------------+
```

### Flow 2: Plan Switching

```
Settings or Dashboard [Change Plan]
  |
  v
PlanSelectionPage (shows all active plans, current highlighted)
  |
  Select different plan
  |
  v
PlanSwitchConfirmModal
  - Shows warnings (in-progress workout, etc.)
  - Lists shared vs. new exercises
  |
  [Cancel] --> back to previous page
  [Switch Plan]
  |
  v
[New exercises need TMs?] --no--> DashboardPage (new plan active)
  |
  yes
  |
  v
PartialSetupPage (only missing exercises)
  |
  Submit 1RMs
  |
  v
DashboardPage (new plan active)
```

### Flow 3: Admin Creates a Plan

```
Admin Dashboard (/admin/plans)
  |
  [+ Create]
  |
  v
PlanEditorPage (blank)
  |
  Fill metadata (name, description, days)
  |
  v
  For each day:
    [+ Add T1 Exercise] --> AddExerciseModal --> select from library
    [Edit Sets] --> SetSchemeEditorModal --> define % / reps / AMRAP
    [+ Add T2 Exercise] --> repeat
  |
  v
  Set progression rules
  |
  v
  Status: Draft (not visible to users yet)
  |
  [Save Plan]
  |
  v
  Plan saved. Admin can set status to Active when ready.
```

### Flow 4: Starting a Workout (Plan-Aware)

```
DashboardPage (shows N day cards from active plan)
  |
  [Start Workout] on Day X
  |
  v
WorkoutPage
  - Fetches plan definition for Day X
  - Generates sets from plan's set scheme + user's TMs
  - Shows T1 + T2 sections (labels from plan, not hardcoded)
  |
  Complete sets, enter AMRAP reps
  |
  v
  [Complete Workout]
  |
  v
  Backend finds progression AMRAP from plan definition
  Applies progression rules from plan
  |
  v
  ProgressionBanner (same as current, data-driven)
```

---

## 5. Mobile-Specific Considerations

### Touch Targets
- All interactive elements remain min 48x48px (current 3rem min-height is good)
- Admin set scheme editor rows need adequate spacing for mobile editing
- Day tab bar in plan editor should be horizontally scrollable with momentum scroll

### Plan Selection Cards
- Full-width cards, stacked vertically
- Large tap target for "Select This Plan" button
- Description truncated to 3 lines with "Read more" expand

### Admin on Mobile
- Plan editor day tabs: horizontal scroll with visible overflow hint
- Set scheme editor: each row on its own line (percentage, reps, AMRAP checkbox stack vertically on very small screens)
- Exercise search in AddExerciseModal: full-screen modal on mobile

### Plan Switch Confirmation
- Bottom-sheet style modal on mobile (slides up from bottom)
- Primary action ("Switch Plan") at bottom, easy thumb reach

### No New Bottom Nav Items
- Admin is accessed from header, not bottom nav
- Plan selection is a full page, not a tab
- Bottom nav stays at 3 items (Dashboard, History, Settings) -- adding more would make tap targets too small

---

## 6. Visual Design Notes

### Color Tokens (extends existing)
- `--status-active: #16a34a` (green, for Active plan badge)
- `--status-draft: #94a3b8` (gray, for Draft plan badge)
- `--bg-highlight: #eff6ff` (light blue, for selected/current plan card)
- `--admin-accent: #7c3aed` (purple, to differentiate admin context)

### Plan Status Badges
```
[Active]  - green background, white text, rounded pill
[Draft]   - gray background, white text, rounded pill
```

### Current Plan Indicator (Dashboard)
```
+--------------------------------------+
| Current Plan                         |
| nSuns 4-Day LP              [Change] |
+--------------------------------------+
```
Styled as a card with subtle blue-tinted background (`--bg-highlight`) to make it prominent without being distracting.

### Admin Header
The admin header uses `--admin-accent` as a thin top border to visually distinguish admin mode from the regular user interface.

---

## 7. State Management Considerations

### User Context Extensions

The `AuthContext` / user object needs:
- `role: 'user' | 'admin'` - determines admin access
- `activePlanId: number | null` - current plan

### Plan Data Loading

- Dashboard fetches plan definition on mount (days, exercises, labels)
- Plan definition is cached in memory (does not change frequently)
- When plan is switched, dashboard data is fully reloaded

### Admin State

- Admin pages manage their own local state (no global admin context needed)
- Plan editor uses local form state with "Save" action
- Unsaved changes: show "You have unsaved changes" warning on navigation away

---

## 8. Error States & Edge Cases

### No Active Plans Available
If admin has no plans marked Active, users see:
```
No workout plans are available yet.
Please contact your administrator.
```

### Plan Deleted While User Is On It
If an admin deletes/deactivates a plan that users are on:
- Users on that plan see a banner on next Dashboard load: "Your plan is no longer available. Please select a new plan."
- Redirected to plan selection

### Mid-Workout Plan Data
The workout itself stores all set data at creation time. Even if the plan definition changes later, existing workouts are unaffected (sets are already in the database). Only new workouts use the latest plan definition.

### Admin Tries to Delete Exercise Used in Active Plan
Show error: "This exercise is used in [Plan Name]. Remove it from the plan first."

### Admin Tries to Delete Plan With Users
Show error: "This plan has X active users. Set it to Draft to hide it from new users, or reassign existing users first."
