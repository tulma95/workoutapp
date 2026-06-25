import styles from './WorkoutProgressBar.module.css'

export function WorkoutProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div
      className={styles.bar}
      data-testid="workout-progress"
      role="progressbar"
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${completed} of ${total} sets done`}
    >
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.count}>
        {completed}/{total}
      </span>
    </div>
  )
}
