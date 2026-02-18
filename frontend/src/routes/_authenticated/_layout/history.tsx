import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getWorkoutCalendar, getWorkout, type Workout } from '../../../api/workouts'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { HistoryContent } from '../../../components/HistoryContent'

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

  return (
    <HistoryContent
      calendarWorkouts={calendarWorkouts}
      calendarError={calendarError}
      isLoadingCalendar={isLoadingCalendar}
      isFetchingCalendar={isFetchingCalendar}
      selectedWorkout={selectedWorkout}
      isLoadingWorkout={isLoadingWorkout}
      currentYear={currentYear}
      currentMonth={currentMonth}
      onMonthChange={handleMonthChange}
      onSelectWorkout={handleSelectWorkout}
      onRetry={() => refetchCalendar()}
    />
  )
}
