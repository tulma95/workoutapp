import { useEffect, useRef } from 'react';
import styles from './EmojiPicker.module.css';

const EMOJIS = ['🔥', '👏', '💀', '💪', '🤙'];

interface EmojiPickerProps {
  isOpen: boolean;
  currentEmoji: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ isOpen, currentEmoji, onSelect, onClose }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.row}>
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={styles.emojiButton}
            aria-pressed={emoji === currentEmoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
