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
  const showStepper = isAmrap || completed;

  return (
    <div
      className={`set-row ${completed ? 'set-row--completed' : ''} ${
        isEdited ? 'set-row--edited' : ''
      }`}
    >
      <div className="set-row__info">
        <span className="set-row__number">{setNumber}</span>
        <span className="set-row__weight">{formatWeight(weight, unit)}</span>
        <div className="set-row__reps-container">
          <span className="set-row__reps">
            x{reps}
            {isAmrap ? '+' : ''}
          </span>
          {isEdited && (
            <span className="set-row__target-hint">target: {reps}</span>
          )}
        </div>
      </div>

      <div className="set-row__action">
        {showStepper ? (
          <>
            <RepsInput
              value={actualReps}
              targetReps={reps}
              isAmrap={isAmrap}
              onChange={onRepsChange}
            />
            <button
              type="button"
              className="set-row__undo"
              onClick={onUndo}
              aria-label={`Undo set ${setNumber}`}
            >
              ✓
            </button>
          </>
        ) : (
          <button
            type="button"
            className="set-row__confirm"
            onClick={onConfirm}
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}
