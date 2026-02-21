import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toggleReaction } from '../api/social';
import type { FeedReaction } from '../api/social';
import type { FeedResponseSchema } from '../api/schemas';
import styles from './ReactionBar.module.css';

const EMOJI_SET = ['🔥', '👏', '💀', '💪', '🤙'] as const;

interface ReactionBarProps {
  eventId: number;
  reactions: FeedReaction[];
}

type FeedResponse = typeof FeedResponseSchema._output;

export function ReactionBar({ eventId, reactions }: ReactionBarProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (emoji: string) => toggleReaction(eventId, emoji),
    onMutate: async (emoji: string) => {
      await queryClient.cancelQueries({ queryKey: ['social', 'feed'] });
      const snapshot = queryClient.getQueryData<FeedResponse>(['social', 'feed']);

      queryClient.setQueryData<FeedResponse>(['social', 'feed'], (old) => {
        if (!old) return old;
        return {
          ...old,
          events: old.events.map((event) => {
            if (event.id !== eventId) return event;

            const existing = event.reactions.find((r) => r.emoji === emoji);
            const reactedByMe = existing?.reactedByMe ?? false;

            if (reactedByMe) {
              // Toggle off
              return {
                ...event,
                reactions: event.reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count - 1, reactedByMe: false }
                      : r
                  )
                  .filter((r) => r.count > 0 || r.emoji !== emoji),
              };
            } else {
              // Toggle on
              const hasEntry = event.reactions.some((r) => r.emoji === emoji);
              if (hasEntry) {
                return {
                  ...event,
                  reactions: event.reactions.map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count + 1, reactedByMe: true }
                      : r
                  ),
                };
              } else {
                return {
                  ...event,
                  reactions: [
                    ...event.reactions,
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
        queryClient.setQueryData(['social', 'feed'], context.snapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
  });

  return (
    <div className={styles.reactionBar} aria-label="Reactions">
      {EMOJI_SET.map((emoji) => {
        const reaction = reactions.find((r) => r.emoji === emoji);
        const count = reaction?.count ?? 0;
        const isActive = reaction?.reactedByMe ?? false;
        const ariaLabel =
          count > 0 ? `React with ${emoji} (${count})` : `React with ${emoji}`;

        return (
          <button
            key={emoji}
            type="button"
            className={`${styles.pill}${isActive ? ` ${styles.pillActive}` : ''}`}
            aria-pressed={isActive}
            aria-label={ariaLabel}
            onClick={() => mutation.mutate(emoji)}
            disabled={mutation.isPending && mutation.variables === emoji}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && (
              <span className={styles.count} aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
