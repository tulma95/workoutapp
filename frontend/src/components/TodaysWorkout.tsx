import { useQuery } from '@tanstack/react-query'
import { ButtonLink } from './ButtonLink'
import { queryKeys } from '../api/queryKeys'
import { getSchedule } from '../api/schedule'
import type { WorkoutPlan } from '../api/plans'
import type { Workout } from '../api/workouts'
import styles from './TodaysWorkout.module.css'

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

  if (!schedule || schedule.length === 0) return null

  const entry = schedule.find((e) => e.weekday === new Date().getDay())
  if (!entry) return null

  const day = plan.days.find((d) => d.dayNumber === entry.dayNumber)
  if (!day) return null

  const exercises = day.exercises.map((ex) => ex.displayName || ex.exercise.name)
  const inProgress = currentWorkout?.dayNumber === entry.dayNumber

  return (
    <section className={styles.card} data-testid="todays-workout">
      <span className={styles.label}>Today</span>
      <h2 className={styles.title}>Day {entry.dayNumber}</h2>
      <p className={styles.exercises}>{exercises.join(' · ')}</p>
      <ButtonLink to="/workout/$dayNumber" params={{ dayNumber: String(entry.dayNumber) }}>
        {inProgress ? 'Continue Workout' : 'Start Workout'}
      </ButtonLink>
    </section>
  )
}
