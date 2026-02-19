import { useQuery } from '@tanstack/react-query';
import { getLeaderboard } from '../api/social';
import type { LeaderboardExercise } from '../api/social';
import { formatWeight } from '../utils/weight';
import { SkeletonLine, SkeletonCard } from './Skeleton';
import styles from './LeaderboardTab.module.css';

function ExerciseRankings({ exercise }: { exercise: LeaderboardExercise }) {
  return (
    <section className={styles.exerciseSection} aria-labelledby={`lb-${exercise.slug}`}>
      <h3 id={`lb-${exercise.slug}`} className={styles.exerciseName}>
        {exercise.name}
      </h3>
      <ol className={styles.rankingList} aria-label={`${exercise.name} leaderboard`}>
        {exercise.rankings.map((ranking, index) => (
          <li key={ranking.userId} className={styles.rankingRow}>
            <span className={styles.rank} aria-label={`Rank ${index + 1}`}>
              {index + 1}
            </span>
            <span className={styles.displayName}>{ranking.displayName}</span>
            <span className={styles.weight}>{formatWeight(ranking.weight)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LeaderboardTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['social', 'leaderboard'],
    queryFn: getLeaderboard,
  });

  if (isLoading) {
    return (
      <div className={styles.container} aria-busy="true" aria-label="Leaderboard loading">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={styles.skeletonSection}>
            <SkeletonLine width="40%" height="1.25rem" />
            <SkeletonCard className={styles.skeletonCard}>
              <SkeletonLine width="80%" height="1rem" />
              <SkeletonLine width="70%" height="1rem" />
              <SkeletonLine width="60%" height="1rem" />
            </SkeletonCard>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorState} role="alert">
        <p className={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load leaderboard'}
        </p>
        <button className={styles.retryButton} onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const exercises = data?.exercises ?? [];

  if (exercises.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Subscribe to a plan to see leaderboard</p>
      </div>
    );
  }

  return (
    <div className={styles.container} aria-label="Leaderboard" aria-live="polite">
      {exercises.map((exercise) => (
        <ExerciseRankings key={exercise.slug} exercise={exercise} />
      ))}
    </div>
  );
}
