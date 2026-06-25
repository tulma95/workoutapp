import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import {
  getBodyweightHistory,
  logBodyweight,
  deleteBodyweightEntry,
} from '../api/bodyweight'
import { BodyweightChart } from './BodyweightChart'
import styles from './BodyweightCard.module.css'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function BodyweightCard() {
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')
  const { data } = useQuery({
    queryKey: queryKeys.bodyweight.all(),
    queryFn: getBodyweightHistory,
  })
  const entries = data?.entries ?? []

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bodyweight.all() })

  const logMutation = useMutation({
    mutationFn: (weight: number) => logBodyweight(weight),
    onSuccess: () => {
      setValue('')
      void invalidate()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBodyweightEntry(id),
    onSuccess: () => void invalidate(),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const weight = parseFloat(value)
    if (!Number.isFinite(weight) || weight <= 0 || weight > 999) return
    logMutation.mutate(weight)
  }

  const latest = entries[entries.length - 1]
  const prev = entries[entries.length - 2]
  const delta = latest && prev ? Math.round((latest.weight - prev.weight) * 10) / 10 : null
  const recent = [...entries].reverse().slice(0, 6)

  return (
    <section className={styles.card} aria-label="Bodyweight">
      <h3 className={styles.heading}>Bodyweight</h3>

      {latest ? (
        <div className={styles.current}>
          <span className={styles.weight}>{latest.weight} kg</span>
          {delta !== null && delta !== 0 && (
            <span className={styles.delta}>
              {delta < 0 ? '↓' : '↑'} {Math.abs(delta)} kg
            </span>
          )}
        </div>
      ) : (
        <p className={styles.empty}>Log your weight to track it over time.</p>
      )}

      <BodyweightChart entries={entries} />

      <form className={styles.form} onSubmit={submit}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder="Weight (kg)"
          aria-label="Bodyweight (kg)"
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="submit"
          className={styles.logButton}
          disabled={logMutation.isPending || value === ''}
        >
          Log
        </button>
      </form>

      {recent.length > 0 && (
        <ul className={styles.list} data-testid="bodyweight-history">
          {recent.map((entry) => (
            <li key={entry.id} className={styles.item}>
              <span className={styles.itemDate}>{formatDate(entry.recordedAt)}</span>
              <span className={styles.itemWeight}>{entry.weight} kg</span>
              <button
                type="button"
                className={styles.deleteButton}
                aria-label={`Delete entry from ${formatDate(entry.recordedAt)}`}
                onClick={() => deleteMutation.mutate(entry.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
