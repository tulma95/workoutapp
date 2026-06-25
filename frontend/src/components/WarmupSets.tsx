import { computeWarmupSets } from '../utils/warmup'
import { formatWeight } from '../utils/weight'
import styles from '../styles/WarmupSets.module.css'

// Collapsible warm-up ramp shown above an exercise's working sets. Guidance
// only — not part of the logged workout. Collapsed by default to keep the
// working sets prominent on a phone.
export function WarmupSets({ topWeight }: { topWeight: number }) {
  const sets = computeWarmupSets(topWeight)
  if (sets.length === 0) return null

  return (
    <details className={styles.warmup}>
      <summary className={styles.summary}>
        Warm-up · {sets.length} sets
      </summary>
      <ol className={styles.list} data-testid="warmup-list">
        {sets.map((s, i) => (
          <li key={i} className={styles.row}>
            <span className={styles.weight}>{formatWeight(s.weight)}</span>
            <span className={styles.reps}>× {s.reps}</span>
          </li>
        ))}
      </ol>
      <p className={styles.note}>Suggested ramp-up — not tracked.</p>
    </details>
  )
}
