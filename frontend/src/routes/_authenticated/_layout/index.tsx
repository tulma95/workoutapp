import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getCurrentPlan } from '../../../api/plans'
import { getTrainingMaxes } from '../../../api/trainingMaxes'
import { getCurrentWorkout } from '../../../api/workouts'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { ErrorMessage } from '../../../components/ErrorMessage'
import WorkoutCard from '../../../components/WorkoutCard'
import '../../../styles/DashboardPage.css'

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
      throw redirect({ to: '/setup' })
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
  pendingComponent: LoadingSpinner,
  errorComponent: ({ error }) => (
    <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load dashboard'} />
  ),
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const { data: plan } = useSuspenseQuery({
    queryKey: ['plan', 'current'],
    queryFn: getCurrentPlan,
  })
  const { data: currentWorkout } = useSuspenseQuery({
    queryKey: ['workout', 'current'],
    queryFn: getCurrentWorkout,
  })

  function handleStartWorkout(dayNumber: number) {
    navigate({ to: '/workout/$dayNumber', params: { dayNumber: String(dayNumber) } })
  }

  function getWorkoutStatus(dayNumber: number): 'upcoming' | 'in_progress' | 'completed' {
    if (currentWorkout && currentWorkout.dayNumber === dayNumber) {
      return 'in_progress'
    }
    return 'upcoming'
  }

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      {plan && (
        <section className="current-plan-section">
          <div className="current-plan-header">
            <div>
              <h2>Current Plan</h2>
              <p className="plan-name">{plan.name}</p>
              {plan.description && (
                <p className="plan-description">{plan.description}</p>
              )}
            </div>
            <button
              className="btn-secondary"
              onClick={() => navigate({ to: '/select-plan' })}
            >
              Change
            </button>
          </div>
        </section>
      )}

      <section className="workout-days-section">
        <h2>Workout Days</h2>
        <div className="workout-cards">
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
                onStart={handleStartWorkout}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
