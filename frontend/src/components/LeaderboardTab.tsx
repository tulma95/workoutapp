import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, getE1rmLeaderboard } from '../api/social';
import type { LeaderboardExercise } from '../api/social';
import { queryKeys } from '../api/queryKeys';
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
            <span className={styles.displayName}>{ranking.username}</span>
            <span className={styles.weight}>{formatWeight(ranking.weight)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LeaderboardTab() {
  const [mode, setMode] = useState<'tm' | 'e1rm'>('tm');

  const tmQuery = useQuery({
    queryKey: queryKeys.social.leaderboard(),
    queryFn: getLeaderboard,
  });

  const e1rmQuery = useQuery({
    queryKey: queryKeys.social.leaderboardE1rm(),
    queryFn: getE1rmLeaderboard,
    staleTime: 60_000,
    enabled: mode === 'e1rm',
  });

  const activeQuery = mode === 'tm' ? tmQuery : e1rmQuery;
  const { data, isLoading, isError, error, refetch } = activeQuery;

  const modeToggle = (
    <div className={styles.modeToggle} role="group" aria-label="Leaderboard mode">
      <button
        className={mode === 'tm' ? `${styles.modeBtn} ${styles.modeBtnActive}` : styles.modeBtn}
        aria-pressed={mode === 'tm'}
        onClick={() => setMode('tm')}
      >
        Training Max
      </button>
      <button
        className={mode === 'e1rm' ? `${styles.modeBtn} ${styles.modeBtnActive}` : styles.modeBtn}
        aria-pressed={mode === 'e1rm'}
        onClick={() => setMode('e1rm')}
      >
        Est. 1RM
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className={styles.container} aria-busy="true" aria-label="Leaderboard loading">
        {modeToggle}
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
      <div className={styles.container}>
        {modeToggle}
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>
            {error instanceof Error ? error.message : 'Failed to load leaderboard'}
          </p>
          <button className={styles.retryButton} onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const exercises = data?.exercises ?? [];

  if (exercises.length === 0) {
    return (
      <div className={styles.container}>
        {modeToggle}
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            {mode === 'e1rm'
              ? 'Complete AMRAP sets to appear on the e1RM leaderboard'
              : 'Subscribe to a plan to see leaderboard'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} aria-label="Leaderboard" aria-live="polite">
      {modeToggle}
      {exercises.map((exercise) => (
        <ExerciseRankings key={exercise.slug} exercise={exercise} />
      ))}
    </div>
  );
}
