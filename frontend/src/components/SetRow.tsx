import RepsInput from './RepsInput';
import { formatWeight } from '../utils/weight';
import styles from './SetRow.module.css';

interface SetRowProps {
  setNumber: number;
  weight: number;
  reps: number;
  isAmrap: boolean;
  completed: boolean;
  actualReps: number | null;
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
  onConfirm,
  onRepsChange,
}: SetRowProps) {
  const isPending = !isAmrap && !completed;
  const isUnder = completed && actualReps !== null && actualReps < reps;

  function handleRepsChange(value: number) {
    if (isPending) {
      onConfirm();
    }
    onRepsChange(value);
  }

  return (
    <div
      className={`${styles.setRow} ${isUnder ? styles.under : completed ? styles.completed : ''}`}
      data-set-row
      data-testid="set-row"
      {...(completed ? { 'data-completed': '' } : {})}
      {...(isAmrap ? { 'data-amrap': '' } : {})}
    >
      <div className={styles.info}>
        <span className={styles.number}>{setNumber}</span>
        <span className={styles.weight} data-testid="set-weight">{formatWeight(weight)}</span>
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
