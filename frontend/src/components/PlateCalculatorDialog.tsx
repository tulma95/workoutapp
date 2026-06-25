import { useRef, useState } from 'react'
import { useDialog } from '../hooks/useDialog'
import {
  computePlatesPerSide,
  DEFAULT_BAR_KG,
  BAR_OPTIONS_KG,
} from '../utils/plates'
import { formatWeight } from '../utils/weight'
import styles from '../styles/PlateCalculatorDialog.module.css'

const BAR_KEY = 'setforge:barWeight'

function loadBar(): number {
  try {
    const v = Number(localStorage.getItem(BAR_KEY))
    return BAR_OPTIONS_KG.includes(v) ? v : DEFAULT_BAR_KG
  } catch {
    return DEFAULT_BAR_KG
  }
}

export function PlateCalculatorDialog({
  open,
  weight,
  onClose,
}: {
  open: boolean
  weight: number
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [bar, setBar] = useState(loadBar)
  useDialog(dialogRef, open, onClose)

  function selectBar(b: number) {
    setBar(b)
    try {
      localStorage.setItem(BAR_KEY, String(b))
    } catch {
      /* storage unavailable */
    }
  }

  const { groups, leftover } = computePlatesPerSide(weight, bar)

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Plate calculator"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>{formatWeight(weight)}</h2>
        <p className={styles.sub}>Plates per side</p>

        {groups.length > 0 ? (
          <ul className={styles.plates} data-testid="plate-list">
            {groups.map((g) => (
              <li key={g.weight} className={styles.plate}>
                <span className={styles.count}>{g.count}×</span>
                <span className={styles.plateWeight}>{g.weight} kg</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty} data-testid="plate-list">
            Just the bar — no plates needed.
          </p>
        )}

        {leftover > 0 && (
          <p className={styles.leftover}>
            +{leftover} kg not loadable with standard plates
          </p>
        )}

        <div className={styles.barRow}>
          <span className={styles.barLabel}>Bar</span>
          <div className={styles.barOptions}>
            {BAR_OPTIONS_KG.map((b) => (
              <button
                key={b}
                type="button"
                className={`${styles.barOption} ${b === bar ? styles.barOptionActive : ''}`}
                onClick={() => selectBar(b)}
              >
                {b} kg
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  )
}
