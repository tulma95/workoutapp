import { useMemo } from 'react';
import { CalendarWorkout, ScheduledDay } from '../api/workouts';
import styles from './WorkoutCalendar.module.css';

interface WorkoutCalendarProps {
  workouts: CalendarWorkout[];
  scheduledDays?: ScheduledDay[];
  onSelectDay: (workouts: CalendarWorkout[]) => void;
  onMonthChange: (year: number, month: number, direction: 'prev' | 'next') => void;
  year: number;
  month: number; // 1-indexed (1 = January, 12 = December)
  isLoading?: boolean;
  onAddCustomWorkout?: (dateKey: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function WorkoutCalendar({
  workouts,
  scheduledDays,
  onSelectDay,
  onMonthChange,
  year,
  month,
  isLoading = false,
  onAddCustomWorkout,
}: WorkoutCalendarProps) {
  const currentYear = year;
  const currentMonth = month - 1; // Convert to 0-indexed for Date constructor

  // Build a map from date string (YYYY-MM-DD) to workouts array
  const workoutMap = useMemo(() => {
    const map = new Map<string, CalendarWorkout[]>();
    workouts.forEach((workout) => {
      const dateStr = workout.completedAt || workout.createdAt;
      const date = new Date(dateStr);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const existing = map.get(key) || [];
      existing.push(workout);
      map.set(key, existing);
    });
    return map;
  }, [workouts]);

  // Build a map from date string (YYYY-MM-DD) to scheduled days array
  const scheduledDayMap = useMemo(() => {
    const map = new Map<string, ScheduledDay[]>();
    (scheduledDays || []).forEach((sd) => {
      const existing = map.get(sd.date) || [];
      existing.push(sd);
      map.set(sd.date, existing);
    });
    return map;
  }, [scheduledDays]);

  // Calculate calendar grid
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Get day of week for first day (0 = Sunday, 1 = Monday, ...)
    let firstWeekday = firstDayOfMonth.getDay();
    // Convert to Monday-based indexing (0 = Monday, 6 = Sunday)
    firstWeekday = firstWeekday === 0 ? 6 : firstWeekday - 1;

    const daysInMonth = lastDayOfMonth.getDate();
    const days: Array<{
      date: number;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      workouts: CalendarWorkout[];
      scheduled: ScheduledDay[];
    }> = [];

    // Add previous month's trailing days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: day,
        dateKey,
        isCurrentMonth: false,
        isToday: false,
        workouts: workoutMap.get(dateKey) || [],
        scheduled: scheduledDayMap.get(dateKey) || [],
      });
    }

    // Add current month's days
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateKey === todayKey;
      days.push({
        date: day,
        dateKey,
        isCurrentMonth: true,
        isToday,
        workouts: workoutMap.get(dateKey) || [],
        scheduled: scheduledDayMap.get(dateKey) || [],
      });
    }

    // Add next month's leading days to fill the grid
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      for (let day = 1; day <= remainingCells; day++) {
        const dateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({
          date: day,
          dateKey,
          isCurrentMonth: false,
          isToday: false,
          workouts: workoutMap.get(dateKey) || [],
          scheduled: scheduledDayMap.get(dateKey) || [],
        });
      }
    }

    return days;
  }, [currentYear, currentMonth, workoutMap, scheduledDayMap]);

  const handlePrevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    onMonthChange(newDate.getFullYear(), newDate.getMonth() + 1, 'prev');
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1);
    onMonthChange(newDate.getFullYear(), newDate.getMonth() + 1, 'next');
  };

  const handleDayClick = (day: typeof calendarDays[0]) => {
    if (day.workouts.length > 0) {
      onSelectDay(day.workouts);
    } else if (onAddCustomWorkout && day.isCurrentMonth) {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (day.dateKey <= todayKey) {
        onAddCustomWorkout(day.dateKey);
      }
    }
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button
          className={styles.navButton}
          onClick={handlePrevMonth}
          aria-label="Previous month"
        >
          ←
        </button>
        <h2 className={styles.title} data-testid="calendar-title">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h2>
        <button
          className={styles.navButton}
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className={isLoading ? styles.loadingBar : styles.loadingBarHidden} />

      <div className={styles.weekdays}>
        {WEEKDAYS.map((day) => (
          <div key={day} className={styles.weekday}>
            {day}
          </div>
        ))}
      </div>

      <div
        className={styles.grid}
        data-testid="calendar-grid"
      >
        {calendarDays.map((day, index) => {
          const isScheduledOnly = day.isCurrentMonth && day.workouts.length === 0 && day.scheduled.length > 0;
          return (
            <button
              key={index}
              className={`${styles.day} ${
                !day.isCurrentMonth ? styles.outside : ''
              } ${day.isToday ? styles.today : ''} ${
                day.workouts.length > 0 ? styles.workout : ''
              } ${isScheduledOnly ? styles.scheduled : ''}`}
              onClick={() => handleDayClick(day)}
              disabled={(() => {
                if (day.workouts.length > 0) return false;
                if (onAddCustomWorkout && day.isCurrentMonth) {
                  const today = new Date();
                  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                  if (day.dateKey <= todayKey) return false;
                }
                return true;
              })()}
              data-testid={isScheduledOnly ? 'calendar-scheduled-day' : undefined}
            >
              <span className={styles.dayNumber}>{day.date}</span>
              {day.workouts.length > 0 && (
                <span className={styles.dayBadge}>
                  {day.workouts.length > 1 ? day.workouts.length : day.workouts[0]!.dayNumber}
                </span>
              )}
              {isScheduledOnly && (
                <span className={styles.scheduledBadge}>
                  {day.scheduled[0]!.dayNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
