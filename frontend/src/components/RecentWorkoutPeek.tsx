import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { queryKeys } from '../api/queryKeys'
import { getLatestWorkout } from '../api/workouts'
import { computeWorkoutSummary, formatDuration, formatVolume } from '../utils/workoutSummary'
import styles from './RecentWorkoutPeek.module.css'

const DAY_MS = 86_400_000

// Whole-day difference on a UTC-date basis (matches the app's date convention).
function relativeDay(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) /
      DAY_MS,
  )
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function RecentWorkoutPeek() {
  const { data: workout } = useQuery({
    queryKey: queryKeys.workout.latest(),
    queryFn: getLatestWorkout,
  })

  if (!workout) return null

  const summary = computeWorkoutSummary(workout)
  const title = workout.isCustom ? 'Custom Workout' : `Day ${workout.dayNumber}`

  return (
    <Link to="/history" className={styles.peek} data-testid="recent-workout-peek">
      <div className={styles.row}>
        <span className={styles.label}>Last workout</span>
        {workout.completedAt && <span className={styles.when}>{relativeDay(workout.completedAt)}</span>}
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.summary}>
        {summary.setsCompleted} sets
        {summary.totalVolumeKg > 0 && <> · {formatVolume(summary.totalVolumeKg)}</>}
        {summary.durationMin !== null && <> · {formatDuration(summary.durationMin)}</>}
      </p>
    </Link>
  )
}
