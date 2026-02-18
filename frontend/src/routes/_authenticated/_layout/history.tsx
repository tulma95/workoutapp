import { useState, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getWorkoutCalendar, getWorkout, cancelWorkout, type Workout, type CalendarWorkout } from '../../../api/workouts'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { HistoryContent } from '../../../components/HistoryContent'
import styles from '../../../styles/HistoryPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/history')({
  pendingComponent: LoadingSpinner,
  component: HistoryPage,
})

function HistoryPage() {
  const queryClient = useQueryClient()
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(false)
  const [dayWorkouts, setDayWorkouts] = useState<CalendarWorkout[] | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const {
    data: calendarWorkouts = [],
    isLoading: isLoadingCalendar,
    isFetching: isFetchingCalendar,
    error: calendarError,
    refetch: refetchCalendar,
  } = useQuery({
    queryKey: ['workoutCalendar', currentYear, currentMonth],
    queryFn: async () => {
      const response = await getWorkoutCalendar(currentYear, currentMonth)
      return response.workouts
    },
    placeholderData: keepPreviousData,
  })

  const handleMonthChange = (year: number, month: number, _direction: 'prev' | 'next') => {
    setCurrentYear(year)
    setCurrentMonth(month)
    setSelectedWorkout(null)
    setDayWorkouts(null)
  }

  const handleSelectDay = async (workouts: CalendarWorkout[]) => {
    setSelectedWorkout(null)
    if (workouts.length === 1) {
      await handleSelectWorkout(workouts[0]!.id)
    } else {
      setDayWorkouts(workouts)
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

  const handleDeleteWorkout = () => {
    dialogRef.current?.showModal()
  }

  const handleConfirmDelete = async () => {
    if (!selectedWorkout) return
    try {
      await cancelWorkout(selectedWorkout.id)
      queryClient.invalidateQueries({ queryKey: ['workoutCalendar'] })
      setSelectedWorkout(null)
      setDayWorkouts(null)
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
        calendarError={calendarError}
        isLoadingCalendar={isLoadingCalendar}
        isFetchingCalendar={isFetchingCalendar}
        selectedWorkout={selectedWorkout}
        isLoadingWorkout={isLoadingWorkout}
        dayWorkouts={dayWorkouts}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        onSelectDay={handleSelectDay}
        onSelectWorkout={handleSelectWorkout}
        onDeleteWorkout={handleDeleteWorkout}
        onRetry={() => refetchCalendar()}
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
