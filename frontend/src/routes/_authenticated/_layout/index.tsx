import { createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getCurrentPlan } from '../../../api/plans'
import { getTrainingMaxes } from '../../../api/trainingMaxes'
import { getCurrentWorkout } from '../../../api/workouts'
import { ErrorMessage } from '../../../components/ErrorMessage'
import { SkeletonLine, SkeletonHeading, SkeletonCard } from '../../../components/Skeleton'
import WorkoutCard from '../../../components/WorkoutCard'
import styles from '../../../styles/DashboardPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const plan = await queryClient.fetchQuery({
      queryKey: ['plan', 'current'],
      queryFn: getCurrentPlan,
      staleTime: 30_000,
    })
    if (!plan) {
      throw redirect({ to: '/select-plan' })
    }

    const tms = await queryClient.fetchQuery({
      queryKey: ['training-maxes'],
      queryFn: getTrainingMaxes,
      staleTime: 30_000,
    })
    if (!tms || tms.length === 0) {
      throw redirect({ to: '/setup', search: { missingTMs: false } })
    }

    const existingTMSlugs = new Set(tms.map((tm: { exercise: string }) => tm.exercise))
    const tmExercisesMap = new Map<number, { slug: string; exercise: unknown }>()
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        if (!tmExercisesMap.has(ex.tmExerciseId)) {
          tmExercisesMap.set(ex.tmExerciseId, { slug: ex.tmExercise.slug, exercise: ex.tmExercise })
        }
      }
    }
    const missingTMs = Array.from(tmExercisesMap.values())
      .filter(({ slug }) => !existingTMSlugs.has(slug))
      .map(({ exercise }) => exercise)

    if (missingTMs.length > 0) {
      throw redirect({ to: '/setup', search: { missingTMs: true } })
    }
  },
  pendingComponent: () => (
    <div className={styles.page}>
      <SkeletonHeading width="40%" />

      <section className={styles.planSection}>
        <SkeletonLine width="30%" height="1rem" />
        <SkeletonLine width="60%" height="1.25rem" />
        <SkeletonLine width="80%" height="0.875rem" />
      </section>

      <section className={styles.daysSection}>
        <SkeletonHeading width="50%" />
        <div className={styles.cards}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i}>
              <SkeletonHeading width="30%" />
              <SkeletonLine width="70%" />
              <SkeletonLine width="50%" />
              <SkeletonLine width="100%" height="3rem" />
            </SkeletonCard>
          ))}
        </div>
      </section>
    </div>
  ),
  errorComponent: ({ error }) => (
    <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load dashboard'} />
  ),
  component: DashboardPage,
})

function DashboardPage() {
  const { data: plan } = useSuspenseQuery({
    queryKey: ['plan', 'current'],
    queryFn: getCurrentPlan,
  })
  const { data: currentWorkout } = useSuspenseQuery({
    queryKey: ['workout', 'current'],
    queryFn: getCurrentWorkout,
  })

  function getWorkoutStatus(dayNumber: number): 'upcoming' | 'in_progress' | 'completed' {
    if (currentWorkout && currentWorkout.dayNumber === dayNumber) {
      return 'in_progress'
    }
    return 'upcoming'
  }

  return (
    <div className={styles.page}>
      <h1>Dashboard</h1>

      {plan && (
        <section className={styles.planSection}>
          <h2>Current Plan</h2>
          <p className={styles.planName}>{plan.name}</p>
          {plan.description && (
            <p className={styles.planDescription}>{plan.description}</p>
          )}
        </section>
      )}

      <section className={styles.daysSection}>
        <h2>Workout Days</h2>
        <div className={styles.cards}>
          {plan?.days.map((day) => {
            const exerciseNames = day.exercises.map(
              (ex) => ex.displayName || ex.exercise.name
            )
            return (
              <WorkoutCard
                key={day.dayNumber}
                dayNumber={day.dayNumber}
                exercises={exerciseNames}
                status={getWorkoutStatus(day.dayNumber)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
