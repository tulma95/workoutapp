import styles from './BodyweightChart.module.css'

interface Entry {
  weight: number
  recordedAt: string
}

const W = 300
const H = 96
const PAD_X = 6
const PAD_Y = 10

// A small responsive sparkline of bodyweight over time. Needs at least two
// points to draw a trend; the card already shows the exact recent values.
export function BodyweightChart({ entries }: { entries: Entry[] }) {
  if (entries.length < 2) return null

  const weights = entries.map((e) => e.weight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const rangeW = maxW - minW || 1

  // Evenly spaced by measurement order (not absolute time) so the trend reads
  // cleanly whether entries are minutes or weeks apart.
  const sx = (i: number) => PAD_X + (i / (entries.length - 1)) * (W - 2 * PAD_X)
  const sy = (w: number) => PAD_Y + (1 - (w - minW) / rangeW) * (H - 2 * PAD_Y)

  const pts = entries.map((e, i) => `${sx(i).toFixed(1)},${sy(e.weight).toFixed(1)}`)
  const linePoints = pts.join(' ')
  const areaPath = `M ${sx(0).toFixed(1)},${H} L ${pts.join(' L ')} L ${sx(entries.length - 1).toFixed(1)},${H} Z`

  const lastX = sx(entries.length - 1)
  const lastY = sy(weights[weights.length - 1]!)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={styles.chart}
      role="img"
      aria-label={`Bodyweight trend, ${entries.length} entries from ${minW} to ${maxW} kg`}
      data-testid="bodyweight-chart"
    >
      <path d={areaPath} className={styles.area} />
      <polyline points={linePoints} className={styles.line} />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r={3.5} className={styles.dot} />
    </svg>
  )
}
