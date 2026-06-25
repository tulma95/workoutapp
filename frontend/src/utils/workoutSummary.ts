// A workout left open (started, app closed, completed much later) would report
// an absurd elapsed time; above this we treat the duration as unknown rather
// than claim a multi-hour session.
const MAX_PLAUSIBLE_DURATION_MIN = 6 * 60

export interface WorkoutSummary {
  durationMin: number | null
  setsCompleted: number
  totalVolumeKg: number
}

export interface SummarySet {
  prescribedWeight: number
  actualReps: number | null
  completed: boolean
}

export function computeWorkoutSummary(workout: {
  createdAt: string
  completedAt: string | null
  sets: SummarySet[]
}): WorkoutSummary {
  let setsCompleted = 0
  let totalVolumeKg = 0
  for (const s of workout.sets) {
    if (s.completed && s.actualReps !== null && s.actualReps > 0) {
      setsCompleted += 1
      totalVolumeKg += s.prescribedWeight * s.actualReps
    }
  }

  let durationMin: number | null = null
  if (workout.completedAt) {
    const ms = new Date(workout.completedAt).getTime() - new Date(workout.createdAt).getTime()
    const min = Math.round(ms / 60000)
    // Require strictly positive elapsed time: backfilled custom workouts set
    // createdAt === completedAt (ms === 0) and never had a tracked duration, so
    // they report no duration rather than a misleading "<1 min".
    if (ms > 0 && min <= MAX_PLAUSIBLE_DURATION_MIN) durationMin = min
  }

  return { durationMin, setsCompleted, totalVolumeKg: Math.round(totalVolumeKg) }
}

export function formatDuration(min: number): string {
  if (min < 1) return '<1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatVolume(kg: number): string {
  return `${kg.toLocaleString('en-US')} kg`
}
