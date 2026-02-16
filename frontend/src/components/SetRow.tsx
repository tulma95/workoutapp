import RepsInput from './RepsInput';
import type { UnitPreference } from '../types';
import { formatWeight } from '../utils/weight';
import './SetRow.css';

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
  onUndo: () => void;
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
  onUndo,
}: SetRowProps) {
  const isEdited = completed && actualReps !== null && actualReps < reps;
  const isPending = !isAmrap && !completed;

  function handleRepsChange(value: number) {
    if (isPending) {
      onConfirm();
    }
    onRepsChange(value);
  }

  return (
    <div
      className={`set-row ${completed ? 'set-row--completed' : ''} ${
        isEdited ? 'set-row--edited' : ''
      }`}
    >
      <div className="set-row__info">
        <span className="set-row__number">{setNumber}</span>
        <span className="set-row__weight">{formatWeight(weight, unit)}</span>
        {isAmrap && (
          <span className="set-row__reps">x{reps}+</span>
        )}
        {isEdited && (
          <span className="set-row__target-hint">target: {reps}</span>
        )}
      </div>

      <div className="set-row__action">
        <RepsInput
          value={actualReps}
          targetReps={reps}
          isAmrap={isAmrap}
          onChange={handleRepsChange}
        />
        {completed && (
          <button
            type="button"
            className="set-row__undo"
            onClick={onUndo}
            aria-label={`Undo set ${setNumber}`}
          >
            ✓
          </button>
        )}
      </div>
    </div>
  );
}
