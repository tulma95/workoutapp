import styles from './ExerciseLegend.module.css'
import type { ExerciseConfig } from './ProgressSummaryCards'

interface Props {
  exercises: ExerciseConfig[]
  visible: Set<string>
  onToggle: (slug: string) => void
}

export function ExerciseLegend({ exercises, visible, onToggle }: Props) {
  return (
    <ul role="list" aria-label="Toggle exercises" className={styles.list}>
      {exercises.map((ex) => {
        const isActive = visible.has(ex.slug)
        return (
          <li key={ex.slug}>
            <button
              type="button"
              aria-pressed={isActive}
              className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
              style={{
                borderColor: isActive ? `${ex.color}60` : undefined,
                backgroundColor: isActive ? `${ex.color}14` : undefined,
                color: isActive ? ex.color : undefined,
              }}
              onClick={() => onToggle(ex.slug)}
            >
              <span
                className={styles.swatch}
                style={{ backgroundColor: isActive ? ex.color : undefined }}
                aria-hidden="true"
              />
              {ex.name}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
