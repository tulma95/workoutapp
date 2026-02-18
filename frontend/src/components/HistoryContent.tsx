import WorkoutCalendar from './WorkoutCalendar'
import { WorkoutDetail } from './WorkoutDetail'
import { ErrorMessage } from './ErrorMessage'
import styles from '../styles/HistoryPage.module.css'
import type { CalendarWorkout, Workout } from '../api/workouts'

type Props = {
  calendarWorkouts: CalendarWorkout[]
  calendarError: Error | null
  isLoadingCalendar: boolean
  isFetchingCalendar: boolean
  selectedWorkout: Workout | null
  isLoadingWorkout: boolean
  currentYear: number
  currentMonth: number
  onMonthChange: (year: number, month: number, direction: 'prev' | 'next') => void
  onSelectWorkout: (workoutId: number) => void
  onRetry: () => void
}

export function HistoryContent({
  calendarWorkouts,
  calendarError,
  isLoadingCalendar,
  isFetchingCalendar,
  selectedWorkout,
  isLoadingWorkout,
  currentYear,
  currentMonth,
  onMonthChange,
  onSelectWorkout,
  onRetry,
}: Props) {
  const hasAnyWorkouts = calendarWorkouts.length > 0

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>History</h1>

      {calendarError ? (
        <ErrorMessage
          message={calendarError instanceof Error ? calendarError.message : 'Failed to load calendar'}
          onRetry={onRetry}
        />
      ) : (
        <>
          <WorkoutCalendar
            workouts={calendarWorkouts}
            onSelectWorkout={onSelectWorkout}
            onMonthChange={onMonthChange}
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
