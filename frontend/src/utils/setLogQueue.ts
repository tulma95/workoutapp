import { logSet } from '../api/workouts'

// Durable, offline-tolerant queue for set logging. When a PATCH fails because
// the device is offline (gym wifi drops mid-set), the write is persisted to
// localStorage and retried on reconnect / next load / before workout completion,
// instead of being silently lost. Background Sync isn't usable here because iOS
// Safari — the primary target — doesn't support it.

const STORAGE_KEY = 'setforge:pendingSetLogs'

export type SetLogData = { actualReps?: number | null; completed?: boolean }
type PendingItem = { workoutId: number; setId: number; data: SetLogData }
type PendingMap = Record<string, PendingItem>

function keyFor(workoutId: number, setId: number): string {
  return `${workoutId}:${setId}`
}

function read(): PendingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingMap) : {}
  } catch {
    return {}
  }
}

function write(map: PendingMap): void {
  try {
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    }
  } catch {
    // Storage full / unavailable — nothing we can safely do; drop silently.
  }
}

// Persist a set-log so it survives an offline period or reload. Latest write per
// set wins: the API is an idempotent upsert of that set's reps/completed state,
// so older queued edits to the same set are safely superseded.
export function enqueueSetLog(workoutId: number, setId: number, data: SetLogData): void {
  const map = read()
  map[keyFor(workoutId, setId)] = { workoutId, setId, data }
  write(map)
}

export function removeSetLog(workoutId: number, setId: number): void {
  const map = read()
  if (delete map[keyFor(workoutId, setId)]) write(map)
}

export function hasPendingSetLogs(): boolean {
  return Object.keys(read()).length > 0
}

// Drop the whole queue. Called on logout so one user's un-delivered offline
// writes can never flush under the next user's credentials on a shared device.
export function clearSetLogQueue(): void {
  write({})
}

let flushing = false

// Attempt to deliver every queued set-log. Stops at the first failure (still
// offline) and leaves the remaining items queued. Returns true if the queue is
// empty afterwards. Safe to call concurrently — re-entrant calls no-op.
export async function flushSetLogQueue(): Promise<boolean> {
  if (flushing) return !hasPendingSetLogs()
  flushing = true
  try {
    for (const [key, item] of Object.entries(read())) {
      try {
        await logSet(item.workoutId, item.setId, item.data)
      } catch (err) {
        // A 4xx is permanent (set deleted, or queued under a different user on a
        // shared device): drop this poison item so it can't block the queue
        // forever, and keep draining. A network error (offline) has no status —
        // keep it and stop; we'll retry on the next reconnect.
        const status = (err as { status?: number }).status
        if (typeof status === 'number' && status >= 400 && status < 500) {
          const current = read()
          delete current[key]
          write(current)
          continue
        }
        return false
      }
      const current = read()
      delete current[key]
      write(current)
    }
    return true
  } finally {
    flushing = false
  }
}
