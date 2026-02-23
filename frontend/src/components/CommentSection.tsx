import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComments, createComment, deleteComment } from '../api/social';
import type { FeedEventComment, CommentsResponse } from '../api/social';
import type { User } from '../api/schemas';
import styles from './CommentSection.module.css';

const AVATAR_PALETTE = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed'];

function getUserAvatarColor(username: string): string {
  const idx = username.charCodeAt(0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] as string;
}

interface CommentSectionProps {
  eventId: number;
  commentCount: number;
  eventOwnerId: number;
  currentUserId: number;
  latestComments?: FeedEventComment[];
  inputRef?: React.RefObject<HTMLInputElement | null>;
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

export function CommentSection({
  eventId,
  commentCount,
  eventOwnerId,
  currentUserId,
  latestComments,
  inputRef,
}: CommentSectionProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Auto-expand when no latestComments provided (e.g. modal context) so query fires immediately
  const [expanded, setExpanded] = useState(latestComments === undefined);

  const currentUser = queryClient.getQueryData<User>(['user', 'me']);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['social', 'feed', eventId, 'comments'],
    queryFn: () => getComments(eventId),
    enabled: expanded,
    initialData: latestComments !== undefined ? { comments: latestComments } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (commentText: string) => createComment(eventId, commentText),
    onMutate: async (commentText) => {
      await queryClient.cancelQueries({ queryKey: ['social', 'feed', eventId, 'comments'] });
      const previous = queryClient.getQueryData<CommentsResponse>(['social', 'feed', eventId, 'comments']);
      const optimisticComment: FeedEventComment = {
        id: -Date.now(),
        feedEventId: eventId,
        userId: currentUserId,
        username: currentUser?.username ?? '',
        text: commentText,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<CommentsResponse>(['social', 'feed', eventId, 'comments'], (old) => ({
        comments: [...(old?.comments ?? []), optimisticComment],
      }));
      setText('');
      return { previous };
    },
    onSuccess: () => {
      setSubmitError(null);
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed', eventId, 'comments'] });
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['social', 'feed', eventId, 'comments'], context.previous);
      }
      setSubmitError('Failed to post comment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => deleteComment(eventId, commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['social', 'feed', eventId, 'comments'] });
      const previous = queryClient.getQueryData<CommentsResponse>(['social', 'feed', eventId, 'comments']);
      queryClient.setQueryData<CommentsResponse>(['social', 'feed', eventId, 'comments'], (old) => ({
        comments: (old?.comments ?? []).filter((c) => c.id !== commentId),
      }));
      return { previous };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed', eventId, 'comments'] });
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['social', 'feed', eventId, 'comments'], context.previous);
      }
    },
  });

  const canDelete = (comment: FeedEventComment) => {
    return comment.userId === currentUserId || eventOwnerId === currentUserId;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500 || createMutation.isPending) return;
    createMutation.mutate(trimmed);
  };

  const visibleComments = expanded ? (data?.comments ?? []) : (latestComments ?? []);

  return (
    <div className={styles.commentSection}>
      {commentCount > 2 && !expanded && (
        <button
          type="button"
          className={styles.viewAllBtn}
          onClick={() => setExpanded(true)}
        >
          View all {commentCount} comments
        </button>
      )}
      {isError && (
        <p className={styles.errorText} role="alert">Failed to load comments</p>
      )}
      {expanded && !data && isFetching && (
        <p className={styles.statusText}>Loading comments...</p>
      )}
      {visibleComments.length > 0 && (
        <ul className={styles.commentList} aria-label="Comments">
          {visibleComments.map((comment) => (
            <li key={comment.id} className={styles.commentItem}>
              <div
                className={styles.avatar}
                style={{ backgroundColor: getUserAvatarColor(comment.username) }}
                aria-hidden="true"
              >
                {(comment.username[0] ?? '?').toUpperCase()}
              </div>
              <div className={styles.commentContent}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentUsername}>{comment.username}</span>
                  <time
                    className={styles.commentTime}
                    dateTime={comment.createdAt}
                    title={new Date(comment.createdAt).toLocaleString()}
                  >
                    {formatRelativeTime(comment.createdAt)}
                  </time>
                  {canDelete(comment) && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label={`Delete comment by ${comment.username}`}
                      onClick={() => deleteMutation.mutate(comment.id)}
                      disabled={deleteMutation.isPending && deleteMutation.variables === comment.id}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className={styles.commentText}>{comment.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.commentForm} onSubmit={handleSubmit}>
        <label htmlFor={`comment-input-${eventId}`} className={styles.srOnly}>
          Add a comment
        </label>
        <input
          ref={inputRef}
          id={`comment-input-${eventId}`}
          type="text"
          className={styles.commentInput}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          maxLength={500}
        />
        {submitError && (
          <p className={styles.errorText} role="alert">{submitError}</p>
        )}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!text.trim() || text.trim().length > 500 || createMutation.isPending}
        >
          {createMutation.isPending ? 'Posting...' : 'Post'}
        </button>
      </form>
    </div>
  );
}
