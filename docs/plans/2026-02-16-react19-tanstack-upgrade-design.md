# React 19 + TanStack Upgrade Design

## Overview

Upgrade frontend from React 18 + React Router v7 to React 19 stable + TanStack Router (file-based) + TanStack Query. Adopt view transitions throughout the app.

## Package Changes

| Package | Action |
|---------|--------|
| `react` / `react-dom` | 18.3 → 19 stable |
| `@types/react` / `@types/react-dom` | 18 → 19 |
| `react-router` | Remove |
| `@tanstack/react-router` | Add |
| `@tanstack/router-plugin` | Add (Vite plugin, generates route types) |
| `@tanstack/react-query` | Add |

## File-Based Routing

Route files under `frontend/src/routes/`:

```
routes/
  __root.tsx                          # QueryClientProvider + AuthProvider
  _public.tsx                         # Pathless layout: no auth check
  _public/
    login.tsx
    register.tsx
  _authenticated.tsx                  # Pathless layout: beforeLoad redirects if no token
  _authenticated/
    _layout.tsx                       # Pathless layout: bottom nav shell
    _layout/
      index.tsx                       # Dashboard (/)
      select-plan.tsx
      setup.tsx
      history.tsx
      settings.tsx
      workout.$dayNumber.tsx
    admin.tsx                         # Admin layout: beforeLoad checks isAdmin, purple shell
    admin/
      plans.index.tsx
      plans.new.tsx
      plans.$id.tsx
      exercises.tsx
```

Conventions:
- `_prefix` = pathless layout route (no URL segment)
- `$param` = dynamic parameter
- `__root.tsx` = root route
- TanStack Router Vite plugin auto-generates `routeTree.gen.ts` with full type safety

### Auth gating

`_authenticated.tsx` uses `beforeLoad` to check for token in localStorage and redirect to `/login`. Replaces `PrivateRoute` component.

`admin.tsx` uses `beforeLoad` to check `isAdmin` on the user. Replaces `AdminRoute` component.

### Route-level loading/error

Each route file can define `pendingComponent` and `errorComponent`, replacing manual `if (isLoading)` / `if (error)` patterns in every page.

## Data Fetching with TanStack Query

### Setup

`QueryClient` created in `__root.tsx`, passed to router context. All child routes access it via `context.queryClient`.

### Pattern

All pages migrate from `useState` + `useEffect` + manual loading/error to `useSuspenseQuery`:

```tsx
// Before: ~30 lines
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);
useEffect(() => { fetch... }, []);

// After: 1 line per query
const { data } = useSuspenseQuery({ queryKey: ['plan', 'current'], queryFn: getCurrentPlan });
```

### Query keys

| Data | Query Key |
|------|-----------|
| Current user | `['user', 'me']` |
| Active plan | `['plan', 'current']` |
| Plan detail | `['plan', id]` |
| Plan list | `['plans']` |
| Training maxes | `['training-maxes']` |
| TM history | `['training-maxes', exercise, 'history']` |
| Current workout | `['workout', 'current']` |
| Workout by ID | `['workout', id]` |
| Calendar data | `['calendar', year, month]` |
| Workout history | `['history', page]` |
| Exercises | `['exercises']` |

### Mutations

`useMutation` for all write operations. Optimistic updates for workout set completion (update cache directly, revert on error). Cache invalidation on success for related queries (e.g., completing workout invalidates `['workout']`, `['training-maxes']`, `['calendar']`).

### API layer

No changes to `client.ts`, `schemas.ts`, or API function files. TanStack Query wraps them.

## Auth Handling

`AuthContext` slimmed to token management only (~40 lines):
- `token` (from localStorage)
- `login()` — sets token, invalidates queries
- `register()` — sets token
- `logout()` — clears token, clears query cache

User data (`getMe`) and active plan (`getCurrentPlan`) become regular TanStack Query queries, fetched via route loaders or `useSuspenseQuery` in components. No more `refreshUser()` / `refreshActivePlan()` callbacks — just `invalidateQueries`.

## View Transitions

### Route transitions

TanStack Router's `defaultViewTransition: true` wraps navigations in `document.startViewTransition()`. Default cross-fade for free. Directional slides via `viewTransition.types`:

```tsx
defaultViewTransition: {
  types: ({ isBackNavigation }) =>
    isBackNavigation ? ['slide-back'] : ['slide-forward'],
}
```

### Shared element transitions

CSS `view-transition-name` matching between pages. E.g., dashboard day card morphs into workout page header:

```tsx
// DashboardPage
<div style={{ viewTransitionName: `workout-day-${dayNumber}` }}>
// WorkoutPage
<div style={{ viewTransitionName: `workout-day-${dayNumber}` }}>
```

### Calendar month navigation

Manual `document.startViewTransition()` with direction data attribute (current approach, cleaned up).

### List enter/exit

CSS `@keyframes` with staggered `animation-delay` for workout sets and list items.

## Component Changes

### Deleted components
- `PrivateRoute` — replaced by `_authenticated.tsx` beforeLoad
- `AdminRoute` — replaced by `admin.tsx` beforeLoad

### Simplified components
- `LoadingSpinner` — still exists, used as route `pendingComponent`
- `ErrorMessage` — still exists, used as route `errorComponent`
- `Layout` / `AdminLayout` — Link imports change to `@tanstack/react-router`

### Unchanged components
- `WorkoutCalendar`, `WorkoutDetail`, `SetRow`, `AmrapInput`, `ProgressionBanner`, `ConflictDialog`
- All modal components (`ExerciseFormModal`, `SetSchemeEditorModal`, `PlanSwitchConfirmModal`)

## Decisions

- **React 19 stable over canary** — TanStack handles view transitions via browser API, no need for React's experimental `<ViewTransition>` component
- **File-based routing** — auto-generated type-safe route tree, convention over configuration
- **No form pattern changes** — keep current onSubmit handlers, skip useActionState (low ROI)
- **API layer untouched** — TanStack Query wraps existing functions, Zod validation stays at API boundary
