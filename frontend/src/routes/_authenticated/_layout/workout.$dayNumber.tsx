import { useState, useEffect, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  getCurrentWorkout,
  startWorkout,
  logSet,
  completeWorkout,
  cancelWorkout,
  type Workout,
  type ProgressionResult,
} from '../../../api/workouts'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { ErrorMessage } from '../../../components/ErrorMessage'
import { SkeletonLine, SkeletonHeading } from '../../../components/Skeleton'
import { ConflictDialog } from '../../../components/ConflictDialog'
import { ButtonLink } from '../../../components/ButtonLink'
import { ActiveWorkoutView } from '../../../components/ActiveWorkoutView'
import { useRestTimer } from '../../../hooks/useRestTimer'
import { getRestTimerSettings } from '../../../utils/restTimerSettings'
import styles from '../../../styles/WorkoutPage.module.css'

type LoaderResult =
  | { type: 'existing'; workout: Workout }
  | { type: 'conflict'; workoutId: number; dayNumber: number }
  | { type: 'none' }

type WorkoutPhase =
  | { phase: 'loading' }
  | { phase: 'conflict'; existingWorkoutId: number; existingDayNumber: number }
  | { phase: 'active' }
  | { phase: 'error'; message: string }

type ActivePhase =
  | { phase: 'active' }
  | { phase: 'completing' }
  | { phase: 'completed'; progressions: ProgressionResult[] }
  | { phase: 'canceling' }
  | { phase: 'error'; message: string }

