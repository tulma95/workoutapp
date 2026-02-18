import styles from './ProgressSummaryCards.module.css'
import { formatWeight } from '../utils/weight'
import type { TimeRange } from './TimeRangeSelector'
import type { TrainingMax } from '../api/schemas'

export interface ExerciseConfig {
  slug: string
  name: string
  color: string
}

export const EXERCISE_CONFIGS: ExerciseConfig[] = [
  { slug: 'bench-press', name: 'Bench', color: '#2563eb' },
  { slug: 'squat', name: 'Squat', color: '#d97706' },
  { slug: 'ohp', name: 'OHP', color: '#7c3aed' },
  { slug: 'deadlift', name: 'Deadlift', color: '#059669' },
]

interface Props {
  histories: Map<string, TrainingMax[]>
  timeRange: TimeRange
  selectedExercise: string | null
  onSelectExercise: (slug: string) => void
}

function getRangeStartDate(range: TimeRange): Date | null {
  if (range === 'all') return null
  const now = new Date()
  const months = range === '1m' ? 1 : range === '3m' ? 3 : 6
  now.setMonth(now.getMonth() - months)
  return now
}

function computeGain(history: TrainingMax[], rangeStart: Date | null): number {
  const first = history[0]
  const last = history[history.length - 1]
  if (!first || !last) return 0
  // History is sorted DESC by effectiveDate
  const current = first.weight
  if (rangeStart === null) {
    return current - last.weight
  }
  // Find the TM at or just before the range start
  const baseline = history.find(
    (tm) => new Date(tm.effectiveDate) <= rangeStart
  )
  if (!baseline) {
    return current - last.weight
  }
  return current - baseline.weight
}

export function ProgressSummaryCards({
  histories,
  timeRange,
  selectedExercise,
  onSelectExercise,
}: Props) {
  const rangeStart = getRangeStartDate(timeRange)

  return (
    <div className={styles.grid}>
      {EXERCISE_CONFIGS.map((ex) => {
        const history = histories.get(ex.slug) ?? []
        const currentTM = history[0]?.weight ?? null
        const gain = computeGain(history, rangeStart)
        const isSelected = selectedExercise === ex.slug
        const hasData = history.length > 0

        return (
          <button
            key={ex.slug}
            className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
            style={{
              borderColor: isSelected ? ex.color : undefined,
              backgroundColor: isSelected ? `${ex.color}08` : undefined,
            }}
            onClick={() => onSelectExercise(ex.slug)}
            aria-pressed={isSelected}
          >
            <span className={styles.exerciseName} style={{ color: ex.color }}>
              {ex.name}
            </span>
            <span className={styles.currentWeight}>
              {hasData ? formatWeight(currentTM!) : '—'}
            </span>
            {hasData && gain > 0 ? (
              <span className={styles.gain}>+{formatWeight(gain)}</span>
            ) : hasData && gain === 0 ? (
              <span className={styles.noChange}>—</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
