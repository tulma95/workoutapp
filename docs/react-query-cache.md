# React Query Cache Map

## Query Keys

| Key | Fetches | Used in |
|-----|---------|---------|
| `['user', 'me']` | Current authenticated user | Layout, SettingsPage |
| `['plan', 'current']` | User's active plan (or null) | DashboardPage, SettingsPage, PlanSelectionPage |
| `['training-maxes']` | Current TMs for active plan | DashboardPage, SettingsPage |
| `['workout', 'current']` | In-progress workout (or null) | DashboardPage |
| `['workoutCalendar', year, month]` | Calendar workouts for month | HistoryPage (with `keepPreviousData`) |
| `['schedule']` | User's current weekday schedule for active plan | SettingsPage |
| `['plans']` | All public plans | PlanSelectionPage |
| `['admin-exercises']` | All exercises (admin) | ExerciseListPage |
| `['admin-plans']` | All plans (admin) | PlanListPage |
| `['progress']` | All exercises with current TMs and TM history | ProgressPage |
| `['social', 'feed']` | Last 20 feed events from confirmed friends | SocialPage (FeedTab) |
| `['social', 'friends']` | Accepted friends list | SocialPage (FriendsTab) |
| `['social', 'friend-requests']` | Pending incoming friend requests | SocialPage (FriendsTab) |
| `['social', 'leaderboard']` | TM rankings per exercise across friends | SocialPage (LeaderboardTab) |

## Invalidation Rules

| Action | Trigger file | Keys invalidated |
|--------|-------------|-----------------|
| **Plan subscription** | select-plan.tsx | remove `['plan', 'current']`, remove `['training-maxes']`, remove `['progress']`, remove `['schedule']`, invalidate `['workout', 'current']` |
| **TM setup** | setup.tsx | `['training-maxes']`, `['progress']` |
| **TM manual update** | settings.tsx | `['training-maxes']`, `['progress']` |
| **Workout complete** | workout.$dayNumber.tsx | `['workout']`, `['workoutCalendar']`, `['training-maxes']`, `['progress']`, `['social', 'feed']` |
| **Workout cancel** | workout.$dayNumber.tsx | `['workout']`, `['workoutCalendar']` |
| **Workout delete (history)** | history.tsx | `['workoutCalendar']` |
| **Exercise CRUD** | admin/exercises.tsx | `['admin-exercises']` |
| **Plan archive** | admin/plans.index.tsx | `['admin-plans']` |
| **Plan create** | PlanEditorPage.tsx | `['admin-plans']` |
| **Schedule save** | settings.tsx | set `['schedule']` (via setQueryData), invalidate `['workoutCalendar']` |
| **Logout** | settings.tsx | ALL (`queryClient.clear()`) |

## Page Data Dependencies

Which pages need fresh data after an action on another page:

```
WorkoutPage --complete--> Dashboard (current workout), History (calendar), Settings (TMs), Progress (progress), Social (feed)
WorkoutPage --cancel----> Dashboard (current workout), History (calendar)
HistoryPage --delete---> History (calendar)
PlanSelectionPage --subscribe--> Dashboard (plan, TMs, current workout), Settings (plan, TMs, schedule), Progress (progress)
SetupPage --save TMs--> Dashboard (TMs), Settings (TMs), Progress (progress)
SettingsPage --edit TM--> Dashboard (TMs), Progress (TM history, progress)
SettingsPage --save schedule--> History (calendar)
SettingsPage --logout---> ALL pages (cache cleared)
Admin: ExerciseList --CRUD--> ExerciseList only
Admin: PlanEditor --create--> PlanList only
Admin: PlanList --archive--> PlanList only
```

## Notes
- `defaultPreloadStaleTime: 0` — all caching delegated to React Query (no stale preloads)
- Pages use `useSuspenseQuery` for data guaranteed by route loaders
- `removeQueries` = delete from cache (data no longer valid, e.g. plan switch); `invalidateQueries` = mark stale, refetch on next access
- When adding new mutations that affect workout/calendar/TM data, update the invalidation rules above
