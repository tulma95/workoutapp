import styles from './TimeRangeSelector.module.css'

export type TimeRange = '1m' | '3m' | '6m' | 'all'

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: 'all', label: 'All' },
]

interface Props {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

export function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.srOnly}>Time range</legend>
      <div className={styles.selector}>
        {OPTIONS.map((opt) => (
          <label key={opt.value} className={styles.option}>
            <input
              type="radio"
              name="timeRange"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className={styles.srOnly}
            />
            <span className={`${styles.label} ${value === opt.value ? styles.labelActive : ''}`}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
