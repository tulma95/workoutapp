import type { WorkoutSummary } from '../utils/workoutSummary'
import { formatDuration, formatVolume } from '../utils/workoutSummary'
import styles from './WorkoutSummaryStats.module.css'

export function WorkoutSummaryStats({ summary }: { summary: WorkoutSummary }) {
  return (
    <dl className={styles.stats} data-testid="workout-summary">
      {summary.durationMin !== null && (
        <div className={styles.stat}>
          <dt className={styles.label}>Duration</dt>
          <dd className={styles.value}>{formatDuration(summary.durationMin)}</dd>
        </div>
      )}
      <div className={styles.stat}>
        <dt className={styles.label}>Sets</dt>
        <dd className={styles.value}>{summary.setsCompleted}</dd>
      </div>
      <div className={styles.stat}>
        <dt className={styles.label}>Volume</dt>
        <dd className={styles.value}>{formatVolume(summary.totalVolumeKg)}</dd>
      </div>
    </dl>
  )
}
