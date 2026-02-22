import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComments, createComment, deleteComment } from '../api/social';
import type { FeedEventComment } from '../api/social';
import type { User } from '../api/schemas';
import styles from './CommentSection.module.css';

interface CommentSectionProps {
  eventId: number;
  eventOwnerId: number;
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

export function CommentSection({ eventId, eventOwnerId }: CommentSectionProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentUser = queryClient.getQueryData<User>(['user', 'me']);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['social', 'feed', eventId, 'comments'],
    queryFn: () => getComments(eventId),
  });

  const createMutation = useMutation({
    mutationFn: (commentText: string) => createComment(eventId, commentText),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed', eventId, 'comments'] });
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
      setText('');
      setSubmitError(null);
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post comment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => deleteComment(eventId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed', eventId, 'comments'] });
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
  });

  const canDelete = (comment: FeedEventComment) => {
    if (!currentUser) return false;
    return comment.userId === currentUser.id || eventOwnerId === currentUser.id;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500 || createMutation.isPending) return;
    createMutation.mutate(trimmed);
  };

  return (
    <div className={styles.commentSection}>
      {isLoading && (
        <p className={styles.statusText}>Loading comments...</p>
      )}
      {isError && (
        <p className={styles.errorText} role="alert">Failed to load comments</p>
      )}
      {!isLoading && !isError && (
        <ul className={styles.commentList} aria-label="Comments">
          {(data?.comments ?? []).length === 0 && (
            <li className={styles.emptyText}>No comments yet</li>
          )}
          {(data?.comments ?? []).map((comment) => (
            <li key={comment.id} className={styles.commentItem}>
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
            </li>
          ))}
        </ul>
      )}

      <form className={styles.commentForm} onSubmit={handleSubmit}>
        <label htmlFor={`comment-input-${eventId}`} className={styles.srOnly}>
          Add a comment
        </label>
        <textarea
          id={`comment-input-${eventId}`}
          className={styles.commentInput}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          maxLength={500}
          rows={2}
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
