# Feature: PWA + Offline Support

**Priority**: High
**Effort**: High (20-30 hours, phased)
**Impact**: Makes app usable in gyms with poor connectivity, installable on home screen

## Problem

The app requires a constant internet connection. Gyms often have poor WiFi/cellular. If the user loses connection mid-workout, set completions fail and data is lost. The app also can't be installed to the home screen like a native app.

## Solution

Convert the app to a Progressive Web App with offline-first workout sessions. Static assets cached for instant load. Workout mutations queued locally and synced when online.

## Phase 1: Basic PWA (Installable + Cached Assets)

### Goal
App installs to home screen, loads instantly from cache, works offline for read-only operations.

### Implementation

**Install `vite-plugin-pwa`:**
```bash
npm install -D vite-plugin-pwa -w frontend
```

**Vite config:**
```typescript
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'nSuns Workout Tracker',
    short_name: 'nSuns',
    theme_color: '#4169e1',
    background_color: '#ffffff',
    display: 'standalone',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [{
      urlPattern: /^\/api\//,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-cache', networkTimeoutSeconds: 5 }
    }]
  }
})
```

**Assets needed:**
- App icons: 192x192 and 512x512 PNG
- Apple touch icon: 180x180
- Favicon

### Testing
- Lighthouse PWA audit passes
- App installable on Chrome/Safari
- Loads when airplane mode is on (after first visit)

## Phase 2: Offline Workout Sessions

### Goal
User can complete an entire workout offline. Data syncs automatically when connection returns.

### Architecture

**Local storage layer using IndexedDB** (via `idb` library):

```
┌──────────┐     ┌──────────────┐     ┌─────────┐
│  React   │────▶│  IndexedDB   │────▶│ Backend │
│  UI      │◀────│  (local)     │◀────│ API     │
└──────────┘     └──────────────┘     └─────────┘
      │                  │                  │
      │   Write locally  │   Sync when     │
      │   first (instant)│   online        │
```

**IndexedDB stores:**
- `activeWorkout` - Current workout with all sets (mirror of API response)
- `pendingMutations` - Queue of API calls to replay when online

**Flow:**
1. `POST /api/workouts` succeeds → store full response in IndexedDB
2. Set completion → update IndexedDB immediately, queue `PATCH` for sync
3. If offline when starting: show error (workout creation requires server for set generation)
4. If offline mid-workout: all set updates stored locally, synced later

**Sync strategy:**
- On `online` event: replay pending mutations in order
- On app open: check for pending mutations, sync if online
- Conflict resolution: server wins (last-write-wins for set data)

### Offline indicator
Show a subtle banner when offline: "You're offline. Changes will sync when reconnected."

## Phase 3: Screen Wake Lock

### Goal
Screen stays on during active workout so users can glance at their phone between sets.

### Implementation

```typescript
// useWakeLock.ts hook
// Acquire wake lock when WorkoutPage mounts
// Release when workout completes or user navigates away
// Re-acquire on visibilitychange (iOS releases wake lock when tab is backgrounded)
```

**Browser support:** Chrome, Edge, Safari 16.4+. Graceful degradation (no-op) on unsupported browsers.

## Out of Scope (for now)

- Push notifications for workout reminders (requires backend VAPID setup)
- Periodic background sync (limited browser support)
- Full offline workout creation (requires server for TM lookup and set generation)

## Testing

- E2E: Install PWA prompt appears
- E2E: App loads in offline mode after first visit
- E2E: Complete set while offline, verify sync when online
- E2E: Wake lock active during workout (manual verification)
- Lighthouse PWA score > 90
