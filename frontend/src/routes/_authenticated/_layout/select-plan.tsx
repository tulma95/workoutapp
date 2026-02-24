import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlans, subscribeToPlan, getCurrentPlan, type WorkoutPlan, type Exercise } from '../../../api/plans'
import { getCurrentWorkout } from '../../../api/workouts'
import { getTrainingMaxes } from '../../../api/trainingMaxes'
import { SkeletonLine, SkeletonHeading, SkeletonCard } from '../../../components/Skeleton'
import { ErrorMessage } from '../../../components/ErrorMessage'
import { type PlanSwitchWarnings } from '../../../components/PlanSwitchConfirmModal'
import { PlanSelectionContent } from '../../../components/PlanSelectionContent'
import styles from '../../../styles/PlanSelectionPage.module.css'
import { queryKeys } from '../../../api/queryKeys'
import { removeCacheAfterPlanSwitch } from '../../../api/invalidation'
import { extractErrorMessage } from '../../../api/errors'

export const Route = createFileRoute('/_authenticated/_layout/select-plan')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: queryKeys.plan.list(),
      queryFn: getPlans,
    }),
  pendingComponent: () => (
    <div className={styles.page}>
      <div className={styles.header}>
        <SkeletonHeading width="60%" />
        <SkeletonLine width="80%" height="1rem" />
      </div>

      <div className={styles.list}>
        <SkeletonCard className={styles.card}>
          <div className={styles.cardHeader}>
            <SkeletonLine width="50%" height="1.25rem" />
            <SkeletonLine width="80%" height="0.875rem" />
            <SkeletonLine width="30%" height="0.875rem" />
          </div>
          <div className={styles.days}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.day}>
                <SkeletonLine width="25%" height="0.875rem" />
                <SkeletonLine width="70%" height="0.875rem" />
                <SkeletonLine width="55%" height="0.875rem" />
              </div>
            ))}
          </div>
          <SkeletonLine width="100%" height="3rem" />
        </SkeletonCard>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className={styles.page}>
      <ErrorMessage message={extractErrorMessage(error, 'Failed to load plans')} />
    </div>
  ),
  component: PlanSelectionPage,
})

function PlanSelectionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: plans } = useSuspenseQuery({
    queryKey: queryKeys.plan.list(),
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
      removeCacheAfterPlanSwitch(queryClient)
      await queryClient.invalidateQueries({ queryKey: queryKeys.workout.current() })

      if (result.missingTMs.length > 0) {
        navigate({ to: '/setup', search: { missingTMs: true } })
      } else {
        navigate({ to: '/' })
      }
    },
    onError: (err) => {
      setError(extractErrorMessage(err, 'Failed to subscribe to plan'))
      setSubscribing(null)
    },
  })

  async function handleSelectPlan(planId: number) {
    const currentPlan = queryClient.getQueryData<WorkoutPlan | null>(queryKeys.plan.current())
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
      const [currentPlan, currentWorkout] = await Promise.all([
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
      setError(extractErrorMessage(err, 'Failed to check plan compatibility'))
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
    <PlanSelectionContent
      plans={plans}
      subscribing={subscribing}
      error={error}
      showModal={showModal}
      modalWarnings={modalWarnings}
      pendingPlanId={pendingPlanId}
      onSelectPlan={handleSelectPlan}
      onConfirmSwitch={confirmPlanSwitch}
      onCancelSwitch={cancelPlanSwitch}
    />
  )
}
