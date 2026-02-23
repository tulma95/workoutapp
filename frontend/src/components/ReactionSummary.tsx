import type { FeedReaction } from '../api/schemas';
import styles from './ReactionSummary.module.css';

interface ReactionSummaryProps {
  reactions: FeedReaction[];
  commentCount: number;
}

export function ReactionSummary({ reactions, commentCount }: ReactionSummaryProps) {
  const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);

  if (totalReactions === 0 && commentCount === 0) {
    return null;
  }

  const topEmojis = reactions.slice(0, 3).map((r) => r.emoji);
  const commentLabel = commentCount === 1 ? '1 comment' : `${commentCount} comments`;

  return (
    <div className={styles.container}>
      {totalReactions > 0 && (
        <span className={styles.reactions}>
          <span className={styles.emojis}>{topEmojis.join('')}</span>
          <span className={styles.totalCount}>{totalReactions}</span>
        </span>
      )}
      {commentCount > 0 && (
        <span className={styles.comments}>{commentLabel}</span>
      )}
    </div>
  );
}
