import './RepsInput.css';

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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue) && newValue >= 0) {
      if (!isAmrap && newValue > targetReps) {
        onChange(targetReps);
      } else {
        onChange(newValue);
      }
    } else if (e.target.value === '') {
      onChange(0);
    }
  }

  const isDecrementDisabled = value !== null && value <= 0;

  return (
    <div className="reps-input">
      <button
        type="button"
        className="reps-input__button"
        onClick={handleDecrement}
        disabled={isDecrementDisabled}
        aria-label="Decrease reps"
      >
        −
      </button>

      <input
        type="number"
        className="reps-input__field"
        value={value ?? ''}
        onChange={handleInputChange}
        onFocus={onFocus}
        placeholder={targetReps.toString()}
        min="0"
        max={isAmrap ? undefined : targetReps}
        aria-label="Reps completed"
      />

      <button
        type="button"
        className="reps-input__button"
        onClick={handleIncrement}
        aria-label="Increase reps"
      >
        +
      </button>
    </div>
  );
}
