import styles from './ProgressSummaryCards.module.css'
import { formatWeight } from '../utils/weight'
import { getRangeStartDate } from './TimeRangeSelector'
import type { TimeRange } from './TimeRangeSelector'
import type { HistoryEntry } from './ProgressChart'

export interface ExerciseConfig {
  slug: string
  name: string
  color: string
}

interface Props {
  exercises: ExerciseConfig[]
  histories: Map<string, HistoryEntry[]>
  timeRange: TimeRange
  selectedExercise: string | null
  onSelectExercise: (slug: string) => void
}

function computeGain(history: HistoryEntry[], rangeStart: Date | null): number {
  if (history.length === 0) return 0
  // History is sorted ASC by date
  const current = history[history.length - 1]!.e1rm
  if (rangeStart === null) {
    return current - history[0]!.e1rm
  }
  // Find baseline: last entry at or before range start
  let baseline = history[0]!.e1rm
  for (const entry of history) {
    if (new Date(entry.date) <= rangeStart) {
      baseline = entry.e1rm
    } else {
      break
    }
  }
  return current - baseline
}

export function ProgressSummaryCards({
  exercises,
  histories,
  timeRange,
  selectedExercise,
  onSelectExercise,
}: Props) {
  const rangeStart = getRangeStartDate(timeRange)

  return (
    <div className={styles.grid}>
      {exercises.map((ex) => {
        const history = histories.get(ex.slug) ?? []
        const currentE1rm = history.length > 0 ? history[history.length - 1]!.e1rm : null
        const gain = computeGain(history, rangeStart)
        const isSelected = selectedExercise === ex.slug
        const hasData = history.length > 0

        return (
          <button
            key={ex.slug}
            className={styles.card}
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
              {hasData ? formatWeight(currentE1rm!) : '—'}
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
