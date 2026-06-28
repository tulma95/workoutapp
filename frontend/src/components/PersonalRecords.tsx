import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { getPersonalRecords } from '../api/progress'
import { formatWeight } from '../utils/weight'
import { formatDate } from '../utils/date'
import styles from './PersonalRecords.module.css'

export function PersonalRecords() {
  const { data } = useQuery({
    queryKey: queryKeys.progress.records(),
    queryFn: getPersonalRecords,
  })

  const records = data?.records ?? []
  if (records.length === 0) return null

  return (
    <section className={styles.section} aria-label="Personal records">
      <h3 className={styles.heading}>Personal Records</h3>
      <ul className={styles.list} data-testid="personal-records">
        {records.map((r) => (
          <li key={r.slug} className={styles.card}>
            <span className={styles.name}>{r.name}</span>
            <span className={styles.e1rm}>{formatWeight(r.e1rm)}</span>
            <span className={styles.label}>est. 1RM</span>
            <span className={styles.source}>
              {formatWeight(r.weight)} × {r.reps} · {formatDate(r.date)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
