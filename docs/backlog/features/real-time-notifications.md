# Real-Time Notifications (SSE + Toast)

## Overview

Add real-time in-app notifications using Server-Sent Events (SSE). When a friend triggers a notable event (completes a workout, earns an achievement, accepts a friend request), online users see a toast notification.

## Notification Events

- **Friend completed workout** — "[Name] just finished Day 2 (Squat)"
- **Friend earned achievement** — "[Name] earned [achievement name]"
- **Friend request accepted** — "[Name] accepted your friend request"

More event types can be added later.

## Architecture

### Backend — SSE Endpoint

- `GET /api/notifications/stream` — authenticated SSE endpoint
- Keeps connection open per logged-in user, sends events as they happen
- Simple in-memory approach: map of `userId -> Response` objects
- When an event occurs (workout completed, achievement earned, etc.), look up the user's friends and push to any that are connected
- No separate notification table — the events that trigger notifications are already stored (workouts in feed, achievements, friend requests)
- Heartbeat every 30s to keep connection alive

### Frontend — EventSource + Toast

- `EventSource` connection opened on app mount (when authenticated)
- Reconnects automatically (EventSource built-in behavior)
- Toast component: appears top-right, auto-dismisses after ~5s, click to dismiss
- Toast queue: stack up to 3 visible, newer ones push older out
- No notification bell/inbox — purely transient toasts for now

## Triggering Notifications

In the existing API handlers, after the main action succeeds, broadcast to relevant friends:

- `POST /api/workouts/:id/complete` → notify friends
- Achievement award logic → notify friends
- `POST /api/friends/requests/:id/accept` → notify the requester

## Out of Scope

- Push notifications (service worker) — separate ticket
- Notification persistence/inbox
- Notification preferences/muting
- Polling fallback
