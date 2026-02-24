# API Endpoints

## Public

- `POST /api/auth/register` - `{ email, password, username }` — `username` is required; 3–20 chars, alphanumeric + underscores only; 409 `USERNAME_EXISTS` if taken
- `POST /api/auth/login` - `{ email, password }` -> `{ accessToken, refreshToken, user }`

## Protected (JWT required)

- `GET /api/users/me` | `PATCH /api/users/me` — PATCH accepts `{ username? }` to update username; 409 `USERNAME_EXISTS` if taken
- `GET /api/exercises` - all exercises sorted by name: `[{ id, slug, name, category, isUpperBody }]`
- `GET /api/training-maxes` - current TMs (plan-aware: returns TMs for active plan exercises)
- `POST /api/training-maxes/setup` - accepts both `{ oneRepMaxes }` and `{ exerciseTMs: [{ exerciseId, oneRepMax }] }`
- `PATCH /api/training-maxes/:exercise` - manual TM override; accepts `{ weight, reason? }` where `reason` is an optional string (max 500 chars) describing why the TM was changed (e.g. "deload reset", "injury setback")
- `GET /api/training-maxes/:exercise/history`
- `GET /api/progress` - all exercises from active plan with current TMs and full TM history; returns `{ exercises: [{ slug, name, currentTM, history: [{ weight, effectiveDate }] }], planSwitches: [{ date, planName }] }` (empty arrays if no active plan; `planSwitches` contains one entry per plan subscription after the first, representing each plan switch)
- `POST /api/workouts` - `{ dayNumber }` -> generates sets from active plan + TMs
- `POST /api/workouts/custom` - `{ date: "YYYY-MM-DD", exercises: [{ exerciseId, sets: [{ weight, reps }] }] }` -> creates a custom completed workout; returns workout with `isCustom: true`. **Must be registered before `/:id` routes in Express.**
- `GET /api/workouts/current` - in-progress workout (or null)
- `GET /api/workouts/:id` - includes `progressions` array (TM changes linked to this workout)
- `PATCH /api/workouts/:id/sets/:setId` - `{ actualReps, completed }`
- `POST /api/workouts/:id/complete` - applies progression, returns `{ progressions: [...], newAchievements: [{ slug, name, description }] }`; emits `badge_unlocked` feed events for each new achievement and `streak_milestone` feed events at thresholds [7, 14, 30, 60, 90] days (each threshold emitted at most once per user)
- `DELETE /api/workouts/:id` - soft-delete (sets status to 'discarded'), works on both in_progress and completed workouts
- `GET /api/workouts/history?page=1&limit=10`
- `GET /api/workouts/calendar?year=2026&month=2` - calendar view (must be before /:id route); returns `{ workouts: [...], scheduledDays: [{ date: string, dayNumber: number, planDayName: string | null }] }` where `scheduledDays` contains projected dates for the active plan's schedule (dates already occupied by any workout record are excluded)

## Schedule Endpoints (JWT required)

- `GET /api/schedule` - returns `{ schedule: [{ dayNumber, weekday }] }` for active plan; empty array if no active plan
- `PUT /api/schedule` - `{ schedule: [{ dayNumber, weekday }] }` — atomically replaces all schedule rows for the active plan; validates weekday 0–6, dayNumber ≤ plan.daysPerWeek, no duplicate dayNumbers; empty array clears schedule

## Plan Endpoints (JWT required)

- `GET /api/plans` - list public, non-archived plans
- `GET /api/plans/current` - user's active plan (or null)
- `GET /api/plans/:id` - plan detail with full nested structure
- `POST /api/plans/:id/subscribe` - subscribe to plan, returns `{ userPlan, requiredExercises, missingTMs }`; emits a `plan_switched` feed event (side effect)

## Social Endpoints (JWT required)

- `POST /api/social/request` - `{ email?, username? }` — exactly one of `email` or `username` required; send friend request; 404 if not found, 400 if self-friending or missing/ambiguous field, 409 if relationship already exists; inserts with canonical ordering (`requesterId = min(callerId, targetId)`)
- `GET /api/social/search?q=<query>` — search users by username substring (case-insensitive); excludes caller and users with existing pending/accepted friendships; returns up to 10 results: `{ users: [{ id, username }] }`
- `GET /api/social/friends` - list accepted friends: `{ friends: [{ id, userId, username, streak: number }] }` — `streak` is the number of consecutive calendar days (UTC) the friend has completed at least one workout; 0 if no recent activity
- `GET /api/social/requests` - list pending friend requests involving the caller: `{ requests: [{ id, requesterId, username }] }`
- `PATCH /api/social/requests/:id/accept` - accept a pending request; returns `{ id, status }`
- `PATCH /api/social/requests/:id/decline` - decline a pending request; returns `{ id, status }`
- `DELETE /api/social/friends/:id` - remove a friend (sets status to `'removed'`); returns `{ id, status }`
- `GET /api/social/feed` - last 20 feed events from confirmed friends ordered by `createdAt DESC`; returns `{ events: [{ id, userId, username, eventType, payload, createdAt, streak: number, commentCount: number, reactions: [{ emoji, count, reactedByMe }], latestComments: [{ id, feedEventId, userId, username, text, createdAt }] }] }` — `streak` is the event owner's current workout streak (consecutive calendar days); `reactions` is an empty array when no reactions exist; `commentCount` is the total number of comments on the event; `latestComments` is the last 2 comments (chronological order, newest at bottom), always present as an array (empty if no comments)
- `POST /api/social/feed/:eventId/react` - `{ emoji }` (one of `🔥 👏 💀 💪 🤙`) — toggles reaction on/off; 404 if event not found or event owner is not a friend; returns `{ reacted: boolean, count: number }`
- `GET /api/social/feed/:eventId/comments` - list all comments on a feed event ordered by `createdAt ASC`; friend-only access (event owner also permitted); returns `{ comments: [{ id, feedEventId, userId, username, text, createdAt }] }`; 403 if not a friend of the event owner, 404 if event not found
- `POST /api/social/feed/:eventId/comments` - `{ text }` (1–500 chars, whitespace trimmed) — add a comment; friend-only access (event owner also permitted); returns `201 { id, feedEventId, userId, text, createdAt }`; notifies event owner via SSE + push unless commenter is the event owner; 403 if not a friend, 404 if event not found, 400 if text is invalid
- `DELETE /api/social/feed/:eventId/comments/:commentId` - delete a comment; permitted for the comment author OR the event owner; returns `204`; 403 if neither, 404 if comment or event not found
- `GET /api/social/leaderboard` - TM rankings across caller and accepted friends for each exercise in active plan; returns `{ exercises: [{ slug, name, rankings: [{ userId, username, weight }] }] }`; returns `{ exercises: [] }` if no active plan
  - `?mode=e1rm` — returns estimated 1RM rankings instead of TM rankings; e1RMs are computed from completed AMRAP sets using the Epley formula (`weight * (1 + reps / 30)`); same response shape: `{ exercises: [{ slug, name, rankings: [{ userId, value, rank }] }] }`; only sets with `actual_reps >= 1` and `is_amrap = true` are considered

