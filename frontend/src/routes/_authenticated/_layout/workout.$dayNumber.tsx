import { useState, useEffect, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCurrentWorkout,
  startWorkout,
  logSet,
  completeWorkout,
  cancelWorkout,
  type Workout,
  type ProgressionResult,
} from '../../../api/workouts'
import { getMe } from '../../../api/user'
import SetRow from '../../../components/SetRow'
import { ProgressionBanner } from '../../../components/ProgressionBanner'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { ErrorMessage } from '../../../components/ErrorMessage'
import { ConflictDialog } from '../../../components/ConflictDialog'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import '../../../styles/WorkoutPage.css'

export const Route = createFileRoute('/_authenticated/_layout/workout/$dayNumber')({
  pendingComponent: () => (
    <div className="workout-page">
      <LoadingSpinner />
    </div>
  ),
  component: WorkoutPage,
})

function WorkoutPage() {
  const { dayNumber: dayParam } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', 'me'],
    queryFn: getMe,
  })

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progressions, setProgressions] = useState<ProgressionResult[]>([])
  const [isCompleting, setIsCompleting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [conflictWorkout, setConflictWorkout] = useState<{
    workoutId: number
    dayNumber: number
  } | null>(null)

  const dayNumber = parseInt(dayParam || '0', 10)

  const loadingRef = useRef(false)
  const debounceMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    if (loadingRef.current) return
    loadingRef.current = true

    async function loadWorkout() {
      if (!dayNumber) {
        setError('Invalid day number')
        setIsLoading(false)
        loadingRef.current = false
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const currentWorkout = await getCurrentWorkout()

        if (currentWorkout) {
          if (currentWorkout.dayNumber === dayNumber) {
            setWorkout(currentWorkout)
          } else {
            setConflictWorkout({
              workoutId: currentWorkout.id,
              dayNumber: currentWorkout.dayNumber,
            })
            setIsLoading(false)
            loadingRef.current = false
            return
          }
        } else {
          try {
            const newWorkout = await startWorkout(dayNumber)
            setWorkout(newWorkout)
          } catch (startErr: unknown) {
            if (
              startErr &&
              typeof startErr === 'object' &&
              'error' in startErr &&
              startErr.error === 'EXISTING_WORKOUT' &&
              'workoutId' in startErr &&
              'dayNumber' in startErr
            ) {
              setConflictWorkout({
                workoutId: startErr.workoutId as number,
                dayNumber: startErr.dayNumber as number,
              })
              setIsLoading(false)
              loadingRef.current = false
              return
            }
            throw startErr
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load workout'
        setError(message)
      } finally {
        setIsLoading(false)
        loadingRef.current = false
      }
    }

    loadWorkout()
  }, [dayNumber])

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      debounceMap.current.forEach((timer) => clearTimeout(timer))
      debounceMap.current.clear()
    }
  }, [])

  const debouncedLogSet = (
    setId: number,
    data: { actualReps?: number | null; completed?: boolean }
  ) => {
    if (!workout) return

    // Clear existing timer for this set
    const existingTimer = debounceMap.current.get(setId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
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

  const handleConfirmSet = (setId: number) => {
    if (!workout) return

    const set = workout.sets.find((s) => s.id === setId)
    if (!set) return

    setWorkout({
      ...workout,
      sets: workout.sets.map((s) =>
        s.id === setId
          ? { ...s, actualReps: s.prescribedReps, completed: true }
          : s
      ),
    })

    debouncedLogSet(setId, {
      actualReps: set.prescribedReps,
      completed: true,
    })
  }

  const handleRepsChange = (setId: number, reps: number) => {
    if (!workout) return

    setWorkout({
      ...workout,
      sets: workout.sets.map((s) =>
        s.id === setId ? { ...s, actualReps: reps, completed: true } : s
      ),
    })

    debouncedLogSet(setId, { actualReps: reps, completed: true })
  }

  const handleUndoSet = (setId: number) => {
    if (!workout) return

    setWorkout({
      ...workout,
      sets: workout.sets.map((s) =>
        s.id === setId ? { ...s, actualReps: null, completed: false } : s
      ),
    })

    debouncedLogSet(setId, { actualReps: null, completed: false })
  }

  const handleCompleteWorkout = async () => {
    if (!workout) return

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
    setIsCompleting(true)

    try {
      const result = await completeWorkout(workout!.id)
      const progressionArray =
        result.progressions || (result.progression ? [result.progression] : [])
      setProgressions(progressionArray)
      setIsCompleted(true)
      await queryClient.invalidateQueries({ queryKey: ['workout'] })
      await queryClient.invalidateQueries({ queryKey: ['training-maxes'] })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to complete workout',
      )
    } finally {
      setIsCompleting(false)
    }
  }

  const handleBackToDashboard = () => {
    navigate({ to: '/' })
  }

  const handleCancelWorkout = () => {
    if (!workout) return
    setShowCancelConfirm(true)
  }

  const doCancelWorkout = async () => {
    setShowCancelConfirm(false)
    setIsCanceling(true)

    try {
      await cancelWorkout(workout!.id)
      await queryClient.invalidateQueries({ queryKey: ['workout'] })
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel workout')
      setIsCanceling(false)
    }
  }

  const handleContinueExisting = () => {
    if (!conflictWorkout) return
    setConflictWorkout(null)
    navigate({ to: '/workout/$dayNumber', params: { dayNumber: String(conflictWorkout.dayNumber) } })
  }

  const handleDiscardAndStartNew = async () => {
    if (!conflictWorkout) return

    try {
      await cancelWorkout(conflictWorkout.workoutId)
      setConflictWorkout(null)
      setIsLoading(true)
      setError(null)
      const remaining = await getCurrentWorkout()
      if (remaining) {
        await cancelWorkout(remaining.id)
      }
      const newWorkout = await startWorkout(dayNumber)
      setWorkout(newWorkout)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start new workout')
      setConflictWorkout(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseConflictDialog = () => {
    setConflictWorkout(null)
    navigate({ to: '/' })
  }

  if (conflictWorkout) {
    return (
      <ConflictDialog
        existingDayNumber={conflictWorkout.dayNumber}
        onContinue={handleContinueExisting}
        onDiscard={handleDiscardAndStartNew}
        onClose={handleCloseConflictDialog}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="workout-page">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="workout-page">
        <ErrorMessage message={error} />
        <button onClick={handleBackToDashboard} className="btn-secondary">
          Back to Dashboard
        </button>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="workout-page">
        <ErrorMessage message="Failed to load workout" />
      </div>
    )
  }

  const unit = user?.unitPreference || 'kg'

  const exerciseGroups: Array<{ exercise: string; sets: typeof workout.sets }> = []
  for (const set of workout.sets) {
    const last = exerciseGroups[exerciseGroups.length - 1]
    if (last && last.exercise === set.exercise) {
      last.sets.push(set)
    } else {
      exerciseGroups.push({ exercise: set.exercise, sets: [set] })
    }
  }

  const dayTitle = `Day ${dayNumber}`

  if (isCompleted) {
    return (
      <div className="workout-page">
        <h1>Workout Complete!</h1>
        <ProgressionBanner progressions={progressions} unit={unit} />
        <button onClick={handleBackToDashboard} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="workout-page">
      <h1 style={{ viewTransitionName: `workout-day-${dayNumber}` }}>{dayTitle}</h1>

      {exerciseGroups.map((group) => (
        <section key={group.exercise} className="workout-section">
          <h2 className="workout-section__title">{group.exercise}</h2>
          <div className="workout-section__sets">
            {group.sets.map((set, index) => (
              <SetRow
                key={set.id}
                setNumber={index + 1}
                weight={set.prescribedWeight}
                reps={set.prescribedReps}
                isAmrap={set.isAmrap}
                completed={set.completed}
                actualReps={set.actualReps}
                unit={unit}
                onConfirm={() => handleConfirmSet(set.id)}
                onRepsChange={(reps) => handleRepsChange(set.id, reps)}
                onUndo={() => handleUndoSet(set.id)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="workout-actions">
        <button
          onClick={handleCompleteWorkout}
          disabled={isCompleting || isCanceling}
          className="btn-primary btn-large"
        >
          {isCompleting ? 'Completing...' : 'Complete Workout'}
        </button>
        <button
          onClick={handleCancelWorkout}
          disabled={isCanceling || isCompleting}
          className="btn-secondary btn-large"
        >
          {isCanceling ? 'Canceling...' : 'Cancel Workout'}
        </button>
      </div>

      <ConfirmDialog
        open={showCompleteConfirm}
        title="Missing Progression Reps"
        message="You haven't entered reps for all progression sets. Complete workout without full progression tracking?"
        confirmLabel="Complete Anyway"
        variant="danger"
        onConfirm={doCompleteWorkout}
        onCancel={() => setShowCompleteConfirm(false)}
      />

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Workout"
        message="Cancel this workout? All progress will be lost."
        confirmLabel="Cancel Workout"
        variant="danger"
        onConfirm={doCancelWorkout}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  )
}
