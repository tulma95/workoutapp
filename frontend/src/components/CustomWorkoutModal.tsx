import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from './Button';
import { useDialog } from '../hooks/useDialog';
import { queryKeys } from '../api/queryKeys';
import { getExerciseList } from '../api/exercises';
import { createCustomWorkout } from '../api/workouts';
import styles from './CustomWorkoutModal.module.css';

interface SetEntry {
  weight: string;
  reps: string;
}

interface ExerciseEntry {
  exerciseId: string;
  sets: SetEntry[];
}

interface CustomWorkoutModalProps {
  open: boolean;
  initialDate: string;
  onClose: () => void;
  onSaved: () => void;
}

function defaultExercise(): ExerciseEntry {
  return { exerciseId: '', sets: [{ weight: '', reps: '' }] };
}

export function CustomWorkoutModal({ open, initialDate, onClose, onSaved }: CustomWorkoutModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [date, setDate] = useState(initialDate);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([defaultExercise()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: exerciseList } = useQuery({
    queryKey: queryKeys.exercises.list(),
    queryFn: getExerciseList,
    staleTime: 5 * 60 * 1000,
  });

  useDialog(dialogRef, open, onClose);

  useEffect(() => {
    if (open) {
      setDate(initialDate);
      setExercises([defaultExercise()]);
      setError(null);
    }
  }, [open, initialDate]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const addExercise = () => {
    setExercises(prev => [...prev, defaultExercise()]);
  };

  const removeExercise = (idx: number) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const updateExerciseId = (idx: number, exerciseId: string) => {
    setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, exerciseId } : ex));
  };

  const addSet = (exIdx: number) => {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: [...ex.sets, { weight: '', reps: '' }] } : ex
    ));
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
    ));
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? {
        ...ex,
        sets: ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s),
      } : ex
    ));
  };

  const isValid = () => {
    if (!date) return false;
    if (exercises.length === 0) return false;
    return exercises.every(ex => {
      if (!ex.exerciseId) return false;
      if (ex.sets.length === 0) return false;
      return ex.sets.every(s => {
        const w = parseFloat(s.weight);
        const r = parseInt(s.reps, 10);
        return !isNaN(w) && w > 0 && !isNaN(r) && r > 0;
      });
    });
  };

  const handleSave = async () => {
    if (!isValid()) return;
    setSaving(true);
    setError(null);
    try {
      await createCustomWorkout({
        date,
        exercises: exercises.map(ex => ({
          exerciseId: parseInt(ex.exerciseId, 10),
          sets: ex.sets.map(s => ({
            weight: parseFloat(s.weight),
            reps: parseInt(s.reps, 10),
          })),
        })),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workout.calendarAll() });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClick={handleBackdropClick}>
      <div className={styles.content} data-testid="custom-workout-modal">
        <h2 className={styles.title}>Log Custom Workout</h2>

        <div className={styles.field}>
          <label htmlFor="custom-workout-date" className={styles.label}>Date</label>
          <input
            id="custom-workout-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={new Date().toLocaleDateString('en-CA')}
          />
        </div>

        <div className={styles.exerciseList}>
          {exercises.map((ex, exIdx) => (
            <div key={exIdx} className={styles.exerciseBlock}>
              <div className={styles.exerciseHeader}>
                <label htmlFor={`exercise-select-${exIdx}`} className={styles.label}>
                  Exercise {exIdx + 1}
                </label>
                {exercises.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeExercise(exIdx)}
                    aria-label={`Remove exercise ${exIdx + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>

              <select
                id={`exercise-select-${exIdx}`}
                value={ex.exerciseId}
                onChange={e => updateExerciseId(exIdx, e.target.value)}
                className={styles.exerciseSelect}
              >
                <option value="">Select exercise...</option>
                {exerciseList?.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>

              <div className={styles.setList}>
                {ex.sets.map((set, setIdx) => (
                  <div key={setIdx} className={styles.setRow}>
                    <span className={styles.setLabel}>Set {setIdx + 1}</span>
                    <div className={styles.setInputs}>
                      <div className={styles.inputGroup}>
                        <label htmlFor={`weight-${exIdx}-${setIdx}`} className={styles.inputLabel}>
                          Weight (kg)
                        </label>
                        <input
                          id={`weight-${exIdx}-${setIdx}`}
                          type="number"
                          value={set.weight}
                          onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                          placeholder="0"
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label htmlFor={`reps-${exIdx}-${setIdx}`} className={styles.inputLabel}>
                          Reps
                        </label>
                        <input
                          id={`reps-${exIdx}-${setIdx}`}
                          type="number"
                          value={set.reps}
                          onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                          placeholder="0"
                          min="1"
                          step="1"
                        />
                      </div>
                      {ex.sets.length > 1 && (
                        <button
                          type="button"
                          className={styles.removeSetBtn}
                          onClick={() => removeSet(exIdx, setIdx)}
                          aria-label={`Remove set ${setIdx + 1}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className={styles.addSetBtn}
                onClick={() => addSet(exIdx)}
              >
                + Add Set
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.addExerciseBtn}
          onClick={addExercise}
        >
          + Add Exercise
        </button>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !isValid()}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
