import { useState } from 'react'
import { estimateOneRepMax } from '../utils/weight'
import styles from '../styles/OneRepMaxEstimator.module.css'

// A collapsible helper for new users who don't know their 1 rep max: enter a
// recent weight × reps and it estimates the 1RM (Epley) and fills the field.
export function OneRepMaxEstimator({
  exerciseName,
  onApply,
}: {
  exerciseName: string
  onApply: (value: number) => void
}) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  const w = parseFloat(weight)
  const r = parseInt(reps, 10)
  const valid = w > 0 && r >= 1 && r <= 20
  const estimate = valid ? estimateOneRepMax(w, r) : null

  return (
    <details className={styles.estimator} data-testid={`1rm-estimator-${exerciseName}`}>
      <summary className={styles.summary}>Don&apos;t know it? Estimate from a recent set</summary>
      <div className={styles.body}>
        <div className={styles.inputs}>
          {/* Generic labels (no exercise name) so these don't collide with the
              main 1RM inputs' accessible names in tests/AT; the enclosing
              data-testid disambiguates per exercise. */}
          <input
            type="number"
            inputMode="decimal"
            placeholder="Weight (kg)"
            aria-label="Weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            min="0"
            step="0.5"
          />
          <span className={styles.times}>×</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Reps"
            aria-label="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            min="1"
            max="20"
            step="1"
          />
        </div>
        {estimate !== null && (
          <p className={styles.result}>
            Estimated 1RM: <strong>{estimate} kg</strong>
          </p>
        )}
        <button
          type="button"
          className={styles.apply}
          disabled={estimate === null}
          onClick={() => {
            if (estimate !== null) onApply(estimate)
          }}
        >
          Use estimate
        </button>
      </div>
    </details>
  )
}
