import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getWorkoutCalendar, getWorkout, type Workout } from '../../../api/workouts'
import WorkoutCalendar from '../../../components/WorkoutCalendar'
import { WorkoutDetail } from '../../../components/WorkoutDetail'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { ErrorMessage } from '../../../components/ErrorMessage'
import styles from '../../../styles/HistoryPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/history')({
  pendingComponent: LoadingSpinner,
  component: HistoryPage,
})

function HistoryPage() {
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(false)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

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

  const hasAnyWorkouts = calendarWorkouts.length > 0

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>History</h1>

      {calendarError ? (
        <ErrorMessage
          message={calendarError instanceof Error ? calendarError.message : 'Failed to load calendar'}
          onRetry={() => refetchCalendar()}
        />
      ) : (
        <>
          <WorkoutCalendar
            workouts={calendarWorkouts}
            onSelectWorkout={handleSelectWorkout}
            onMonthChange={handleMonthChange}
            year={currentYear}
            month={currentMonth}
            isLoading={!isLoadingCalendar && isFetchingCalendar}
          />

          <div className={styles.detail}>
            {isLoadingWorkout ? (
              <WorkoutDetail
                progression={null}
                isLoading={true}
              />
            ) : selectedWorkout ? (
              <WorkoutDetail
                workout={selectedWorkout}
                progression={null}
              />
            ) : hasAnyWorkouts ? (
              <div className={styles.prompt}>
                Tap a workout day to see details
              </div>
            ) : (
              <div className={styles.empty}>
                No workouts yet. Complete your first workout to see it here!
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
