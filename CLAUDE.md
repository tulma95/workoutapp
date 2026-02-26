# Workout Tracker (Plan-Driven)

## Project Overview

A workout tracking application supporting configurable training plans. Users register, subscribe to a plan, enter 1 Rep Maxes, and the app generates workouts with auto-calculated weights. Training maxes update automatically based on AMRAP performance and plan-specific progression rules.

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
- All weights in **kg** (no unit conversion), round to nearest **2.5 kg**
- Training maxes are **append-only** rows (latest `effective_date` = current TM)
- **Plan-driven**: All workout generation and progression requires an active plan subscription
- **Environment variables**: Exported by shell scripts (`start_local_env.sh`, `run_test.sh`), never loaded from .env files
- Prefer simple solutions

## Reference Docs (read on demand, not loaded by default)

- **Database schema**: `docs/db-schema.md`
- **API endpoints**: `docs/api-endpoints.md`
- **React Query cache map & invalidation rules**: `docs/react-query-cache.md`

## Frontend Patterns

- **CSS Modules**: `.module.css` files, rem units on 8-point grid, shared custom properties in `global.css`, border widths stay as px
- **Touch targets**: All interactive elements min 44px (3rem)
- **No view transitions**: Removed due to Safari/iOS issues
- **Loading states**: Calendar uses thin animated progress bar (not opacity fade). Skeleton loading for initial page loads. Never unmount components during loading.
- **Workout creation**: Done in component `useEffect` with `useRef` guard (not in route loader) to prevent phantom workouts from preloading
- **Modals**: Use native `<dialog>` element with `showModal()`. Dialog fills viewport (transparent background), visual content in inner `__content` div. Listen for `close` event to sync parent state.
- **Navigation**: Never use `<Button onClick={() => navigate(...)}>`. Use `<ButtonLink to="...">` for navigation. Only use `navigate()` for post-action redirects.

## Testing

Always write tests for new code.

- **Backend integration tests**: Run against real PostgreSQL (port 5433). No `vi.mock` for DB, config, or bcrypt — use real modules.
- **Test isolation**: Each test file uses `crypto.randomUUID()` in emails so parallel files don't conflict.
- **Do not write frontend unit tests.** All frontend testing via Playwright E2E tests.
- **Playwright**: Use locator-based API, prefer `getByRole`/`getByLabel`/`getByText` over CSS selectors, wait with `expect` assertions (never `waitForTimeout`), use `.first()` when multiple elements match.
- **Backend typecheck**: `npm run build -w backend`
- **Frontend typecheck**: `cd frontend && npx tsc --build --noEmit` (must use `--build` for project references)

## Commands

```bash
# Start full local dev environment
./start_local_env.sh

# Run all tests (backend + E2E)
./run_test.sh

# Prisma commands (MUST cd backend first, no workspace flag)
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

## Known Gotchas

- **Stale dist/**: Backend `tsc` does NOT clean `dist/` before compiling. Build script runs `rm -rf dist && tsc`.
- **StrictMode double-fires useEffect**: Guard side-effectful API calls with `useRef`.
- **E2E debugging**: Check `backend-test.log` in project root. Filter with `grep -i "error\|500\|409"`.
- **Exercise names vs slugs**: API returns `exercise.name` ("Bench Press") not `exercise.slug` ("bench-press"). `displayName` is on PlanDayExercise only.
- **Prisma v7**: Must `cd backend` first (no `-w` flag). Export `DATABASE_URL` before CLI commands. Connection URL in `prisma.config.ts`, not `schema.prisma`.

## Keeping Docs Up to Date

When you add or change API endpoints, DB schema, query keys, or invalidation rules, update the corresponding reference doc:

- New/changed endpoints -> `docs/api-endpoints.md`
- Schema migrations -> `docs/db-schema.md`
- New queries or invalidation changes -> `docs/react-query-cache.md`
- Architecture, patterns, or gotchas -> this file (`CLAUDE.md`)

## Workflow & Conventions

- Dont use typescript-code-review skill
- Dont use co-author in commits
- Explain in commit messages why instead of what
- Always create tickets (`/ticket add`) when you discover bugs, features, or improvements
- **Ticket workflow**: Use `ticket start <id>` to set active ticket. Include ticket ID in commits: `feat(027): add achievement badges page`. Mark done with `ticket status <id> done`.
- After committing code, always invoke the `ticket-code-review` skill

!IMPORTANT! ALWAYS USE run_test.sh to run tests !IMPORTANT!

### Capturing test output

```bash
./run_test.sh > /tmp/test_output.log 2>&1; echo "EXIT_CODE=$?" >> /tmp/test_output.log
```

Then read the last ~200 lines to find the actual error:

```bash
tail -200 /tmp/test_output.log
```
