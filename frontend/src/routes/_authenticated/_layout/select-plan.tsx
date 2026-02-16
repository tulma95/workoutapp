import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlans, subscribeToPlan, getCurrentPlan, type WorkoutPlan, type Exercise } from '../../../api/plans'
import { getCurrentWorkout } from '../../../api/workouts'
import { getTrainingMaxes } from '../../../api/trainingMaxes'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { ErrorMessage } from '../../../components/ErrorMessage'
import { PlanSwitchConfirmModal, type PlanSwitchWarnings } from '../../../components/PlanSwitchConfirmModal'
import '../../../styles/PlanSelectionPage.css'

export const Route = createFileRoute('/_authenticated/_layout/select-plan')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: ['plans'],
      queryFn: getPlans,
    }),
  pendingComponent: () => (
    <div className="plan-selection-page">
      <LoadingSpinner />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="plan-selection-page">
      <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load plans'} />
    </div>
  ),
  component: PlanSelectionPage,
})

function PlanSelectionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: plans } = useSuspenseQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
  })

  const [subscribing, setSubscribing] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [pendingPlanId, setPendingPlanId] = useState<number | null>(null)
  const [modalWarnings, setModalWarnings] = useState<PlanSwitchWarnings | null>(null)

  const subscribeMutation = useMutation({
    mutationFn: subscribeToPlan,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['plan', 'current'] })
      await queryClient.invalidateQueries({ queryKey: ['training-maxes'] })

      if (result.missingTMs.length > 0) {
        navigate({ to: '/setup', search: { missingTMs: true } })
      } else {
        navigate({ to: '/' })
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to subscribe to plan')
      setSubscribing(null)
    },
  })

  async function handleSelectPlan(planId: number) {
    const currentPlan = queryClient.getQueryData<WorkoutPlan | null>(['plan', 'current'])
    if (currentPlan && currentPlan.id !== planId) {
      await showSwitchConfirmation(planId)
    } else {
      setSubscribing(planId)
      subscribeMutation.mutate(planId)
    }
  }

  async function showSwitchConfirmation(planId: number) {
    setError('')
    try {
      const [currentPlan, currentWorkout, trainingMaxes] = await Promise.all([
        getCurrentPlan(),
        getCurrentWorkout(),
        getTrainingMaxes(),
      ])
      const targetPlan = plans.find(p => p.id === planId)

      if (!targetPlan) {
        setError('Selected plan not found')
        return
      }

      const currentExerciseIds = new Set<number>()
      if (currentPlan) {
        currentPlan.days.forEach((day) => {
          day.exercises.forEach((ex) => {
            currentExerciseIds.add(ex.tmExerciseId)
          })
        })
      }

      const targetExercises = new Map<number, Exercise>()
      targetPlan.days.forEach((day) => {
        day.exercises.forEach((ex) => {
          targetExercises.set(ex.tmExerciseId, ex.tmExercise)
        })
      })

      const newExercises: Exercise[] = []
      const existingExercises: Exercise[] = []

      targetExercises.forEach((exercise, exerciseId) => {
        if (currentExerciseIds.has(exerciseId)) {
          existingExercises.push(exercise)
        } else {
          newExercises.push(exercise)
        }
      })

      const warnings: PlanSwitchWarnings = {
        hasInProgressWorkout: currentWorkout !== null,
        newExercises,
        existingExercises,
      }

      setPendingPlanId(planId)
      setModalWarnings(warnings)
      setShowModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check plan compatibility')
    }
  }

  async function confirmPlanSwitch() {
    if (pendingPlanId === null) return
    setShowModal(false)
    setSubscribing(pendingPlanId)
    subscribeMutation.mutate(pendingPlanId)
    setPendingPlanId(null)
    setModalWarnings(null)
  }

  function cancelPlanSwitch() {
    setShowModal(false)
    setPendingPlanId(null)
    setModalWarnings(null)
  }

  return (
    <div className="plan-selection-page">
      <div className="plan-selection-header">
        <h1>Choose a Workout Plan</h1>
        <p>Select a plan that fits your training goals</p>
      </div>

      {error && (
        <ErrorMessage message={error} />
      )}

      <div className="plan-list">
        {plans.map((plan) => (
          <div key={plan.id} className="plan-card">
            <div className="plan-card-header">
              <h2>{plan.name}</h2>
              {plan.description && (
                <p className="plan-description">{plan.description}</p>
              )}
              <div className="plan-meta">
                <span className="days-per-week">{plan.daysPerWeek} days/week</span>
              </div>
            </div>

            <div className="plan-days">
              {plan.days.map((day) => (
                <div key={day.id} className="plan-day">
                  <div className="day-label">
                    {day.name || `Day ${day.dayNumber}`}
                  </div>
                  <div className="day-exercises">
                    {day.exercises.map((ex) => (
                      <div key={ex.id} className="exercise-item">
                        <span className="exercise-name">
                          {ex.displayName || ex.exercise.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="select-plan-button"
              onClick={() => handleSelectPlan(plan.id)}
              disabled={subscribing !== null}
            >
              {subscribing === plan.id ? 'Subscribing...' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="no-plans">
          <p>No workout plans available at the moment.</p>
        </div>
      )}

      {showModal && modalWarnings && pendingPlanId && (
        <PlanSwitchConfirmModal
          targetPlanName={plans.find(p => p.id === pendingPlanId)?.name || 'this plan'}
          warnings={modalWarnings}
          onConfirm={confirmPlanSwitch}
          onCancel={cancelPlanSwitch}
        />
      )}
    </div>
  )
}
