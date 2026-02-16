import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getWorkoutCalendar, getWorkout, type CalendarWorkout, type Workout } from '../../../api/workouts'
import { getMe } from '../../../api/user'
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
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', 'me'],
    queryFn: getMe,
  })

  const [calendarWorkouts, setCalendarWorkouts] = useState<CalendarWorkout[]>([])
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    fetchCalendarData(currentYear, currentMonth)
  }, [])

  const fetchCalendarData = async (year: number, month: number) => {
    setIsLoadingCalendar(true)
    setCalendarError('')
    try {
      const response = await getWorkoutCalendar(year, month)
      setCalendarWorkouts(response.workouts)
    } catch (error) {
      console.error('Failed to fetch calendar data:', error)
      setCalendarError(error instanceof Error ? error.message : 'Failed to load calendar')
      setCalendarWorkouts([])
    } finally {
      setIsLoadingCalendar(false)
    }
  }

  const handleMonthChange = (year: number, month: number, direction: 'prev' | 'next') => {
    if (document.startViewTransition) {
      document.documentElement.dataset.transitionDirection = direction
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setCurrentYear(year)
          setCurrentMonth(month)
          setSelectedWorkout(null)
        })
      })
      transition.finished.then(() => {
        delete document.documentElement.dataset.transitionDirection
      })
    } else {
      setCurrentYear(year)
      setCurrentMonth(month)
      setSelectedWorkout(null)
    }

    fetchCalendarData(year, month)
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
          message={calendarError}
          onRetry={() => fetchCalendarData(currentYear, currentMonth)}
        />
      ) : (
        <>
          <WorkoutCalendar
            workouts={calendarWorkouts}
            onSelectWorkout={handleSelectWorkout}
            onMonthChange={handleMonthChange}
            year={currentYear}
            month={currentMonth}
            isLoading={isLoadingCalendar}
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
