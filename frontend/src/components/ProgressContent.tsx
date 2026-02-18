import { useState, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import styles from './ProgressContent.module.css'
import { TimeRangeSelector, type TimeRange } from './TimeRangeSelector'
import {
  ProgressSummaryCards,
  EXERCISE_CONFIGS,
} from './ProgressSummaryCards'
import { ExerciseLegend } from './ExerciseLegend'
import { getTrainingMaxes, getTrainingMaxHistory } from '../api/trainingMaxes'
import { LoadingSpinner } from './LoadingSpinner'
import { ProgressChart } from './ProgressChart'
import type { TrainingMax } from '../api/schemas'

function getStoredRange(): TimeRange {
  const stored = localStorage.getItem('progressTimeRange')
  if (stored === '1m' || stored === '3m' || stored === '6m' || stored === 'all') return stored
  return '3m'
}

export function ProgressContent() {
  const [timeRange, setTimeRange] = useState<TimeRange>(getStoredRange)
  const [selectedExercise, setSelectedExercise] = useState<string>(EXERCISE_CONFIGS[0]?.slug ?? 'bench-press')
  const [visibleExercises, setVisibleExercises] = useState<Set<string>>(
    () => new Set(EXERCISE_CONFIGS.map((e) => e.slug))
  )
  const [announcement, setAnnouncement] = useState('')

  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    localStorage.setItem('progressTimeRange', range)
    setAnnouncement(`Showing data for ${range === 'all' ? 'all time' : `last ${range.replace('m', ' months')}`}`)
  }

  const handleToggleExercise = (slug: string) => {
    setVisibleExercises((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        if (next.size > 1) next.delete(slug)
      } else {
        next.add(slug)
      }
      const name = EXERCISE_CONFIGS.find((e) => e.slug === slug)?.name ?? slug
      setAnnouncement(`${name} ${next.has(slug) ? 'shown on' : 'hidden from'} chart`)
      return next
    })
  }

  const handleSelectExercise = (slug: string) => {
    setSelectedExercise(slug)
    setVisibleExercises((prev) => {
      if (prev.has(slug)) return prev
      const next = new Set(prev)
      next.add(slug)
      return next
    })
  }

  // Check if user has TMs set up
  const { data: currentTMs, isLoading: isLoadingTMs } = useQuery({
    queryKey: ['training-maxes'],
    queryFn: getTrainingMaxes,
  })

  const hasTMs = currentTMs && currentTMs.length > 0

  // Fetch history for all exercises in parallel using useQueries
  const historyQueries = useQueries({
    queries: EXERCISE_CONFIGS.map((ex) => ({
      queryKey: ['training-maxes', ex.slug, 'history'],
      queryFn: () => getTrainingMaxHistory(ex.slug),
      enabled: hasTMs === true,
    })),
  })

  const isLoadingHistory = historyQueries.some((q) => q.isLoading && q.fetchStatus !== 'idle')

  const historyData = historyQueries.map((q) => q.data)

  const histories = useMemo(() => {
    const map = new Map<string, TrainingMax[]>()
    EXERCISE_CONFIGS.forEach((ex, i) => {
      const data = historyData[i]
      if (data) map.set(ex.slug, data)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, historyData)

  if (isLoadingTMs) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Progress</h1>
        <LoadingSpinner />
      </div>
    )
  }

  const hasProgression = Array.from(histories.values()).some((h) => h.length >= 2)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Progress</h1>
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {announcement}
      </div>
      <TimeRangeSelector value={timeRange} onChange={handleRangeChange} />

      {hasTMs ? (
        <>
          <ProgressSummaryCards
            histories={histories}
            timeRange={timeRange}
            selectedExercise={selectedExercise}
            onSelectExercise={handleSelectExercise}
          />
          {!hasProgression ? (
            <div className={styles.emptyMotivation}>
              <p className={styles.emptyMotivationTitle}>
                Complete your first workout to start tracking progress.
              </p>
              <p className={styles.emptyMotivationText}>
                nSuns LP adds 2.5-5 kg per week. In 3 months you could be lifting 30-60 kg more.
              </p>
            </div>
          ) : isLoadingHistory ? (
            <LoadingSpinner />
          ) : (
            <>
              <ExerciseLegend
                exercises={EXERCISE_CONFIGS}
                visible={visibleExercises}
                onToggle={handleToggleExercise}
              />
              {(() => {
                const config = EXERCISE_CONFIGS.find((e) => e.slug === selectedExercise)
                const exerciseHistory = histories.get(selectedExercise) ?? []
                return config && visibleExercises.has(selectedExercise) ? (
                  <ProgressChart
                    history={exerciseHistory}
                    color={config.color}
                    exerciseName={config.name}
                    timeRange={timeRange}
                  />
                ) : null
              })()}
            </>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No training data yet</p>
          <p className={styles.emptyText}>
            Set up your training maxes to start tracking progress.
          </p>
        </div>
      )}
    </div>
  )
}
