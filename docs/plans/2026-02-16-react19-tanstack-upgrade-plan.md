# React 19 + TanStack Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade frontend from React 18 + React Router v7 to React 19 + TanStack Router (file-based) + TanStack Query, with view transitions throughout.

**Architecture:** Replace React Router with TanStack Router file-based routing under `src/routes/`. Replace all `useState`+`useEffect` data fetching with TanStack Query's `useSuspenseQuery`/`useMutation`. Slim down AuthContext to token management only. Add CSS-driven view transitions via TanStack Router's `defaultViewTransition` and manual `document.startViewTransition()`.

**Tech Stack:** React 19, TanStack Router, TanStack Query, Vite + @tanstack/router-plugin

**Design doc:** `docs/plans/2026-02-16-react19-tanstack-upgrade-design.md`

---

### Task 1: Package upgrades

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/tsconfig.app.json`

**Step 1: Install new packages and remove old**

```bash
cd frontend
npm install react@19 react-dom@19 @tanstack/react-router @tanstack/react-query
npm install -D @types/react@19 @types/react-dom@19 @tanstack/router-plugin
npm uninstall react-router
```

**Step 2: Update vite.config.ts to add TanStack Router plugin**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite({ quoteStyle: 'single' }), react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 3: Fix React 19 type breakages**

React 19 types remove implicit `children` from `React.FC` and change `ref` to a regular prop. Scan for and fix any type errors:

```bash
cd frontend && npx tsc --noEmit
```

Fix each error. Common fixes:
- Add `children: ReactNode` explicitly to component prop interfaces if missing
- `useRef<HTMLElement>(null)` no longer needs `| null` union in the type param

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: upgrade to React 19 + add TanStack Router and Query packages"
```

---

### Task 2: Create root route and router config

**Files:**
- Create: `frontend/src/routes/__root.tsx`
- Create: `frontend/src/router.tsx`
- Modify: `frontend/src/main.tsx`
- Delete (later, in cleanup task): `frontend/src/App.tsx`

**Step 1: Create `frontend/src/routes/__root.tsx`**

This is the root layout — provides QueryClient + AuthProvider. The `__root.tsx` file is special: it wraps the entire app.

```tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AuthProvider } from '../context/AuthContext'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
```

**Step 2: Create `frontend/src/router.tsx`**

```tsx
import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultViewTransition: true,
  context: {
    queryClient,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

**Step 3: Update `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { router, queryClient } from './router'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
```

**Step 4: Run Vite dev server to generate `routeTree.gen.ts`**

```bash
cd frontend && npx vite --open &
# Wait a moment, then kill it — the plugin auto-generates routeTree.gen.ts
# Alternatively:
npx tsr generate
```

Verify `frontend/src/routeTree.gen.ts` exists.

**Step 5: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

At this point only the root route exists — the app won't have any child routes yet. That's OK.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add TanStack Router root route and QueryClient setup"
```

---

### Task 3: Slim down AuthContext to token management

**Files:**
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/context/useAuth.ts`
- Create: `frontend/src/api/user.ts`

**Step 1: Create `frontend/src/api/user.ts`** for the `getMe` query function

```typescript
import { apiFetch } from './client'
import { UserSchema } from './schemas'

export async function getMe() {
  const data = await apiFetch('/users/me')
  return UserSchema.parse(data)
}

