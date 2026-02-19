import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import styles from './ProgressContent.module.css'
import { TimeRangeSelector, type TimeRange } from './TimeRangeSelector'
import {
  ProgressSummaryCards,
  type ExerciseConfig,
} from './ProgressSummaryCards'
import { ExerciseLegend } from './ExerciseLegend'
import { getProgress } from '../api/progress'
import { LoadingSpinner } from './LoadingSpinner'
import { ProgressChart } from './ProgressChart'
import type { TrainingMax } from '../api/schemas'

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
    queryKey: ['progress'],
    queryFn: getProgress,
  })

  const exerciseConfigs: ExerciseConfig[] = useMemo(() => {
    if (!data) return []
    return data.exercises.map((ex, i) => ({
      slug: ex.slug,
      name: ex.name,
      color: PALETTE[i % PALETTE.length] ?? PALETTE[0]!,
    }))
  }, [data])

  const histories = useMemo(() => {
    const map = new Map<string, TrainingMax[]>()
    if (!data) return map
    for (const ex of data.exercises) {
      map.set(
        ex.slug,
        ex.history.map((h, i) => ({
          id: i,
          userId: 0,
          exercise: ex.slug,
          weight: h.weight,
          effectiveDate: h.effectiveDate,
          createdAt: h.effectiveDate,
        }))
      )
    }
    return map
  }, [data])

  const activeSelected = selectedExercise ?? exerciseConfigs[0]?.slug ?? null
  const activeVisible = visibleExercises ?? new Set(exerciseConfigs.map((e) => e.slug))

  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    localStorage.setItem('progressTimeRange', range)
    setAnnouncement(`Showing data for ${range === 'all' ? 'all time' : `last ${range.replace('m', ' months')}`}`)
  }

  const handleToggleExercise = (slug: string) => {
    setVisibleExercises((prev) => {
      const current = prev ?? new Set(exerciseConfigs.map((e) => e.slug))
      const next = new Set(current)
      if (next.has(slug)) {
        if (next.size > 1) next.delete(slug)
      } else {
        next.add(slug)
      }
      const name = exerciseConfigs.find((e) => e.slug === slug)?.name ?? slug
      setAnnouncement(`${name} ${next.has(slug) ? 'shown on' : 'hidden from'} chart`)
      return next
    })
  }

  const handleSelectExercise = (slug: string) => {
    setSelectedExercise(slug)
    setVisibleExercises((prev) => {
      const current = prev ?? new Set(exerciseConfigs.map((e) => e.slug))
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

  const hasTMs = data && data.exercises.some((ex) => ex.currentTM !== null)
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
            exercises={exerciseConfigs}
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
                Complete workouts to see your training maxes increase over time.
              </p>
            </div>
          ) : (
            <>
              <ExerciseLegend
                exercises={exerciseConfigs}
                visible={activeVisible}
                onToggle={handleToggleExercise}
              />
              {(() => {
                const config = activeSelected
                  ? exerciseConfigs.find((e) => e.slug === activeSelected)
                  : null
                const exerciseHistory = activeSelected ? (histories.get(activeSelected) ?? []) : []
                return config && activeSelected && activeVisible.has(activeSelected) ? (
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
