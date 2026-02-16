import styles from './RepsInput.module.css';

interface RepsInputProps {
  value: number | null;
  targetReps: number;
  isAmrap: boolean;
  onChange: (value: number) => void;
  onFocus?: () => void;
}

export default function RepsInput({ value, targetReps, isAmrap, onChange, onFocus }: RepsInputProps) {
  function handleDecrement() {
    if (value === null) {
      onChange(targetReps - 1);
    } else if (value > 0) {
      onChange(value - 1);
    }
  }

  function handleIncrement() {
    if (value === null) {
      onChange(targetReps);
    } else if (!isAmrap && value >= targetReps) {
      return;
    } else {
      onChange(value + 1);
    }
  }

  function handleTapConfirm() {
    onFocus?.();
    onChange(targetReps);
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
