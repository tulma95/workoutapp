import { useState, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getWorkoutCalendar, getWorkout, cancelWorkout, logSet, updateWorkoutNotes, type Workout, type CalendarWorkout } from '../../../api/workouts'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { HistoryContent } from '../../../components/HistoryContent'
import { CustomWorkoutModal } from '../../../components/CustomWorkoutModal'
import { useToast } from '../../../components/Toast'
import { queryKeys } from '../../../api/queryKeys'
import styles from '../../../styles/HistoryPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/history')({
  pendingComponent: LoadingSpinner,
  component: HistoryPage,
})

function HistoryPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(false)
  const [dayWorkouts, setDayWorkouts] = useState<CalendarWorkout[] | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [customWorkoutDate, setCustomWorkoutDate] = useState<string | null>(null)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const {
    data: calendarData,
    isLoading: isLoadingCalendar,
    isFetching: isFetchingCalendar,
    error: calendarError,
    refetch: refetchCalendar,
  } = useQuery({
    queryKey: queryKeys.workout.calendar(currentYear, currentMonth),
    queryFn: () => getWorkoutCalendar(currentYear, currentMonth),
    placeholderData: keepPreviousData,
  })

  const calendarWorkouts = calendarData?.workouts ?? []
  const scheduledDays = calendarData?.scheduledDays ?? []

  const handleMonthChange = (year: number, month: number, _direction: 'prev' | 'next') => {
    setCurrentYear(year)
    setCurrentMonth(month)
    setSelectedWorkout(null)
    setDayWorkouts(null)
    setSelectedDateKey(null)
  }

  const handleSelectDay = async (workouts: CalendarWorkout[]) => {
    setSelectedWorkout(null)
    if (workouts.length === 1) {
      await handleSelectWorkout(workouts[0]!.id)
    } else {
      setDayWorkouts(workouts)
    }
  }

  const handleDayClick = (dateKey: string, workouts: CalendarWorkout[]) => {
    setSelectedDateKey(dateKey)
    if (workouts.length > 0) {
      handleSelectDay(workouts)
    } else {
      setSelectedWorkout(null)
      setDayWorkouts(null)
    }
  }

  const handleSelectWorkout = async (workoutId: number) => {
    setIsLoadingWorkout(true)
    try {
      const workout = await getWorkout(workoutId)
      setSelectedWorkout(workout)
    } catch (error) {
      console.error('Failed to fetch workout details:', error)
      setSelectedWorkout(null)
    } finally {
      setIsLoadingWorkout(false)
    }
  }

  const handleEditSet = async (setId: number, actualReps: number) => {
    if (!selectedWorkout) return
    const workoutId = selectedWorkout.id
    // Optimistically reflect the correction in the open detail view.
    setSelectedWorkout((prev) =>
      prev
        ? { ...prev, sets: prev.sets.map((s) => (s.id === setId ? { ...s, actualReps } : s)) }
        : prev,
    )
    try {
      await logSet(workoutId, setId, { actualReps })
      // Recompute derived views (calendar badges, e1RM progress); TMs are
      // append-only and intentionally not recomputed.
      queryClient.invalidateQueries({ queryKey: queryKeys.workout.calendarAll() })
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.records() })
    } catch (error) {
      console.error('Failed to edit set:', error)
      toast.error('Could not save the change')
      // Revert the optimistic value to server truth.
      const fresh = await getWorkout(workoutId).catch(() => null)
      if (fresh) setSelectedWorkout(fresh)
    }
  }

  const handleSaveNotes = async (notes: string) => {
    if (!selectedWorkout) return
    const workoutId = selectedWorkout.id
    const trimmed = notes.trim()
    const next = trimmed.length > 0 ? trimmed : null
    setSelectedWorkout((prev) => (prev ? { ...prev, notes: next } : prev))
    try {
      await updateWorkoutNotes(workoutId, notes)
    } catch (error) {
      console.error('Failed to save notes:', error)
      toast.error('Could not save the note')
      const fresh = await getWorkout(workoutId).catch(() => null)
      if (fresh) setSelectedWorkout(fresh)
    }
  }

  const handleAddCustomWorkout = (dateKey: string) => {
    setCustomWorkoutDate(dateKey)
  }

  const handleCustomWorkoutSaved = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workout.calendarAll() })
    setSelectedDateKey(null)
  }

  const handleDeleteWorkout = () => {
    dialogRef.current?.showModal()
  }

  const handleConfirmDelete = async () => {
    if (!selectedWorkout) return
    try {
      await cancelWorkout(selectedWorkout.id)
      queryClient.invalidateQueries({ queryKey: queryKeys.workout.calendarAll() })
      // Deleting a completed workout changes the dashboard streak / weekly count / last-workout peek.
      queryClient.invalidateQueries({ queryKey: queryKeys.workout.stats() })
      queryClient.invalidateQueries({ queryKey: queryKeys.workout.latest() })
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.records() })
      setSelectedWorkout(null)
      setDayWorkouts(null)
      setSelectedDateKey(null)
      dialogRef.current?.close()
    } catch (error) {
      console.error('Failed to delete workout:', error)
      dialogRef.current?.close()
    }
  }

  return (
    <>
      <HistoryContent
        calendarWorkouts={calendarWorkouts}
        scheduledDays={scheduledDays}
        calendarError={calendarError}
        isLoadingCalendar={isLoadingCalendar}
        isFetchingCalendar={isFetchingCalendar}
        selectedWorkout={selectedWorkout}
        isLoadingWorkout={isLoadingWorkout}
        dayWorkouts={dayWorkouts}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        onDayClick={handleDayClick}
        onSelectWorkout={handleSelectWorkout}
        onDeleteWorkout={handleDeleteWorkout}
        onEditSet={handleEditSet}
        onSaveNotes={handleSaveNotes}
        onRetry={() => refetchCalendar()}
        onAddCustomWorkout={handleAddCustomWorkout}
        selectedDateKey={selectedDateKey ?? undefined}
      />

      <CustomWorkoutModal
        open={customWorkoutDate !== null}
        initialDate={customWorkoutDate ?? ''}
        onClose={() => setCustomWorkoutDate(null)}
        onSaved={handleCustomWorkoutSaved}
      />

      <dialog ref={dialogRef} className={styles.dialog}>
        <div className={styles.dialog__content}>
          <p>Delete this workout from history?</p>
          <p className={styles.dialog__note}>Training max changes will not be affected.</p>
          <div className={styles.dialog__actions}>
            <button className={styles.dialog__cancel} onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button className={styles.dialog__confirm} onClick={handleConfirmDelete}>Delete</button>
          </div>
        </div>
      </dialog>
    </>
  )
}
