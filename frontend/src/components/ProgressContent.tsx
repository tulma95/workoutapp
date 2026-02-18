import { useState, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import styles from './ProgressContent.module.css'
import { TimeRangeSelector, type TimeRange } from './TimeRangeSelector'
import {
  ProgressSummaryCards,
  EXERCISE_CONFIGS,
} from './ProgressSummaryCards'
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

  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    localStorage.setItem('progressTimeRange', range)
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

  // Use individual data references so the memo only re-runs when data actually changes
  const d0 = historyQueries[0]?.data
  const d1 = historyQueries[1]?.data
  const d2 = historyQueries[2]?.data
  const d3 = historyQueries[3]?.data

  const histories = useMemo(() => {
    const map = new Map<string, TrainingMax[]>()
    const allData = [d0, d1, d2, d3]
    EXERCISE_CONFIGS.forEach((ex, i) => {
      const data = allData[i]
      if (data) map.set(ex.slug, data)
    })
    return map
  }, [d0, d1, d2, d3])

  if (isLoadingTMs) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Progress</h1>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Progress</h1>
      <TimeRangeSelector value={timeRange} onChange={handleRangeChange} />

      {hasTMs ? (
        <>
          <ProgressSummaryCards
            histories={histories}
            timeRange={timeRange}
            selectedExercise={selectedExercise}
            onSelectExercise={setSelectedExercise}
          />
          {isLoadingHistory ? (
            <LoadingSpinner />
          ) : (
            (() => {
              const config = EXERCISE_CONFIGS.find((e) => e.slug === selectedExercise)
              const exerciseHistory = histories.get(selectedExercise) ?? []
              return config ? (
                <ProgressChart
                  history={exerciseHistory}
                  color={config.color}
                  exerciseName={config.name}
                  timeRange={timeRange}
                />
              ) : null
            })()
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
