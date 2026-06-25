import type { NewPersonalRecord } from '../api/workouts'
import { formatWeight } from '../utils/weight'
import styles from './PersonalRecordCelebration.module.css'

export function PersonalRecordCelebration({ prs }: { prs: NewPersonalRecord[] }) {
  if (prs.length === 0) return null

  return (
    <section className={styles.banner} data-testid="pr-celebration" aria-label="New personal records">
      <p className={styles.title}>🎉 New PR{prs.length > 1 ? 's' : ''}!</p>
      <ul className={styles.list}>
        {prs.map((pr) => (
          <li key={pr.slug} className={styles.item}>
            <span className={styles.name}>{pr.name}</span>
            <span className={styles.value}>
              {formatWeight(pr.e1rm)}
              <span className={styles.prev}> (was {formatWeight(pr.previousE1rm)})</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