export async function updateMe(updates: { displayName?: string; unitPreference?: string }) {
  const data = await apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return UserSchema.parse(data)
}
```

**Step 2: Rewrite `frontend/src/context/AuthContext.tsx`**

Strip it down to token management. User data and active plan will be TanStack Query queries in routes/components.

```tsx
import {
  createContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import * as authApi from '../api/auth'
import type { UnitPreference } from '../types'

interface AuthContextValue {
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (
    email: string,
    password: string,
    displayName: string,
    unitPreference: UnitPreference,
  ) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('accessToken'),
  )

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    localStorage.setItem('accessToken', result.accessToken)
    localStorage.setItem('refreshToken', result.refreshToken)
    setToken(result.accessToken)
  }, [])

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      unitPreference: UnitPreference,
    ) => {
      const result = await authApi.register(
        email,
        password,
        displayName,
        unitPreference,
      )
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      setToken(result.accessToken)
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({ token, login, logout, register }),
    [token, login, logout, register],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

**Step 3: Update `frontend/src/context/useAuth.ts`** — same shape but returns new interface

```typescript
import { useContext } from 'react'
import { AuthContext } from './AuthContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

**Step 4: Commit**

```bash
git add -A && git commit -m "refactor: slim AuthContext to token management, add getMe API function"
```

---

### Task 4: Create layout routes (_public, _authenticated, _layout, admin)

**Files:**
- Create: `frontend/src/routes/_public.tsx`
- Create: `frontend/src/routes/_authenticated.tsx`
- Create: `frontend/src/routes/_authenticated/_layout.tsx`
- Create: `frontend/src/routes/_authenticated/admin.tsx`
- Modify: `frontend/src/components/Layout.tsx` — change `react-router` imports to `@tanstack/react-router`
- Modify: `frontend/src/components/AdminLayout.tsx` — same

**Step 1: Create `frontend/src/routes/_public.tsx`**

Pathless layout for unauthenticated routes. If user has a token, redirect to dashboard.

```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_public')({
  beforeLoad: () => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      throw redirect({ to: '/' })
    }
  },
  component: () => <Outlet />,
})
```

**Step 2: Create `frontend/src/routes/_authenticated.tsx`**

Auth gate — redirects to login if no token. Loads user data via TanStack Query.

```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getMe } from '../api/user'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      throw redirect({ to: '/login' })
    }
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: ['user', 'me'],
      queryFn: getMe,
    }),
  component: () => <Outlet />,
})
```

**Step 3: Create `frontend/src/routes/_authenticated/_layout.tsx`**

Wraps all main user pages with the bottom nav Layout shell.

```tsx
import { createFileRoute } from '@tanstack/react-router'
import Layout from '../../components/Layout'

export const Route = createFileRoute('/_authenticated/_layout')({
  component: Layout,
})
```

**Step 4: Create `frontend/src/routes/_authenticated/admin.tsx`**

Admin gate + admin layout. Checks isAdmin from user data.

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMe } from '../../api/user'
import { AdminLayout } from '../../components/AdminLayout'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.ensureQueryData({
      queryKey: ['user', 'me'],
      queryFn: getMe,
    })
    if (!user.isAdmin) {
      throw redirect({ to: '/' })
    }
  },
  component: AdminLayout,
})
```

**Step 5: Update `frontend/src/components/Layout.tsx`**

Replace `react-router` imports with `@tanstack/react-router`:

```tsx
import { Outlet, Link, useLocation } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getMe } from '../api/user'

export default function Layout() {
  const location = useLocation()
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', 'me'],
    queryFn: getMe,
  })

  return (
    <div>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>nSuns 4-Day LP</h1>
        {user.isAdmin && (
          <Link
            to="/admin"
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: '#7c3aed',
              color: 'white',
              textDecoration: 'none',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Admin
          </Link>
        )}
      </header>

      <main className="container" style={{ paddingTop: '16px', paddingBottom: '72px' }}>
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          Dashboard
        </Link>
        <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
          History
        </Link>
        <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>
          Settings
        </Link>
      </nav>
    </div>
  )
}
```

**Step 6: Update `frontend/src/components/AdminLayout.tsx`**

Replace `react-router` imports with `@tanstack/react-router`. Change `children` prop to `<Outlet />`:

```tsx
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { ToastProvider } from './Toast'
import './AdminLayout.css'

export function AdminLayout() {
  const location = useLocation()

  const isPlansActive = location.pathname.startsWith('/admin/plans')
  const isExercisesActive = location.pathname === '/admin/exercises'

  return (
    <ToastProvider>
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">Admin</h1>
          <Link to="/" className="back-to-app-link">
            ← Back to App
          </Link>
        </div>
      </header>

      <nav className="admin-tabs">
        <Link
          to="/admin/plans"
          className={`admin-tab ${isPlansActive ? 'admin-tab-active' : ''}`}
        >
          Plans
        </Link>
        <Link
          to="/admin/exercises"
          className={`admin-tab ${isExercisesActive ? 'admin-tab-active' : ''}`}
        >
          Exercises
        </Link>
      </nav>

      <main className="admin-main"><Outlet /></main>
    </div>
    </ToastProvider>
  )
}
```

**Step 7: Regenerate route tree and typecheck**

```bash
cd frontend && npx tsr generate && npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: add layout routes (_public, _authenticated, _layout, admin)"
```

---

### Task 5: Migrate public routes (login, register)

**Files:**
- Create: `frontend/src/routes/_public/login.tsx`
- Create: `frontend/src/routes/_public/register.tsx`

**Step 1: Create `frontend/src/routes/_public/login.tsx`**

