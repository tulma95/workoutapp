import { useState, useMemo, useRef, useEffect } from 'react'
import styles from './ProgressChart.module.css'
import { formatWeight } from '../utils/weight'
import type { TrainingMax } from '../api/schemas'
import { getRangeStartDate } from './TimeRangeSelector'
import type { TimeRange } from './TimeRangeSelector'

interface Props {
  history: TrainingMax[]
  color: string
  exerciseName: string
  timeRange: TimeRange
}

const CHART_PADDING = { top: 12, right: 16, bottom: 28, left: 44 }

function formatDateLabel(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

interface TooltipData {
  x: number
  y: number
  date: string
  weight: number
}

export function ProgressChart({ history, color, exerciseName, timeRange }: Props) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = entry.contentRect.width
      const height = Math.min(width * 0.52, 220)
      setDimensions({ width, height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const filteredData = useMemo(() => {
    const rangeStart = getRangeStartDate(timeRange)
    const sorted = [...history].sort(
      (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
    )
    if (!rangeStart) return sorted
    return sorted.filter((tm) => new Date(tm.effectiveDate) >= rangeStart)
  }, [history, timeRange])

  const { width, height } = dimensions
  const plotWidth = width - CHART_PADDING.left - CHART_PADDING.right
  const plotHeight = height - CHART_PADDING.top - CHART_PADDING.bottom

  const linePath = useMemo(() => {
    if (filteredData.length < 2 || plotWidth <= 0 || plotHeight <= 0) return ''
    const weights = filteredData.map((d) => d.weight)
    const minWeight = Math.floor(Math.min(...weights) / 2.5) * 2.5 - 2.5
    const maxWeight = Math.ceil(Math.max(...weights) / 2.5) * 2.5 + 2.5
    const weightRange = maxWeight - minWeight || 5
    const dates = filteredData.map((d) => new Date(d.effectiveDate).getTime())
    const minDate = dates[0]!
    const maxDate = dates[dates.length - 1]!
    const dateRange = maxDate - minDate || 1
    const sx = (ts: number) => CHART_PADDING.left + ((ts - minDate) / dateRange) * plotWidth
    const sy = (w: number) => CHART_PADDING.top + (1 - (w - minWeight) / weightRange) * plotHeight
    const parts: string[] = []
    filteredData.forEach((point, i) => {
      const x = sx(new Date(point.effectiveDate).getTime())
      const y = sy(point.weight)
      if (i === 0) {
        parts.push(`M ${x} ${y}`)
      } else {
        parts.push(`H ${x} V ${y}`)
      }
    })
    parts.push(`H ${CHART_PADDING.left + plotWidth}`)
    return parts.join(' ')
  }, [filteredData, plotWidth, plotHeight])

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength())
    }
  }, [linePath])

  if (filteredData.length < 2) {
    return (
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>{exerciseName}</div>
        <div className={styles.emptyChart}>
          <p>Complete more workouts to see your {exerciseName.toLowerCase()} progression.</p>
        </div>
      </div>
    )
  }

  const weights = filteredData.map((d) => d.weight)
  const minWeight = Math.floor(Math.min(...weights) / 2.5) * 2.5 - 2.5
  const maxWeight = Math.ceil(Math.max(...weights) / 2.5) * 2.5 + 2.5
  const weightRange = maxWeight - minWeight || 5

  const dates = filteredData.map((d) => new Date(d.effectiveDate).getTime())
  const minDate = dates[0]!
  const maxDate = dates[dates.length - 1]!
  const dateRange = maxDate - minDate || 1

  const scaleX = (timestamp: number) =>
    CHART_PADDING.left + ((timestamp - minDate) / dateRange) * plotWidth
  const scaleY = (weight: number) =>
    CHART_PADDING.top + (1 - (weight - minWeight) / weightRange) * plotHeight

  const areaPath = `${linePath} V ${CHART_PADDING.top + plotHeight} H ${CHART_PADDING.left} Z`

  const gridCount = 4
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const weight = minWeight + ((i + 1) / (gridCount + 1)) * weightRange
    const rounded = Math.round(weight / 2.5) * 2.5
    return { weight: rounded, y: scaleY(rounded) }
  })

  const xLabelCount = Math.min(5, filteredData.length)
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const timestamp = minDate + (i / (xLabelCount - 1)) * dateRange
    return { date: new Date(timestamp), x: scaleX(timestamp) }
  })

  const gradientId = `gradient-${exerciseName.replace(/\s/g, '')}`

  const handleDotClick = (point: TrainingMax, x: number, y: number) => {
    setTooltip({
      x,
      y,
      date: formatDateLabel(new Date(point.effectiveDate)),
      weight: point.weight,
    })
  }

  const handleSvgClick = (e: React.MouseEvent) => {
    if ((e.target as Element).tagName !== 'circle') {
      setTooltip(null)
    }
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>{exerciseName}</div>
      <div ref={containerRef} className={styles.chartContainer}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-labelledby={`chart-title-${exerciseName}`}
            onClick={handleSvgClick}
          >
            <title id={`chart-title-${exerciseName}`}>
              {exerciseName} Training Max progression chart
            </title>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.12" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {gridLines.map((gl) => (
              <g key={gl.weight}>
                <line
                  x1={CHART_PADDING.left}
                  y1={gl.y}
                  x2={CHART_PADDING.left + plotWidth}
                  y2={gl.y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />
                <text
                  x={CHART_PADDING.left - 6}
                  y={gl.y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="inherit"
                >
                  {gl.weight}
                </text>
              </g>
            ))}

            {xLabels.map((xl, i) => (
              <text
                key={i}
                x={xl.x}
                y={CHART_PADDING.top + plotHeight + 18}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="inherit"
              >
                {formatDateLabel(xl.date)}
              </text>
            ))}

            <path d={areaPath} fill={`url(#${gradientId})`} />

            <path
              ref={pathRef}
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.chartLine}
              style={{
                strokeDasharray: pathLength || undefined,
                strokeDashoffset: pathLength || undefined,
              }}
            />

            {filteredData.map((point) => {
              const x = scaleX(new Date(point.effectiveDate).getTime())
              const y = scaleY(point.weight)
              const isActive = tooltip?.date === formatDateLabel(new Date(point.effectiveDate))
              return (
                <circle
                  key={point.id}
                  cx={x}
                  cy={y}
                  r={isActive ? 5.5 : 3}
                  fill={color}
                  stroke="white"
                  strokeWidth={isActive ? 2 : 1.5}
                  className={styles.dot}
                  onClick={() => handleDotClick(point, x, y)}
                />
              )
            })}
          </svg>
        )}

        {tooltip && (
          <div
            className={styles.tooltip}
            style={{
              left: tooltip.x,
              top: tooltip.y - 12,
            }}
          >
            <span>{tooltip.date}</span>
            <span className={styles.tooltipDot} style={{ color }}>
              &bull;
            </span>
            <span>{formatWeight(tooltip.weight)}</span>
          </div>
        )}
      </div>

      <div className={styles.srOnly}>
        <table>
          <caption>{exerciseName} Training Max History</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((point) => (
              <tr key={point.id}>
                <th scope="row">
                  <time dateTime={point.effectiveDate}>
                    {formatDateLabel(new Date(point.effectiveDate))}
                  </time>
                </th>
                <td>{point.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
