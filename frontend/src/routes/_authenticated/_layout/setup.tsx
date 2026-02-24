import { useState, useMemo, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { setupTrainingMaxesFromExercises, getTrainingMaxes, type ExerciseTM } from '../../../api/trainingMaxes'
import { getCurrentPlan, type Exercise } from '../../../api/plans'
import { queryKeys } from '../../../api/queryKeys'
import { invalidateAfterTmUpdate } from '../../../api/invalidation'
import { extractErrorMessage } from '../../../api/errors'
import { SkeletonLine, SkeletonHeading } from '../../../components/Skeleton'
import { SetupForm } from '../../../components/SetupForm'
import styles from '../../../styles/SetupPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/setup')({
  validateSearch: (search: Record<string, unknown>) => ({
    missingTMs: search.missingTMs === true,
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({ queryKey: queryKeys.plan.current(), queryFn: getCurrentPlan }),
      queryClient.ensureQueryData({ queryKey: queryKeys.trainingMaxes.all(), queryFn: getTrainingMaxes }),
    ]),
  pendingComponent: () => (
    <div className={styles.page}>
      <div className={styles.container}>
        <SkeletonHeading width="60%" />
        <SkeletonLine width="80%" height="1rem" />
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <SkeletonLine width="30%" height="0.875rem" />
              <SkeletonLine width="100%" height="2.75rem" />
            </div>
          ))}
        </div>
        <SkeletonLine width="100%" height="3rem" />
      </div>
    </div>
  ),
  component: SetupPage,
})

function SetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { missingTMs: isMissingTMsMode } = Route.useSearch()

  const { data: currentPlan } = useSuspenseQuery({ queryKey: queryKeys.plan.current(), queryFn: getCurrentPlan })
  const { data: trainingMaxes } = useSuspenseQuery({ queryKey: queryKeys.trainingMaxes.all(), queryFn: getTrainingMaxes })

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requiredExercises = useMemo(() => {
    if (!currentPlan) return [] as Exercise[]

    const tmExercisesMap = new Map<number, Exercise>()
    currentPlan.days.forEach(day => {
      day.exercises.forEach(planExercise => {
        if (!tmExercisesMap.has(planExercise.tmExerciseId)) {
          tmExercisesMap.set(planExercise.tmExerciseId, planExercise.tmExercise)
        }
      })
    })

    if (isMissingTMsMode) {
      const existingTMSlugs = new Set(trainingMaxes.map((tm: { exercise: string }) => tm.exercise))
      return Array.from(tmExercisesMap.values()).filter(ex => !existingTMSlugs.has(ex.slug))
    }

    return Array.from(tmExercisesMap.values())
  }, [currentPlan, trainingMaxes, isMissingTMsMode])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const exerciseTMs: ExerciseTM[] = []
    for (const exercise of requiredExercises) {
      const value = formData[exercise.id.toString()]
      if (!value) {
        setError('All fields are required')
        return
      }

      const oneRepMaxInUserUnit = parseFloat(value)
      if (isNaN(oneRepMaxInUserUnit) || oneRepMaxInUserUnit <= 0) {
        setError('All fields must be positive numbers')
        return
      }

      exerciseTMs.push({
        exerciseId: exercise.id,
        oneRepMax: oneRepMaxInUserUnit,
      })
    }

    setIsSubmitting(true)

    try {
      await setupTrainingMaxesFromExercises(exerciseTMs)
      await invalidateAfterTmUpdate(queryClient)
      navigate({ to: '/' })
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to setup training maxes'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SetupForm
      requiredExercises={!currentPlan ? [] : requiredExercises}
      formData={formData}
      error={error}
      isSubmitting={isSubmitting}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
    />
  )
}
