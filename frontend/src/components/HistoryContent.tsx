import WorkoutCalendar from './WorkoutCalendar'
import { WorkoutDetail } from './WorkoutDetail'
import { ErrorMessage } from './ErrorMessage'
import styles from '../styles/HistoryPage.module.css'
import type { CalendarWorkout, Workout, ScheduledDay } from '../api/workouts'

type Props = {
  calendarWorkouts: CalendarWorkout[]
  scheduledDays?: ScheduledDay[]
  calendarError: Error | null
  isLoadingCalendar: boolean
  isFetchingCalendar: boolean
  selectedWorkout: Workout | null
  isLoadingWorkout: boolean
  dayWorkouts: CalendarWorkout[] | null
  currentYear: number
  currentMonth: number
  onMonthChange: (year: number, month: number, direction: 'prev' | 'next') => void
  onSelectDay: (workouts: CalendarWorkout[]) => void
  onSelectWorkout: (workoutId: number) => void
  onDeleteWorkout?: () => void
  onRetry: () => void
}

export function HistoryContent({
  calendarWorkouts,
  scheduledDays,
  calendarError,
  isLoadingCalendar,
  isFetchingCalendar,
  selectedWorkout,
  isLoadingWorkout,
  dayWorkouts,
  currentYear,
  currentMonth,
  onMonthChange,
  onSelectDay,
  onSelectWorkout,
  onDeleteWorkout,
  onRetry,
}: Props) {
  const hasAnyWorkouts = calendarWorkouts.length > 0
  const showPicker = dayWorkouts && dayWorkouts.length > 1 && !selectedWorkout && !isLoadingWorkout

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
            scheduledDays={scheduledDays}
            onSelectDay={onSelectDay}
            onMonthChange={onMonthChange}
            year={currentYear}
            month={currentMonth}
            isLoading={!isLoadingCalendar && isFetchingCalendar}
          />

          <div className={styles.detail}>
            {showPicker ? (
              <div className={styles.picker}>
                <p className={styles.pickerTitle}>Multiple workouts on this day</p>
                {dayWorkouts.map(w => (
                  <button
                    key={w.id}
                    className={styles.pickerItem}
                    onClick={() => onSelectWorkout(w.id)}
                  >
                    Day {w.dayNumber}
                  </button>
                ))}
              </div>
            ) : isLoadingWorkout ? (
              <WorkoutDetail
                isLoading={true}
              />
            ) : selectedWorkout ? (
              <WorkoutDetail
                workout={selectedWorkout}
                onDelete={onDeleteWorkout}
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
