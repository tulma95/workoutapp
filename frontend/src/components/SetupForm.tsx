import { type FormEvent } from 'react'
import { type Exercise } from '../api/plans'
import { ErrorMessage } from './ErrorMessage'
import { Button } from './Button'
import { ButtonLink } from './ButtonLink'
import styles from '../styles/SetupPage.module.css'

type Props = {
  requiredExercises: Exercise[]
  formData: Record<string, string>
  error: string
  isSubmitting: boolean
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (e: FormEvent) => void
}

export function SetupForm({ requiredExercises, formData, error, isSubmitting, onInputChange, onSubmit }: Props) {
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

        <form onSubmit={onSubmit} className={styles.form}>
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
                onChange={onInputChange}
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