export const Route = createFileRoute(
  '/_authenticated/_layout/workout/$dayNumber',
)({
  preload: false,
  loader: async ({ params }): Promise<LoaderResult> => {
    const dayNumber = parseInt(params.dayNumber || '0', 10)
    if (!dayNumber) {
      throw new Error('Invalid day number')
    }

    const currentWorkout = await getCurrentWorkout()

    if (currentWorkout) {
      if (currentWorkout.dayNumber === dayNumber) {
        return { type: 'existing', workout: currentWorkout }
      }
      return {
        type: 'conflict',
        workoutId: currentWorkout.id,
        dayNumber: currentWorkout.dayNumber,
      }
    }

    return { type: 'none' }
  },
  pendingComponent: () => (
    <div className={styles.page}>
      <SkeletonHeading width="30%" />

      {[1, 2].map((i) => (
        <section key={i} className={styles.section}>
          <div className={styles.sectionTitle} style={{ border: 'none' }}>
            <SkeletonLine width="40%" height="1.25rem" />
          </div>
          <div className={styles.sectionSets}>
            {Array.from({ length: i === 1 ? 9 : 8 }, (_, j) => (
              <div
                key={j}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '3rem',
                }}
              >
                <SkeletonLine width="60%" height="1rem" />
                <SkeletonLine width="3rem" height="2.5rem" />
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className={styles.actions}>
        <SkeletonLine width="100%" height="3rem" />
        <SkeletonLine width="100%" height="3rem" />
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className={styles.page}>
      <ErrorMessage
        message={
          error instanceof Error ? error.message : 'Failed to load workout'
        }
      />
    </div>
  ),
  component: WorkoutPage,
})

function WorkoutPage() {
  const loaderData = Route.useLoaderData()
  const { dayNumber: dayParam } = Route.useParams()
  const navigate = useNavigate()

  const dayNumber = parseInt(dayParam || '0', 10)

  const [phase, setPhase] = useState<WorkoutPhase>(() => {
    if (loaderData.type === 'existing') {
      return { phase: 'active' }
    }
    if (loaderData.type === 'conflict') {
      return {
        phase: 'conflict',
        existingWorkoutId: loaderData.workoutId,
        existingDayNumber: loaderData.dayNumber,
      }
    }
    return { phase: 'loading' }
  })
  const [workout, setWorkout] = useState<Workout | null>(
    loaderData.type === 'existing' ? loaderData.workout : null,
  )
  const createRef = useRef(false)

  // Sync state from loader data when route params change (same component, different day)
  useEffect(() => {
    if (loaderData.type === 'existing') {
      setWorkout(loaderData.workout)
      setPhase({ phase: 'active' })
    } else if (loaderData.type === 'conflict') {
      setWorkout(null)
      setPhase({
        phase: 'conflict',
        existingWorkoutId: loaderData.workoutId,
        existingDayNumber: loaderData.dayNumber,
      })
    }
  }, [loaderData])

  // Create workout on mount when loader found no existing workout
  useEffect(() => {
    if (loaderData.type !== 'none') return
    if (createRef.current) return
    createRef.current = true

    let cancelled = false
    setPhase({ phase: 'loading' })

    startWorkout(dayNumber)
      .then((newWorkout) => {
        if (!cancelled) {
          setWorkout(newWorkout)
          setPhase({ phase: 'active' })
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (
          err &&
          typeof err === 'object' &&
          'error' in err &&
          err.error === 'EXISTING_WORKOUT' &&
          'workoutId' in err &&
          'dayNumber' in err
        ) {
          setPhase({
            phase: 'conflict',
            existingWorkoutId: err.workoutId as number,
            existingDayNumber: err.dayNumber as number,
          })
        } else {
          setPhase({
            phase: 'error',
            message:
              err instanceof Error ? err.message : 'Failed to start workout',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [loaderData.type, dayNumber])

  const handleContinueExisting = () => {
    if (phase.phase !== 'conflict') return
    const { existingDayNumber } = phase
    setPhase({ phase: 'loading' })
    navigate({
      to: '/workout/$dayNumber',
      params: { dayNumber: String(existingDayNumber) },
    })
  }

  const handleDiscardAndStartNew = async () => {
    if (phase.phase !== 'conflict') return
    const { existingWorkoutId } = phase

    setPhase({ phase: 'loading' })

    try {
      await cancelWorkout(existingWorkoutId)
      const remaining = await getCurrentWorkout()
      if (remaining) {
        await cancelWorkout(remaining.id)
      }
      const newWorkout = await startWorkout(dayNumber)
      setWorkout(newWorkout)
      setPhase({ phase: 'active' })
    } catch (err) {
      setPhase({
        phase: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to start new workout',
      })
    }
  }

  const handleCloseConflictDialog = () => {
    setPhase({ phase: 'loading' })
    navigate({ to: '/' })
  }

  if (phase.phase === 'conflict') {
    return (
      <ConflictDialog
        existingDayNumber={phase.existingDayNumber}
        onContinue={handleContinueExisting}
        onDiscard={handleDiscardAndStartNew}
        onClose={handleCloseConflictDialog}
      />
    )
  }

  if (phase.phase === 'loading') {
    return (
      <div className={styles.page}>
        <LoadingSpinner />
      </div>
    )
  }

  if (phase.phase === 'error') {
    return (
      <div className={styles.page}>
        <ErrorMessage message={phase.message} />
        <ButtonLink variant="secondary" to="/">
          Back to Dashboard
        </ButtonLink>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className={styles.page}>
        <ErrorMessage message="Failed to load workout" />
      </div>
    )
  }

  return (
    <ActiveWorkout
      workout={workout}
      dayNumber={dayNumber}
      onWorkoutChange={setWorkout}
    />
  )
}

function ActiveWorkout({
  workout,
  dayNumber,
  onWorkoutChange,
}: {
  workout: Workout
  dayNumber: number
  onWorkoutChange: (workout: Workout) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [phase, setPhase] = useState<ActivePhase>({ phase: 'active' })
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const debounceMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  )
  const restTimer = useRestTimer()
  const settingsRef = useRef(getRestTimerSettings())

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      debounceMap.current.forEach((timer) => clearTimeout(timer))
      debounceMap.current.clear()
    }
  }, [])

  const debouncedLogSet = (
    setId: number,
    data: { actualReps?: number | null; completed?: boolean },
  ) => {
    const existingTimer = debounceMap.current.get(setId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(async () => {
      try {
        await logSet(workout.id, setId, data)
        debounceMap.current.delete(setId)
      } catch (err) {
        console.error('Failed to update set:', err)
      }
    }, 300)

    debounceMap.current.set(setId, timer)
  }

  const triggerRestTimer = (setId: number) => {
    const settings = settingsRef.current
    if (!settings.enabled) return
    const setIndex = workout.sets.findIndex(s => s.id === setId)
    if (setIndex === workout.sets.length - 1) return
    restTimer.start(settings.durationSeconds)
  }

  const handleConfirmSet = (setId: number) => {
    const set = workout.sets.find((s) => s.id === setId)
    if (!set) return

    onWorkoutChange({
      ...workout,
      sets: workout.sets.map((s) =>
        s.id === setId
          ? { ...s, actualReps: s.prescribedReps, completed: true }
          : s,
      ),
    })

    debouncedLogSet(setId, {
      actualReps: set.prescribedReps,
      completed: true,
    })
    triggerRestTimer(setId)
  }

  const handleRepsChange = (setId: number, reps: number) => {
    const wasCompleted = workout.sets.find(s => s.id === setId)?.completed

    onWorkoutChange({
      ...workout,
      sets: workout.sets.map((s) =>
        s.id === setId ? { ...s, actualReps: reps, completed: true } : s,
      ),
    })

    debouncedLogSet(setId, { actualReps: reps, completed: true })

    if (!wasCompleted) {
      triggerRestTimer(setId)
    }
  }

  const handleCompleteWorkout = async () => {
    const progressionSets = workout.sets.filter((s) => s.isProgression)
    const missingReps = progressionSets.some((s) => s.actualReps === null)
    if (missingReps && progressionSets.length > 0) {
      setShowCompleteConfirm(true)
      return
    }

    await doCompleteWorkout()
  }

  const doCompleteWorkout = async () => {
    setShowCompleteConfirm(false)
    setPhase({ phase: 'completing' })

    try {
      const result = await completeWorkout(workout.id)
      const progressionArray =
        result.progressions || (result.progression ? [result.progression] : [])
      await queryClient.invalidateQueries({ queryKey: ['workout'] })
      await queryClient.invalidateQueries({ queryKey: ['workoutCalendar'] })
      await queryClient.invalidateQueries({ queryKey: ['training-maxes'] })
      setPhase({ phase: 'completed', progressions: progressionArray })
    } catch (err) {
      setPhase({
        phase: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to complete workout',
      })
    }
  }

  const handleCancelWorkout = () => {
    setShowCancelConfirm(true)
  }

  const doCancelWorkout = async () => {
    setShowCancelConfirm(false)
    setPhase({ phase: 'canceling' })

    try {
      await cancelWorkout(workout.id)
      await queryClient.invalidateQueries({ queryKey: ['workout'] })
      await queryClient.invalidateQueries({ queryKey: ['workoutCalendar'] })
      navigate({ to: '/' })
    } catch (err) {
      setPhase({
        phase: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to cancel workout',
      })
    }
  }

  return (
    <ActiveWorkoutView
      workout={workout}
      dayNumber={dayNumber}
      phase={phase}
      showCompleteConfirm={showCompleteConfirm}
      showCancelConfirm={showCancelConfirm}
      onConfirmSet={handleConfirmSet}
      onRepsChange={handleRepsChange}
      onCompleteWorkout={handleCompleteWorkout}
      onDoCompleteWorkout={doCompleteWorkout}
      onCancelWorkout={handleCancelWorkout}
      onDoCancelWorkout={doCancelWorkout}
      onDismissCompleteConfirm={() => setShowCompleteConfirm(false)}
      onDismissCancelConfirm={() => setShowCancelConfirm(false)}
      restTimer={restTimer.state.isRunning ? {
        secondsRemaining: restTimer.state.secondsRemaining,
        totalSeconds: restTimer.state.totalSeconds,
        onAdjust: restTimer.adjust,
        onSkip: restTimer.skip,
      } : null}
    />
  )
}
