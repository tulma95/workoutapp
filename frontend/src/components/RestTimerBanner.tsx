import styles from './RestTimerBanner.module.css'

type Props = {
  secondsRemaining: number
  totalSeconds: number
  onAdjust: (delta: number) => void
  onSkip: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RestTimerBanner({ secondsRemaining, totalSeconds, onAdjust, onSkip }: Props) {
  const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 0

  return (
    <div className={styles.banner} data-testid="rest-timer">
      <div className={styles.content}>
        <span className={styles.time}>{formatTime(secondsRemaining)}</span>
        <div className={styles.controls}>
          <button className={styles.adjustBtn} onClick={() => onAdjust(-30)} aria-label="Decrease rest by 30 seconds">
            -30s
          </button>
          <button className={styles.adjustBtn} onClick={() => onAdjust(30)} aria-label="Increase rest by 30 seconds">
            +30s
          </button>
          <button className={styles.skipBtn} onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
