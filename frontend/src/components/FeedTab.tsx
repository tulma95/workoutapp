import { useQuery } from '@tanstack/react-query';
import { getFeed } from '../api/social';
import type { FeedEvent } from '../api/social';
import { FeedEventPayloadSchema } from '../api/schemas';
import { formatWeight } from '../utils/weight';
import { SkeletonLine, SkeletonCard } from './Skeleton';
import styles from './FeedTab.module.css';

function renderEventText(event: FeedEvent): string | null {
  const parsed = FeedEventPayloadSchema.safeParse({
    eventType: event.eventType,
    ...event.payload,
  });
  if (!parsed.success) return null;
  const payload = parsed.data;

  if (payload.eventType === 'workout_completed') {
    return `${event.displayName} completed Day ${payload.dayNumber}`;
  }
  if (payload.eventType === 'tm_increased') {
    return `${event.displayName} hit a new ${payload.exerciseName} TM: ${formatWeight(payload.newTM)} (+${formatWeight(payload.increase)})`;
  }
  return null;
}

function formatRelativeTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function FeedTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['social', 'feed'],
    queryFn: getFeed,
    refetchOnMount: 'always',
  });

  if (isLoading) {
    return (
      <ul className={styles.list} aria-label="Activity feed" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <SkeletonCard className={styles.skeletonCard}>
              <SkeletonLine width="60%" height="1rem" />
              <SkeletonLine width="40%" height="0.75rem" />
            </SkeletonCard>
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorState} role="alert">
        <p className={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load activity feed'}
        </p>
        <button className={styles.retryButton} onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const events = data?.events ?? [];

  if (events.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>No activity yet — add some gym buddies!</p>
      </div>
    );
  }

  return (
    <ul className={styles.list} aria-label="Activity feed" aria-live="polite">
      {events.map((event) => {
        const text = renderEventText(event);
        if (text === null) return null;
        return (
          <li key={event.id} className={styles.eventItem}>
            <p className={styles.eventText}>{text}</p>
            <time
              className={styles.eventTime}
              dateTime={event.createdAt}
              title={new Date(event.createdAt).toLocaleString()}
            >
              {formatRelativeTime(event.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
