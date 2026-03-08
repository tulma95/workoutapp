import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import styles from './ProgressContent.module.css'
import { TimeRangeSelector, type TimeRange } from './TimeRangeSelector'
import {
  ProgressSummaryCards,
  type ExerciseConfig,
} from './ProgressSummaryCards'
import { ExerciseLegend } from './ExerciseLegend'
import { getProgress } from '../api/progress'
import { LoadingSpinner } from './LoadingSpinner'
import { ProgressChart, type HistoryEntry } from './ProgressChart'

const PALETTE = ['#2563eb', '#d97706', '#7c3aed', '#059669', '#dc2626', '#0891b2']

function getStoredRange(): TimeRange {
  const stored = localStorage.getItem('progressTimeRange')
  if (stored === '1m' || stored === '3m' || stored === '6m' || stored === 'all') return stored
  return '3m'
}

export function ProgressContent() {
  const [timeRange, setTimeRange] = useState<TimeRange>(getStoredRange)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [visibleExercises, setVisibleExercises] = useState<Set<string> | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.progress.all(),
    queryFn: getProgress,
  })

  const [showAllExercises, setShowAllExercises] = useState(false)

  const exerciseConfigs: (ExerciseConfig & { inCurrentPlan: boolean })[] = useMemo(() => {
    if (!data) return []
    return data.exercises.map((ex, i) => ({
      slug: ex.slug,
      name: ex.name,
      color: PALETTE[i % PALETTE.length] ?? PALETTE[0]!,
      inCurrentPlan: ex.inCurrentPlan,
    }))
  }, [data])

  const displayedExercises = useMemo(() => {
    if (showAllExercises) return exerciseConfigs
    return exerciseConfigs.filter(ex => ex.inCurrentPlan)
  }, [exerciseConfigs, showAllExercises])

  const histories = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>()
    if (!data) return map
    for (const ex of data.exercises) {
      map.set(ex.slug, ex.history)
    }
    return map
  }, [data])

  const activeSelected = selectedExercise ?? displayedExercises[0]?.slug ?? null
  const activeVisible = visibleExercises ?? new Set(displayedExercises.map((e) => e.slug))

  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    localStorage.setItem('progressTimeRange', range)
    setAnnouncement(`Showing data for ${range === 'all' ? 'all time' : `last ${range.replace('m', ' months')}`}`)
  }

  const handleToggleExercise = (slug: string) => {
    setVisibleExercises((prev) => {
      const current = prev ?? new Set(displayedExercises.map((e) => e.slug))
      const next = new Set(current)
      if (next.has(slug)) {
        if (next.size > 1) next.delete(slug)
      } else {
        next.add(slug)
      }
      const name = displayedExercises.find((e) => e.slug === slug)?.name ?? slug
      setAnnouncement(`${name} ${next.has(slug) ? 'shown on' : 'hidden from'} chart`)
      return next
    })
  }

  const handleSelectExercise = (slug: string) => {
    setSelectedExercise(slug)
    setVisibleExercises((prev) => {
      const current = prev ?? new Set(displayedExercises.map((e) => e.slug))
      if (current.has(slug)) return current
      const next = new Set(current)
      next.add(slug)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Progress</h1>
        <LoadingSpinner />
      </div>
    )
  }

  const hasData = data && data.exercises.some((ex) => ex.currentE1rm !== null)
  const hasProgression = Array.from(histories.values()).some((h) => h.length >= 2)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Progress</h1>
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {announcement}
      </div>
      <TimeRangeSelector value={timeRange} onChange={handleRangeChange} />
      {exerciseConfigs.some(ex => !ex.inCurrentPlan) && (
        <label className={styles.allExercisesToggle}>
          <input
            type="checkbox"
            checked={showAllExercises}
            onChange={(e) => setShowAllExercises(e.target.checked)}
          />
          Show all exercises
        </label>
      )}

      {hasData ? (
        <>
          <ProgressSummaryCards
            exercises={displayedExercises}
            histories={histories}
            timeRange={timeRange}
            selectedExercise={activeSelected}
            onSelectExercise={handleSelectExercise}
          />
          {!hasProgression ? (
            <div className={styles.emptyMotivation}>
              <p className={styles.emptyMotivationTitle}>
                Complete your first workout to start tracking progress.
              </p>
              <p className={styles.emptyMotivationText}>
                Complete workouts to see your estimated strength increase over time.
              </p>
            </div>
          ) : (
            <>
              <ExerciseLegend
                exercises={displayedExercises}
                visible={activeVisible}
                onToggle={handleToggleExercise}
              />
              {(() => {
                const config = activeSelected
                  ? displayedExercises.find((e) => e.slug === activeSelected)
                  : null
                const exerciseHistory = activeSelected ? (histories.get(activeSelected) ?? []) : []
                return config && activeSelected && activeVisible.has(activeSelected) ? (
                  <ProgressChart
                    history={exerciseHistory}
                    color={config.color}
                    exerciseName={config.name}
                    timeRange={timeRange}
                    planSwitches={data?.planSwitches}
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
            Complete workouts to start tracking your estimated strength.
          </p>
        </div>
      )}
    </div>
  )
}
