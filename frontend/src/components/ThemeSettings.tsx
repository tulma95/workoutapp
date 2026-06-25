import { useState } from 'react'
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../utils/theme'
import styles from '../styles/ThemeSettings.module.css'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeSettings() {
  const [pref, setPref] = useState<ThemePreference>(getThemePreference)

  function choose(value: ThemePreference) {
    setPref(value)
    setThemePreference(value)
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.label}>Appearance</h3>
      <div className={styles.options} role="radiogroup" aria-label="Theme">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={pref === o.value}
            className={`${styles.option} ${pref === o.value ? styles.optionActive : ''}`}
            onClick={() => choose(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  )
}
