import styles from './RpePicker.module.css'

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const

interface RpePickerProps {
  value: number | null
  onChange: (rpe: number | null) => void
}

// Optional Rate of Perceived Exertion for the top/AMRAP set. Tapping the
// selected value again clears it.
export function RpePicker({ value, onChange }: RpePickerProps) {
  return (
    <div className={styles.picker} data-testid="rpe-picker">
      <span className={styles.label}>RPE</span>
      <div className={styles.options} role="group" aria-label="Rate of perceived exertion">
        {RPE_OPTIONS.map((n) => {
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              className={`${styles.option} ${selected ? styles.selected : ''}`}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : n)}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
