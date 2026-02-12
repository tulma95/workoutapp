import AmrapInput from './AmrapInput';
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
  onComplete: () => void;
  onAmrapRepsChange: (reps: number) => void;
}

export default function SetRow({
  setNumber,
  weight,
  reps,
  isAmrap,
  completed,
  actualReps,
  unit,
  onComplete,
  onAmrapRepsChange,
}: SetRowProps) {
  return (
    <div className={`set-row ${completed ? 'set-row--completed' : ''}`}>
      <div className="set-row__info">
        <span className="set-row__number">{setNumber}</span>
        <span className="set-row__weight">
          {formatWeight(weight, unit)}
        </span>
        <span className="set-row__reps">
          x{reps}
          {isAmrap ? '+' : ''}
        </span>
      </div>

      <div className="set-row__action">
        {isAmrap ? (
          <AmrapInput
            value={actualReps}
            targetReps={reps}
            onChange={onAmrapRepsChange}
          />
        ) : (
          <input
            type="checkbox"
            checked={completed}
            onChange={onComplete}
            className="set-row__checkbox"
            aria-label={`Mark set ${setNumber} as complete`}
          />
        )}
      </div>
    </div>
  );
}
