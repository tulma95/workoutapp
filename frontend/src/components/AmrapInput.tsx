import './AmrapInput.css';

interface AmrapInputProps {
  value: number | null;
  targetReps: number;
  onChange: (value: number) => void;
}

export default function AmrapInput({ value, targetReps, onChange }: AmrapInputProps) {
  function handleDecrement() {
    if (value === null) {
      onChange(0);
    } else if (value > 0) {
      onChange(value - 1);
    }
  }

  function handleIncrement() {
    if (value === null) {
      onChange(targetReps);
    } else {
      onChange(value + 1);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue) && newValue >= 0) {
      onChange(newValue);
    } else if (e.target.value === '') {
      // Allow clearing the input
      onChange(0);
    }
  }

  return (
    <div className="amrap-input">
      <button
        type="button"
        className="amrap-input__button"
        onClick={handleDecrement}
        aria-label="Decrease reps"
      >
        −
      </button>

      <input
        type="number"
        className="amrap-input__field"
        value={value ?? ''}
        onChange={handleInputChange}
        placeholder={targetReps.toString()}
        min="0"
        aria-label="AMRAP reps"
      />

      <button
        type="button"
        className="amrap-input__button"
        onClick={handleIncrement}
        aria-label="Increase reps"
      >
        +
      </button>
    </div>
  );
}
