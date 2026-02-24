import { useState, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toggleReaction } from '../api/social';
import type { FeedReaction } from '../api/social';
import type { FeedResponseSchema } from '../api/schemas';
import { queryKeys } from '../api/queryKeys';
import { EmojiPicker } from './EmojiPicker';
import styles from './ActionRow.module.css';

interface ActionRowProps {
  eventId: number;
  reactions: FeedReaction[];
  currentUserId: number;
  onCommentFocus: () => void;
}

type FeedResponse = typeof FeedResponseSchema._output;

export function ActionRow({ eventId, reactions, currentUserId: _currentUserId, onCommentFocus }: ActionRowProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const reactButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const myReaction = reactions.find((r) => r.reactedByMe);
  const currentEmoji = myReaction?.emoji ?? null;

  const mutation = useMutation({
    mutationFn: (emoji: string) => toggleReaction(eventId, emoji),
    onMutate: async (emoji: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.social.feed() });
      const snapshot = queryClient.getQueryData<FeedResponse>(queryKeys.social.feed());

      queryClient.setQueryData<FeedResponse>(queryKeys.social.feed(), (old) => {
        if (!old) return old;
        return {
          ...old,
          events: old.events.map((event) => {
            if (event.id !== eventId) return event;

            const existing = event.reactions.find((r) => r.emoji === emoji);
            const reactedByMe = existing?.reactedByMe ?? false;

            if (reactedByMe) {
              // Toggle off the same emoji
              return {
                ...event,
                reactions: event.reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count - 1, reactedByMe: false }
                      : r
                  )
                  .filter((r) => r.count > 0),
              };
            } else {
              // Remove any previous reaction by this user (different emoji) and add/increment new one
              const withoutPrevious = event.reactions
                .map((r) =>
                  r.reactedByMe && r.emoji !== emoji
                    ? { ...r, count: r.count - 1, reactedByMe: false }
                    : r
                )
                .filter((r) => r.count > 0);

              const hasEntry = withoutPrevious.some((r) => r.emoji === emoji);
              if (hasEntry) {
                return {
                  ...event,
                  reactions: withoutPrevious.map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count + 1, reactedByMe: true }
                      : r
                  ),
                };
              } else {
                return {
                  ...event,
                  reactions: [
                    ...withoutPrevious,
                    { emoji, count: 1, reactedByMe: true },
                  ],
                };
              }
            }
          }),
        };
      });

      return { snapshot };
    },
    onError: (_err, _emoji, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKeys.social.feed(), context.snapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.social.feed() });
    },
  });

  const handleEmojiSelect = (emoji: string) => {
    mutation.mutate(emoji);
    setIsPickerOpen(false);
  };

  return (
    <div className={styles.actionRow}>
      <div className={styles.reactButtonWrapper}>
        <button
          ref={reactButtonRef}
          type="button"
          className={`${styles.actionButton}${currentEmoji ? ` ${styles.actionButtonActive}` : ''}`}
          aria-label={currentEmoji ? `You reacted with ${currentEmoji}` : 'React'}
          aria-pressed={currentEmoji !== null}
          onClick={() => setIsPickerOpen((open) => !open)}
        >
          <span aria-hidden="true">{currentEmoji ?? '🔥'}</span>
          <span>{currentEmoji ? 'Reacted' : 'React'}</span>
        </button>
        <EmojiPicker
          isOpen={isPickerOpen}
          currentEmoji={currentEmoji}
          onSelect={handleEmojiSelect}
          onClose={() => setIsPickerOpen(false)}
        />
      </div>
      <button
        type="button"
        className={styles.actionButton}
        onClick={onCommentFocus}
      >
        <span aria-hidden="true">💬</span>
        <span>Comment</span>
      </button>
    </div>
  );
}
