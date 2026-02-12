import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getWorkoutCalendar, getWorkout, CalendarWorkout, Workout } from '../api/workouts';
import WorkoutCalendar from '../components/WorkoutCalendar';
import { WorkoutDetail } from '../components/WorkoutDetail';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import './HistoryPage.css';

export default function HistoryPage() {
  const { user } = useAuth();
  const [calendarWorkouts, setCalendarWorkouts] = useState<CalendarWorkout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

  // Fetch calendar data for the current month on mount
  useEffect(() => {
    fetchCalendarData(currentYear, currentMonth);
  }, []);

  const fetchCalendarData = async (year: number, month: number) => {
    setIsLoadingCalendar(true);
    setCalendarError('');
    try {
      const response = await getWorkoutCalendar(year, month);
      setCalendarWorkouts(response.workouts);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
      setCalendarError(error instanceof Error ? error.message : 'Failed to load calendar');
      setCalendarWorkouts([]);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
    fetchCalendarData(year, month);
    // Clear selected workout when changing months
    setSelectedWorkout(null);
  };

  const handleSelectWorkout = async (workoutId: number) => {
    setIsLoadingWorkout(true);
    try {
      const workout = await getWorkout(workoutId);
      setSelectedWorkout(workout);
    } catch (error) {
      console.error('Failed to fetch workout details:', error);
      setSelectedWorkout(null);
    } finally {
      setIsLoadingWorkout(false);
    }
  };

  const hasAnyWorkouts = calendarWorkouts.length > 0;

  return (
    <div className="history-page">
      <h1 className="history-page__title">History</h1>

      {isLoadingCalendar ? (
        <LoadingSpinner />
      ) : calendarError ? (
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
          />

          <div className="history-page__detail">
            {isLoadingWorkout ? (
              <WorkoutDetail
                progression={null}
                unit={user?.unitPreference || 'kg'}
                isLoading={true}
              />
            ) : selectedWorkout ? (
              <WorkoutDetail
                workout={selectedWorkout}
                progression={null}
                unit={user?.unitPreference || 'kg'}
              />
            ) : hasAnyWorkouts ? (
              <div className="history-page__prompt">
                Tap a workout day to see details
              </div>
            ) : (
              <div className="history-page__empty">
                No workouts yet. Complete your first workout to see it here!
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