## Notification Endpoints

### `GET /api/notifications/public-key`

Returns the VAPID public key needed for client-side push subscription.

**Auth**: None required.

**Response**: `{ publicKey: string }` — base64url-encoded VAPID public key.

---

### `POST /api/notifications/subscribe`

Stores a Web Push subscription for the authenticated user (upserts on duplicate endpoint).

**Auth**: JWT required.

**Body**: `{ endpoint: string, keys: { p256dh: string, auth: string } }`

**Response**: `201 { ok: true }`

---

### `DELETE /api/notifications/subscribe`

Removes a Web Push subscription for the authenticated user.

**Auth**: JWT required.

**Body**: `{ endpoint: string }`

**Response**: `200 { ok: true }` | `404 NOT_FOUND` if subscription does not exist.

---

### `GET /api/notifications/stream`

Opens a Server-Sent Events (SSE) stream delivering real-time toast notifications to the authenticated user.

**Auth**: JWT required. Because the browser `EventSource` API cannot set custom headers, the token is passed as a query parameter instead of the `Authorization` header.

**Query params**:
- `token` (required) — the JWT access token

**Response headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Event format**: Each event is a standard SSE `data:` line containing a JSON payload:
```
data: {"type":"workout_completed","message":"Alice just finished Day 1"}
```

**Event types**:

| `type` | Trigger |
|---|---|
| `workout_completed` | A friend completes a workout |
| `achievement_earned` | A friend earns a new achievement badge |
| `friend_request_received` | Someone sends you a friend request |
| `friend_request_accepted` | Someone accepts your outgoing friend request |
| `comment_received` | Someone comments on your feed event (not triggered for self-comments) |

**Heartbeat**: The server writes `: heartbeat\n\n` (an SSE comment) every 30 seconds to all open connections. Browsers ignore SSE comments automatically; this prevents proxy timeouts.

**Reconnection**: `EventSource` reconnects automatically on disconnect. Exponential backoff is not implemented — the browser default retry interval applies.

**Multiple tabs**: Each open connection (tab) is registered independently. All connections for the same user receive the same events simultaneously. Connections are cleaned up automatically when the socket closes.

**Errors**: Returns `401 { error: { code: 'TOKEN_INVALID' } }` if the token is missing or invalid.

### Push Notification Payloads

Web push payloads are JSON strings sent via `pushService.sendToUser()`. The `url` field is used by the service worker `notificationclick` handler to navigate when a notification is tapped. All push types include `{ type, message, url }`.

| `type` | Recipient | `url` | Extra fields |
|---|---|---|---|
| `comment_received` | feed event owner | `/social/feed?event=<feedEventId>` | — |
| `friend_request_received` | request recipient | `/social/friends` | — |
| `friend_request_accepted` | request sender | `/social/friends` | — |
| `workout_completed` | self | `/` | `workoutId`, `dayNumber` |
| `workout_completed` | all accepted friends | `/social/feed` | — |
| `badge_unlocked` | self | `/achievements` | `slug`, `name`, `description` |

## Achievement Endpoints (JWT required)

- `GET /api/achievements` - returns full list of achievements joined with user's unlocked rows: `{ achievements: [{ slug, name, description, unlockedAt: string | null, workoutId: number | null }] }`. All 4 achievement definitions are always returned; `unlockedAt` and `workoutId` are `null` for locked badges.

## Admin Endpoints (JWT + isAdmin required)

- `GET/POST /api/admin/exercises` - list/create exercises
- `PATCH/DELETE /api/admin/exercises/:id` - update/delete exercises (delete fails if referenced by a plan)
- `GET/POST /api/admin/plans` - list/create plans (full nested structure in one transaction)
- `GET/PUT/DELETE /api/admin/plans/:id` - get/update/archive plans (system plans cannot be archived)
- `POST /api/admin/plans/:id/progression-rules` - replace progression rules for a plan
