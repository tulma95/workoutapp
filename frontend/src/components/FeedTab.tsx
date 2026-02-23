import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFeed } from '../api/social';
import type { FeedEvent } from '../api/social';
import { FeedEventPayloadSchema } from '../api/schemas';
import type { User } from '../api/schemas';
import { formatWeight } from '../utils/weight';
import { SkeletonLine, SkeletonCard } from './Skeleton';
import { ReactionSummary } from './ReactionSummary';
import { ActionRow } from './ActionRow';
import { CommentSection } from './CommentSection';
import styles from './FeedTab.module.css';

function renderEventText(event: FeedEvent): string | null {
  const parsed = FeedEventPayloadSchema.safeParse({
    eventType: event.eventType,
    ...event.payload,
  });
  if (!parsed.success) return null;
  const payload = parsed.data;

  if (payload.eventType === 'workout_completed') {
    const base = `${event.username} completed Day ${payload.dayNumber}`;
    return event.streak >= 2 ? `${base} — ${event.streak}-day streak` : base;
  }
  if (payload.eventType === 'tm_increased') {
    const base = `${event.username} hit a new ${payload.exerciseName} TM: ${formatWeight(payload.newTM)} (+${formatWeight(payload.increase)})`;
    return event.streak >= 2 ? `${base} — ${event.streak}-day streak` : base;
  }
  if (payload.eventType === 'streak_milestone') {
    return `${event.username} hit a ${payload.days}-day streak!`;
  }
  if (payload.eventType === 'badge_unlocked') {
    return `${event.username} unlocked '${payload.name}'!`;
  }
  if (payload.eventType === 'plan_switched') {
    return `${event.username} switched to ${payload.planName}`;
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

interface FeedItemProps {
  event: FeedEvent;
  currentUserId: number;
}

function FeedItem({ event, currentUserId }: FeedItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const text = renderEventText(event);
  if (text === null) return null;

  return (
    <li className={styles.eventItem}>
      <div className={styles.eventHeader}>
        <span className={styles.eventUsername}>{event.username}</span>
        <time
          className={styles.eventTime}
          dateTime={event.createdAt}
          title={new Date(event.createdAt).toLocaleString()}
        >
          {formatRelativeTime(event.createdAt)}
        </time>
      </div>
      <p className={styles.eventText}>{text}</p>
      <ReactionSummary reactions={event.reactions} commentCount={event.commentCount} />
      <ActionRow
        eventId={event.id}
        reactions={event.reactions}
        currentUserId={currentUserId}
        onCommentFocus={() => inputRef.current?.focus()}
      />
      <CommentSection
        eventId={event.id}
        commentCount={event.commentCount}
        eventOwnerId={event.userId}
        currentUserId={currentUserId}
        latestComments={event.latestComments}
        inputRef={inputRef}
      />
    </li>
  );
}

export function FeedTab() {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<User>(['user', 'me']);
  const currentUserId = currentUser?.id ?? 0;
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
      {events.map((event) => (
        <FeedItem key={event.id} event={event} currentUserId={currentUserId} />
      ))}
    </ul>
  );
}
