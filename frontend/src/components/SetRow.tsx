import RepsInput from './RepsInput';
import type { UnitPreference } from '../types';
import { formatWeight } from '../utils/weight';
import styles from './SetRow.module.css';

interface SetRowProps {
  setNumber: number;
  weight: number;
  reps: number;
  isAmrap: boolean;
  completed: boolean;
  actualReps: number | null;
  unit: UnitPreference;
  onConfirm: () => void;
  onRepsChange: (reps: number) => void;
}

export default function SetRow({
  setNumber,
  weight,
  reps,
  isAmrap,
  completed,
  actualReps,
  unit,
  onConfirm,
  onRepsChange,
}: SetRowProps) {
  const isPending = !isAmrap && !completed;

  function handleRepsChange(value: number) {
    if (isPending) {
      onConfirm();
    }
    onRepsChange(value);
  }

  return (
    <div
      className={`${styles.setRow} ${completed ? styles.completed : ''}`}
      data-set-row
    >
      <div className={styles.info}>
        <span className={styles.number}>{setNumber}</span>
        <span className={styles.weight}>{formatWeight(weight, unit)}</span>
        {isAmrap && (
          <span className={styles.reps}>x{reps}+</span>
        )}
      </div>

      <div className={styles.action}>
        <RepsInput
          value={actualReps}
          targetReps={reps}
          isAmrap={isAmrap}
          onChange={handleRepsChange}
          onFocus={isPending ? onConfirm : undefined}
        />
      </div>
    </div>
  );
}
