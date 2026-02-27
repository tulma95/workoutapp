# SetForge - Workout Tracker

A plan-driven workout tracking application that generates workouts with auto-calculated weights based on configurable training plans. Ships with nSuns 4-Day Linear Progression as the default plan.

## Purpose

SetForge removes the mental overhead of training programs. You pick a plan, enter your max lifts, and the app handles the math — calculating weights for every set, tracking your progress, and automatically increasing your training maxes when you hit rep targets.

## Features

### Workout Execution
- Auto-generated workouts with percentage-based weight calculations rounded to 2.5 kg
- Set-by-set logging with actual reps tracking
- Built-in rest timer with wake-lock support (screen stays on)
- AMRAP set tracking for automatic progression
- Custom workouts for ad-hoc training sessions
- Conflict detection prevents overlapping workout sessions

### Training Plans
- Subscribable plan system with structured day/exercise/set schemes
- nSuns 4-Day LP included by default (Bench, Squat, OHP, Deadlift)
- Plan-specific progression rules (exercise-specific or category-based)
- Training max auto-progression based on AMRAP performance
- Manual training max overrides with reason tracking
- Full training max history with effective dates

### Progress Tracking
- Multi-exercise progress charts with time range filtering (1m, 3m, 6m, all)
- Summary cards showing current TM and total increase percentage
- Workout calendar with completed and scheduled day indicators
- Paginated workout history with full set details

### Social
- Friend system with requests and username search
- Activity feed showing friend workouts, PRs, streaks, and achievements
- Emoji reactions on feed events
- Comments on friend workouts with real-time notifications
- Training max and estimated 1RM leaderboards among friends
- Workout streak tracking

### Achievements
- Unlockable badges for milestones (first workout, consistency, strength, dedication)
- Achievement notifications and feed events shared with friends

### Notifications
- Real-time in-app notifications via Server-Sent Events
- Web push notifications for workouts, achievements, friend requests, and comments

### PWA
- Installable as a Progressive Web App
- Offline asset caching with service worker
- Background push notification handling

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TanStack Router + React Query, CSS Modules
- **Backend**: Express.js, TypeScript, Prisma v7, PostgreSQL
- **Auth**: JWT (bcrypt + jsonwebtoken)
- **Testing**: Vitest + Supertest (backend), Playwright (E2E)
- **Infrastructure**: Docker Compose, npm workspaces monorepo

## Getting Started

```bash
# Start full local dev environment (Docker + backend + frontend in tmux)
./start_local_env.sh

# Or start services manually:
docker compose up -d
npm install
cd backend && npx prisma generate && npx prisma migrate dev && cd ..
npm run dev -w backend    # Express on :3001
npm run dev -w frontend   # Vite on :5173

# Run tests
./run_test.sh
```

Requires Node.js v22 and Docker.