Migrate from `pages/LoginPage.tsx`. Replace `useNavigate` from react-router with `useNavigate` from `@tanstack/react-router`. Replace `useAuth()` usage — the new auth context no longer provides `user` or `isLoading`, just `login()`.

```tsx
import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../context/useAuth'

export const Route = createFileRoute('/_public/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate({ to: '/' })
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error: { message: string } }).error.message
          : 'Login failed'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1>Login</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Logging in...' : 'Log In'}
        </button>
      </form>
      <p className="auth-link">
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}
```

**Step 2: Create `frontend/src/routes/_public/register.tsx`**

Same pattern — migrate from `pages/RegisterPage.tsx`. Keep the full form with unit preference radio buttons. Read `pages/RegisterPage.tsx` for the exact form structure and replicate it, replacing:
- `useNavigate` from `react-router` → `@tanstack/react-router`
- `useAuth()` — use `register()` from new slim context
- `Link` from `react-router` → `@tanstack/react-router`
- `navigate('/')` → `navigate({ to: '/' })`

**Step 3: Regenerate and typecheck**

```bash
cd frontend && npx tsr generate && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: migrate login and register to TanStack Router routes"
```

---

### Task 6: Migrate Dashboard route

**Files:**
- Create: `frontend/src/routes/_authenticated/_layout/index.tsx`

**Step 1: Create the dashboard route**

This is the biggest transformation — replace all useState/useEffect data fetching with TanStack Query. The dashboard loads: current plan, training maxes, current workout. Redirect logic (no plan → /select-plan, no TMs → /setup) moves to `beforeLoad`.

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getCurrentPlan } from '../../../api/plans'
import { getTrainingMaxes } from '../../../api/trainingMaxes'
import { getCurrentWorkout } from '../../../api/workouts'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { ErrorMessage } from '../../../components/ErrorMessage'
import WorkoutCard from '../../../components/WorkoutCard'
import '../../../pages/DashboardPage.css'

