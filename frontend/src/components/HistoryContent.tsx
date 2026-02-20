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
  onDayClick: (dateKey: string, workouts: CalendarWorkout[]) => void
  onSelectWorkout: (workoutId: number) => void
  onDeleteWorkout?: () => void
  onRetry: () => void
  onAddCustomWorkout?: (dateKey: string) => void
  selectedDateKey?: string
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
  onDayClick,
  onSelectWorkout,
  onDeleteWorkout,
  onRetry,
  onAddCustomWorkout,
  selectedDateKey,
}: Props) {
  const hasAnyWorkouts = calendarWorkouts.length > 0
  const showPicker = dayWorkouts && dayWorkouts.length > 1 && !selectedWorkout && !isLoadingWorkout

  const showAddCustomWorkoutButton = (() => {
    if (!selectedDateKey || !onAddCustomWorkout) return false

    const selDate = new Date(selectedDateKey + 'T00:00:00')
    const selYear = selDate.getFullYear()
    const selMonth = selDate.getMonth() + 1 // 1-indexed

    if (selYear !== currentYear || selMonth !== currentMonth) return false

    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if (selectedDateKey > todayKey) return false

    const hasWorkouts = calendarWorkouts.some(w => {
      const dateStr = w.completedAt || w.createdAt
      const date = new Date(dateStr)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return key === selectedDateKey
    })

    return !hasWorkouts
  })()

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
            onDayClick={onDayClick}
            onMonthChange={onMonthChange}
            year={currentYear}
            month={currentMonth}
            isLoading={!isLoadingCalendar && isFetchingCalendar}
            selectedDateKey={selectedDateKey}
          />

          {showAddCustomWorkoutButton && (
            <button
              className={styles.addCustomWorkoutButton}
              onClick={() => onAddCustomWorkout!(selectedDateKey!)}
            >
              Add Custom Workout — {new Date(selectedDateKey! + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </button>
          )}

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
                    {w.dayNumber === 0 ? 'Custom' : `Day ${w.dayNumber}`}
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
