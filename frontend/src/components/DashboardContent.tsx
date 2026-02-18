import WorkoutCard from './WorkoutCard'
import styles from '../styles/DashboardPage.module.css'
import type { WorkoutPlan } from '../api/plans'
import type { Workout } from '../api/workouts'

type Props = {
  plan: WorkoutPlan
  currentWorkout: Workout | null
}

function getWorkoutStatus(
  dayNumber: number,
  currentWorkout: Workout | null
): 'upcoming' | 'in_progress' | 'completed' {
  if (currentWorkout && currentWorkout.dayNumber === dayNumber) {
    return 'in_progress'
  }
  return 'upcoming'
}

export function DashboardContent({ plan, currentWorkout }: Props) {
  return (
    <div className={styles.page}>
      <h1>Dashboard</h1>

      <section className={styles.planSection}>
        <h2>Current Plan</h2>
        <p className={styles.planName}>{plan.name}</p>
        {plan.description && (
          <p className={styles.planDescription}>{plan.description}</p>
        )}
      </section>

      <section className={styles.daysSection}>
        <h2>Workout Days</h2>
        <div className={styles.cards}>
          {plan.days.map((day) => {
            const exerciseNames = day.exercises.map(
              (ex) => ex.displayName || ex.exercise.name
            )
            return (
              <WorkoutCard
                key={day.dayNumber}
                dayNumber={day.dayNumber}
                exercises={exerciseNames}
                status={getWorkoutStatus(day.dayNumber, currentWorkout)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
