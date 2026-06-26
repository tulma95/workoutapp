import { useEffect, useRef } from 'react';
import styles from './RepsInput.module.css';

interface RepsInputProps {
  value: number | null;
  targetReps: number;
  isAmrap: boolean;
  onChange: (value: number) => void;
  onFocus?: () => void;
}

export default function RepsInput({ value, targetReps, isAmrap, onChange, onFocus }: RepsInputProps) {
  // Steps are computed from a ref updated synchronously on every tap, not from
  // the `value` prop. `value` only reflects a tap once the parent's optimistic
  // update has round-tripped and React has re-rendered; a second tap fired before
  // that commit (rapid taps, or just a slow WebKit re-render) would otherwise read
  // a stale value of null and reset to targetReps — silently dropping reps. This
  // bit AMRAP logging: confirm-then-increment collapsed back to the target.
  const liveValue = useRef<number | null>(value);
  useEffect(() => {
    liveValue.current = value;
  }, [value]);

  function emit(next: number) {
    liveValue.current = next;
    onChange(next);
  }

  function handleDecrement() {
    const current = liveValue.current;
    if (current === null) {
      emit(targetReps - 1);
    } else if (current > 0) {
      emit(current - 1);
    }
  }

  function handleIncrement() {
    const current = liveValue.current;
    if (current === null) {
      emit(targetReps);
    } else if (!isAmrap && current >= targetReps) {
      return;
    } else {
      emit(current + 1);
    }
  }

  function handleTapConfirm() {
    onFocus?.();
    emit(targetReps);
  }

  const isDecrementDisabled = value !== null && value <= 0;

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.button}
        onClick={handleDecrement}
        disabled={isDecrementDisabled}
        aria-label="Decrease reps"
      >
        −
      </button>

      {value === null ? (
        <button
          type="button"
          className={styles.field}
          onClick={handleTapConfirm}
          aria-label="Confirm reps"
          data-testid="reps-value"
        >
          {targetReps}
        </button>
      ) : (
        <span className={styles.field} aria-label="Reps completed" data-testid="reps-value">
          {value}
        </span>
      )}

      <button
        type="button"
        className={styles.button}
        onClick={handleIncrement}
        aria-label="Increase reps"
      >
        +
      </button>
    </div>
  );
}