export const Route = createFileRoute('/_authenticated/_layout/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    // Check for active plan — redirect if none
    const plan = await queryClient.ensureQueryData({
      queryKey: ['plan', 'current'],
      queryFn: getCurrentPlan,
    })
    if (!plan) {
      throw redirect({ to: '/select-plan' })
    }

    // Check for training maxes
    const tms = await queryClient.ensureQueryData({
      queryKey: ['training-maxes'],
      queryFn: getTrainingMaxes,
    })
    if (!tms || tms.length === 0) {
      throw redirect({ to: '/setup' })
    }

    // Check for missing TMs
    const existingTMSlugs = new Set(tms.map((tm: { exercise: string }) => tm.exercise))
    const tmExercisesMap = new Map<number, { slug: string; exercise: unknown }>()
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        if (!tmExercisesMap.has(ex.tmExerciseId)) {
          tmExercisesMap.set(ex.tmExerciseId, { slug: ex.tmExercise.slug, exercise: ex.tmExercise })
        }
      }
    }
    const missingTMs = Array.from(tmExercisesMap.values())
      .filter(({ slug }) => !existingTMSlugs.has(slug))
      .map(({ exercise }) => exercise)

    if (missingTMs.length > 0) {
      throw redirect({ to: '/setup', search: { missingTMs: true } })
    }
  },
  pendingComponent: LoadingSpinner,
  errorComponent: ({ error }) => (
    <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load dashboard'} />
  ),
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const { data: plan } = useSuspenseQuery({
    queryKey: ['plan', 'current'],
    queryFn: getCurrentPlan,
  })
  const { data: currentWorkout } = useSuspenseQuery({
    queryKey: ['workout', 'current'],
    queryFn: getCurrentWorkout,
  })

  function handleStartWorkout(dayNumber: number) {
    navigate({ to: '/workout/$dayNumber', params: { dayNumber: String(dayNumber) } })
  }

  function getWorkoutStatus(dayNumber: number): 'upcoming' | 'in_progress' | 'completed' {
    if (currentWorkout && currentWorkout.dayNumber === dayNumber) {
      return 'in_progress'
    }
    return 'upcoming'
  }

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      {plan && (
        <section className="current-plan-section">
          <div className="current-plan-header">
            <div>
              <h2>Current Plan</h2>
              <p className="plan-name">{plan.name}</p>
              {plan.description && (
                <p className="plan-description">{plan.description}</p>
              )}
            </div>
            <button
              className="btn-secondary"
              onClick={() => navigate({ to: '/select-plan' })}
            >
              Change
            </button>
          </div>
        </section>
      )}

      <section className="workout-days-section">
        <h2>Workout Days</h2>
        <div className="workout-cards">
          {plan?.days.map((day) => {
            const exerciseNames = day.exercises.map(
              (ex) => ex.displayName || ex.exercise.name
            )
            return (
              <WorkoutCard
                key={day.dayNumber}
                dayNumber={day.dayNumber}
                exercises={exerciseNames}
                status={getWorkoutStatus(day.dayNumber)}
                onStart={handleStartWorkout}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
```

Note: Add `import { redirect } from '@tanstack/react-router'` at the top. The `beforeLoad` handles all the redirect logic that was previously in the component's `useEffect`.

**Step 2: Regenerate and typecheck**

```bash
cd frontend && npx tsr generate && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: migrate dashboard to TanStack Router + Query"
```

---

### Task 7: Migrate remaining main user routes

**Files:**
- Create: `frontend/src/routes/_authenticated/_layout/select-plan.tsx`
- Create: `frontend/src/routes/_authenticated/_layout/setup.tsx`
- Create: `frontend/src/routes/_authenticated/_layout/history.tsx`
- Create: `frontend/src/routes/_authenticated/_layout/settings.tsx`
- Create: `frontend/src/routes/_authenticated/_layout/workout.$dayNumber.tsx`

For each route, follow the same pattern:

1. `createFileRoute` with the correct path string
2. Move data fetching from `useEffect` to `useSuspenseQuery` / `useMutation`
3. Replace `useNavigate()` / `Link` from `react-router` with `@tanstack/react-router`
4. Add `pendingComponent: LoadingSpinner` and `errorComponent` on the route
5. Remove all `isLoading` / `error` / `fetchError` useState — route handles these

**Specific notes per route:**

**select-plan.tsx:** `useSuspenseQuery` for `getPlans()`. `useMutation` for `subscribeToPlan()` with invalidation of `['plan', 'current']` and `['training-maxes']`.

**setup.tsx:** `useSuspenseQuery` for plan exercises if needed. `useMutation` for `setupTrainingMaxesFromExercises()`. Check TanStack Router `search` params for `missingTMs` flag (replaces React Router's `useLocation().state`). After successful setup, `navigate({ to: '/' })` and invalidate `['training-maxes']`.

**history.tsx:** `useSuspenseQuery` for `getWorkoutCalendar(year, month)` — needs `year`/`month` as local state since calendar navigation is within the page. Keep the manual `document.startViewTransition()` for month changes. `useSuspenseQuery` or `useQuery` for workout detail on selection (can be lazy — don't need Suspense for the detail panel).

**settings.tsx:** `useSuspenseQuery` for `getMe()`, `getCurrentPlan()`, `getTrainingMaxes()`. `useMutation` for `updateMe()` and `updateTrainingMax()`. On logout: call `logout()` from auth context, then `queryClient.clear()` and `navigate({ to: '/login' })`.

**workout.$dayNumber.tsx:** Most complex page. The `dayNumber` param comes from `Route.useParams()`. Keep the conflict detection logic but restructure:
- Move initial workout load/start to `loader` or `beforeLoad`
- Keep `useMutation` for `logSet()` with optimistic updates
- Keep `useMutation` for `completeWorkout()` and `cancelWorkout()`
- On complete: invalidate `['workout']`, `['training-maxes']`, `['calendar']`
- The `loadingRef` guard is no longer needed — TanStack Query deduplicates

**Step: Regenerate and typecheck after all routes**

```bash
cd frontend && npx tsr generate && npx tsc --noEmit
```

**Step: Commit**

```bash
git add -A && git commit -m "feat: migrate all main user routes to TanStack Router + Query"
```

---

### Task 8: Migrate admin routes

**Files:**
- Create: `frontend/src/routes/_authenticated/admin/plans.index.tsx`
- Create: `frontend/src/routes/_authenticated/admin/plans.new.tsx`
- Create: `frontend/src/routes/_authenticated/admin/plans.$id.tsx`
- Create: `frontend/src/routes/_authenticated/admin/exercises.tsx`

**Pattern for each:**

1. `createFileRoute` with correct path
2. Replace direct `fetch()` calls in `api/exercises.ts` and `api/adminPlans.ts` with `apiFetch()` (they currently manually handle JWT — the `apiFetch` client already does this)
3. Use `useSuspenseQuery` for list/detail fetches
4. Use `useMutation` for create/update/delete/archive with appropriate cache invalidation

**Specific notes:**

**plans.index.tsx:** `useSuspenseQuery` for `getAdminPlans()`. `useMutation` for `archivePlan()` invalidating `['admin-plans']`.

**plans.new.tsx:** The plan editor page for creating new plans. This is the largest page (886 lines). Keep most of the internal state management (day tabs, exercise picker, etc.) since that's form state, not server state. Use `useMutation` for `createPlan()`.

**plans.$id.tsx:** Same editor but with `useSuspenseQuery` for `getAdminPlan(id)` to load existing plan data. `useMutation` for `updatePlan()` and `setProgressionRules()`.

Note: `plans.new.tsx` and `plans.$id.tsx` will share the same `PlanEditorPage` component — export it from a shared file or keep it in `components/`. The route files just set up the data loading. Whether to use the existing `pages/admin/PlanEditorPage.tsx` as the shared component (imported by both routes) or split it — use the simpler approach: both route files import the same component.

**exercises.tsx:** `useSuspenseQuery` for `getExercises()`. `useMutation` for CRUD operations.

**Step: Also update `api/exercises.ts` and `api/adminPlans.ts` to use `apiFetch`** instead of manual `fetch()` with JWT header. This is a cleanup — the `apiFetch` client already handles auth headers. Example for exercises:

```typescript
// Before:
export async function getExercises(): Promise<Exercise[]> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('/api/admin/exercises', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  ...
}

// After:
export async function getExercises(): Promise<Exercise[]> {
  const data = await apiFetch('/admin/exercises');
  return ExercisesListSchema.parse(data);
}
```

Do this for all functions in both files.

**Step: Regenerate and typecheck**

```bash
cd frontend && npx tsr generate && npx tsc --noEmit
```

**Step: Commit**

```bash
git add -A && git commit -m "feat: migrate admin routes to TanStack Router + Query"
```

---

### Task 9: Add catch-all redirect route

**Files:**
- Create: `frontend/src/routes/$.tsx` (catch-all / splat route)

**Step 1: Create `frontend/src/routes/$.tsx`**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})
```

This replaces the `{ path: '*', element: <Navigate to="/" /> }` in the old router.

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add catch-all redirect route"
```

---

### Task 10: Clean up old files

**Files:**
- Delete: `frontend/src/App.tsx`
- Delete: `frontend/src/pages/` (entire directory)
- Delete: `frontend/src/components/PrivateRoute.tsx`
- Delete: `frontend/src/components/AdminRoute.tsx`

**Step 1: Delete old files**

```bash
rm frontend/src/App.tsx
rm -rf frontend/src/pages/
rm frontend/src/components/PrivateRoute.tsx
rm frontend/src/components/AdminRoute.tsx
```

**Step 2: Move CSS files** that were in `pages/*.css` to colocate with route files or keep in a shared `styles/` directory. The route files imported `../pages/DashboardPage.css` etc. — update those imports to wherever the CSS files now live. Simplest approach: move CSS files from `pages/` to `styles/` before deleting `pages/`.

```bash
mv frontend/src/pages/*.css frontend/src/styles/
```

Update route imports accordingly (e.g., `import '../../../styles/DashboardPage.css'`).

**Step 3: Update `vite-env.d.ts`** — remove the custom View Transition API types if they're no longer needed (TanStack Router handles it). Keep them if calendar month navigation still uses `document.startViewTransition()`.

**Step 4: Verify build**

```bash
cd frontend && npx tsc --noEmit && npx vite build
```

**Step 5: Commit**

```bash
git add -A && git commit -m "chore: remove old App.tsx, pages/, PrivateRoute, AdminRoute"
```

---

### Task 11: Add view transition CSS

**Files:**
- Create or modify: `frontend/src/styles/transitions.css`
- Modify: `frontend/src/styles/global.css` (import transitions)

**Step 1: Create `frontend/src/styles/transitions.css`**

```css
/* Route transition: default cross-fade (TanStack Router handles the startViewTransition call) */
::view-transition-old(root) {
  animation: fade-out 150ms ease;
}
::view-transition-new(root) {
  animation: fade-in 150ms ease;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Calendar month transitions (manual startViewTransition) */
[data-transition-direction="next"] ::view-transition-old(calendar-grid) {
  animation: slide-out-left 250ms ease;
}
[data-transition-direction="next"] ::view-transition-new(calendar-grid) {
  animation: slide-in-right 250ms ease;
}
[data-transition-direction="prev"] ::view-transition-old(calendar-grid) {
  animation: slide-out-right 250ms ease;
}
[data-transition-direction="prev"] ::view-transition-new(calendar-grid) {
  animation: slide-in-left 250ms ease;
}

@keyframes slide-out-left {
  to { transform: translateX(-100%); opacity: 0; }
}
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
}
@keyframes slide-out-right {
  to { transform: translateX(100%); opacity: 0; }
}
@keyframes slide-in-left {
  from { transform: translateX(-100%); opacity: 0; }
}

/* Shared element: workout day card → workout page header */
.workout-card {
  view-transition-name: var(--vt-name);
}
.workout-page h1 {
  view-transition-name: var(--vt-name);
}

/* List enter animations */
.workout-section__sets .set-row {
  animation: fade-slide-up 200ms ease both;
}
.workout-section__sets .set-row:nth-child(1) { animation-delay: 0ms; }
.workout-section__sets .set-row:nth-child(2) { animation-delay: 30ms; }
.workout-section__sets .set-row:nth-child(3) { animation-delay: 60ms; }
.workout-section__sets .set-row:nth-child(4) { animation-delay: 90ms; }
.workout-section__sets .set-row:nth-child(5) { animation-delay: 120ms; }
.workout-section__sets .set-row:nth-child(6) { animation-delay: 150ms; }
.workout-section__sets .set-row:nth-child(7) { animation-delay: 180ms; }
.workout-section__sets .set-row:nth-child(8) { animation-delay: 210ms; }
.workout-section__sets .set-row:nth-child(9) { animation-delay: 240ms; }

@keyframes fade-slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
  .set-row {
    animation: none !important;
  }
}
```

**Step 2: Add view-transition-name to WorkoutCalendar grid**

In `frontend/src/components/WorkoutCalendar.tsx`, add `style={{ viewTransitionName: 'calendar-grid' }}` to the calendar grid container element.

**Step 3: Add shared element names to WorkoutCard and WorkoutPage**

In `WorkoutCard.tsx`, add `style={{ viewTransitionName: `workout-day-${dayNumber}` }}` to the card root element.

In the workout route component, add the matching `viewTransitionName` to the `h1`.

**Step 4: Import transitions CSS in global.css or main.tsx**

Add to `main.tsx`: `import './styles/transitions.css'`

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add view transition CSS for routes, calendar, shared elements, and list animations"
```

---

### Task 12: Fix E2E tests

**Files:**
- Modify: `e2e/fixtures.ts` and all `e2e/*.spec.ts` files as needed

The E2E tests use Playwright and interact with the app via the browser — they don't import React code. Most tests should pass without changes since the URLs and UI remain the same. However:

**Potential breakages:**
1. **Timing differences** — TanStack Router's `beforeLoad` runs before render (vs PrivateRoute rendering then redirecting). Navigation flows may be faster, which could affect `waitForURL` assertions.
2. **Loading states** — Route `pendingComponent` renders differently than manual `if (isLoading) return <LoadingSpinner />`. Tests waiting for specific text might need adjustment.
3. **Auth redirects** — The `_public` route redirects authenticated users away from `/login`. If a test navigates to `/login` while authenticated, it'll redirect.

**Step 1: Start dev servers and run E2E tests**

```bash
npm test
```

**Step 2: Fix any failing tests**

For each failure:
- Check `backend-test.log` for API errors
- Check if the UI renders the same elements with the same text
- Adjust `waitForURL` / `waitForSelector` calls if timing changed

**Step 3: Commit**

```bash
git add -A && git commit -m "fix: update E2E tests for TanStack Router migration"
```

---

### Task 13: Final verification and cleanup

**Step 1: Run full typecheck**

```bash
cd frontend && npx tsc --noEmit
```

**Step 2: Run Vite build**

```bash
cd frontend && npx vite build
```

**Step 3: Run full test suite**

```bash
npm test
```

**Step 4: Verify no unused files remain**

```bash
# Check for any remaining react-router imports
grep -r "from 'react-router'" frontend/src/ || echo "Clean: no react-router imports"
grep -r "from \"react-router\"" frontend/src/ || echo "Clean: no react-router imports"
```

**Step 5: Clean up routeTree.gen.ts** — add to `.gitignore` if desired (it's auto-generated), or keep it committed for CI.

**Step 6: Update `frontend/src/vite-env.d.ts`** — remove custom ViewTransition types if the browser types now cover them (React 19 + modern TS lib should have them). If not, keep them.

**Step 7: Final commit**

```bash
git add -A && git commit -m "chore: final cleanup for React 19 + TanStack migration"
```
