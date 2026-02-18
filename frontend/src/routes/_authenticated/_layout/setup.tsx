import { useState, useMemo, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { setupTrainingMaxesFromExercises, getTrainingMaxes, type ExerciseTM } from '../../../api/trainingMaxes'
import { getCurrentPlan, type Exercise } from '../../../api/plans'
import { ErrorMessage } from '../../../components/ErrorMessage'
import { SkeletonLine, SkeletonHeading } from '../../../components/Skeleton'
import { Button } from '../../../components/Button'
import { ButtonLink } from '../../../components/ButtonLink'
import styles from '../../../styles/SetupPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/setup')({
  validateSearch: (search: Record<string, unknown>) => ({
    missingTMs: search.missingTMs === true,
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({ queryKey: ['plan', 'current'], queryFn: getCurrentPlan }),
      queryClient.ensureQueryData({ queryKey: ['training-maxes'], queryFn: getTrainingMaxes }),
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

  const { data: currentPlan } = useSuspenseQuery({ queryKey: ['plan', 'current'], queryFn: getCurrentPlan })
  const { data: trainingMaxes } = useSuspenseQuery({ queryKey: ['training-maxes'], queryFn: getTrainingMaxes })

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requiredExercises = useMemo(() => {
    if (!currentPlan) return []

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
      await queryClient.invalidateQueries({ queryKey: ['training-maxes'] })
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup training maxes')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!currentPlan || requiredExercises.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1>No Exercises Found</h1>
          <p className={styles.description}>
            Please select a workout plan first.
          </p>
          {error && <ErrorMessage message={error} />}
          <ButtonLink to="/select-plan">
            Select a Plan
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1>Enter Your 1 Rep Maxes</h1>
        <p className={styles.description}>
          These will be used to calculate your training maxes (90% of 1RM).
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {requiredExercises.map((exercise) => (
            <div key={exercise.id} className={styles.formGroup}>
              <label htmlFor={`exercise-${exercise.id}`}>
                {exercise.name} (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                id={`exercise-${exercise.id}`}
                name={exercise.id.toString()}
                value={formData[exercise.id.toString()] || ''}
                onChange={handleInputChange}
                placeholder={`Enter ${exercise.name} 1RM (kg)`}
                step="0.1"
                min="0"
              />
            </div>
          ))}

          {error && <ErrorMessage message={error} />}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Calculate Training Maxes'}
          </Button>
        </form>
      </div>
    </div>
  )
}
