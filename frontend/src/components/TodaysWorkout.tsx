import { useQuery } from '@tanstack/react-query'
import { ButtonLink } from './ButtonLink'
import { queryKeys } from '../api/queryKeys'
import { getSchedule } from '../api/schedule'
import { getLatestWorkout } from '../api/workouts'
import type { WorkoutPlan } from '../api/plans'
import type { Workout } from '../api/workouts'
import styles from './TodaysWorkout.module.css'

// Returns true when the ISO timestamp falls on today's UTC calendar date.
// Matches the UTC-date convention used elsewhere on the dashboard (relativeDay
// in RecentWorkoutPeek), so "today" is consistent across components.
function isCompletedToday(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  )
}

// Surfaces the workout the user scheduled for today's weekday as the primary
// dashboard CTA. Renders nothing when there's no schedule, or today isn't a
// scheduled training day (so a partial schedule never implies a false rest day).
export function TodaysWorkout({
  plan,
  currentWorkout,
}: {
  plan: WorkoutPlan
  currentWorkout: Workout | null
}) {
  const { data: schedule } = useQuery({
    queryKey: queryKeys.schedule.all(),
    queryFn: getSchedule,
  })

  // Reuses the ['workout', 'latest'] cache already populated by RecentWorkoutPeek
  // on the same dashboard — no extra HTTP request.
  const { data: latestWorkout } = useQuery({
    queryKey: queryKeys.workout.latest(),
    queryFn: getLatestWorkout,
  })

  if (!schedule || schedule.length === 0) return null

  const entry = schedule.find((e) => e.weekday === new Date().getDay())
  if (!entry) return null

  const day = plan.days.find((d) => d.dayNumber === entry.dayNumber)
  if (!day) return null

  const exercises = day.exercises.map((ex) => ex.displayName || ex.exercise.name)
  const inProgress = currentWorkout?.dayNumber === entry.dayNumber

  // The latest completed workout matches today's scheduled day — already done.
  // Guard against the in-progress case (currentWorkout handles that separately).
  const completedToday =
    !inProgress &&
    latestWorkout != null &&
    latestWorkout.status === 'completed' &&
    latestWorkout.dayNumber === entry.dayNumber &&
    isCompletedToday(latestWorkout.completedAt)

  return (
    <section
      className={styles.card}
      data-testid="todays-workout"
      data-completed={completedToday ? 'true' : undefined}
    >
      <span className={styles.label}>Today</span>
      <h2 className={styles.title}>Day {entry.dayNumber}</h2>
      <p className={styles.exercises}>{exercises.join(' · ')}</p>
      {completedToday ? (
        <p className={styles.completedBadge} role="status">
          Completed today ✓
        </p>
      ) : (
        <ButtonLink to="/workout/$dayNumber" params={{ dayNumber: String(entry.dayNumber) }}>
          {inProgress ? 'Continue Workout' : 'Start Workout'}
        </ButtonLink>
      )}
    </section>
  )
}
