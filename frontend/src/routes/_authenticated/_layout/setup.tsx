import { useState, useEffect, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { setupTrainingMaxesFromExercises, getTrainingMaxes, type ExerciseTM } from '../../../api/trainingMaxes'
import { getCurrentPlan, type Exercise } from '../../../api/plans'
import { ErrorMessage } from '../../../components/ErrorMessage'
import { Button } from '../../../components/Button'
import { ButtonLink } from '../../../components/ButtonLink'
import styles from '../../../styles/SetupPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/setup')({
  validateSearch: (search: Record<string, unknown>) => ({
    missingTMs: search.missingTMs === true,
  }),
  component: SetupPage,
})

function SetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { missingTMs: isMissingTMsMode } = Route.useSearch()

  const [requiredExercises, setRequiredExercises] = useState<Exercise[]>([])
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function loadRequiredExercises() {
      try {
        const plan = await getCurrentPlan()
        if (!plan) {
          setError('No active plan found. Please select a plan first.')
          setIsLoading(false)
          return
        }

        if (isMissingTMsMode) {
          // In missing TMs mode, we need to figure out which exercises are missing
          // The plan has all exercises; we need to filter to those without TMs
          const tms = await getTrainingMaxes()
          const existingTMSlugs = new Set(tms.map((tm: { exercise: string }) => tm.exercise))

          const tmExercisesMap = new Map<number, Exercise>()
          plan.days.forEach(day => {
            day.exercises.forEach(planExercise => {
              if (!tmExercisesMap.has(planExercise.tmExerciseId)) {
                tmExercisesMap.set(planExercise.tmExerciseId, planExercise.tmExercise)
              }
            })
          })

          const missing = Array.from(tmExercisesMap.values())
            .filter(ex => !existingTMSlugs.has(ex.slug))
          setRequiredExercises(missing)
        } else {
          // Full setup: all plan exercises
          const tmExerciseIds = new Set<number>()
          const tmExercisesMap = new Map<number, Exercise>()

          plan.days.forEach(day => {
            day.exercises.forEach(planExercise => {
              if (!tmExerciseIds.has(planExercise.tmExerciseId)) {
                tmExerciseIds.add(planExercise.tmExerciseId)
                tmExercisesMap.set(planExercise.tmExerciseId, planExercise.tmExercise)
              }
            })
          })

          setRequiredExercises(Array.from(tmExercisesMap.values()))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exercises')
      } finally {
        setIsLoading(false)
      }
    }

    loadRequiredExercises()
  }, [isMissingTMsMode])

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

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p>Loading exercises...</p>
        </div>
      </div>
    )
  }

  if (requiredExercises.length === 0) {
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
