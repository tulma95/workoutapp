import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { getWorkoutStats } from '../api/workouts'
import styles from './DashboardStats.module.css'

export function DashboardStats() {
  const { data } = useQuery({
    queryKey: queryKeys.workout.stats(),
    queryFn: getWorkoutStats,
  })

  // Nothing trained recently — keep the dashboard uncluttered for new/idle users.
  if (!data || data.workoutsLast7Days === 0) return null

  return (
    <div className={styles.stats} data-testid="dashboard-stats">
      <div className={styles.stat}>
        <span className={styles.value}>{data.workoutsLast7Days}</span>
        <span className={styles.label}>this week</span>
      </div>
      {data.currentStreak >= 2 && (
        <div className={styles.stat}>
          <span className={styles.value}>🔥 {data.currentStreak}</span>
          <span className={styles.label}>day streak</span>
        </div>
      )}
    </div>
  )
}
