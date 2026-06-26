import { useEffect, useRef } from 'react';
import { Exercise } from '../../api/exercises';
import { PlanSet } from '../../api/adminPlans';
import { EditorDay, EditorExercise } from '../../hooks/usePlanEditorState';
import styles from '../../styles/PlanEditorPage.module.css';

interface PlanDayEditorProps {
  days: EditorDay[];
  activeDay: number;
  exercises: Exercise[];
  showExercisePicker: boolean;
  exerciseSearch: string;
  onActiveDayChange: (dayNumber: number) => void;
  onDayNameChange: (dayNumber: number, value: string) => void;
  onShowExercisePicker: (show: boolean) => void;
  onExerciseSearchChange: (value: string) => void;
  onAddExercise: (exercise: Exercise) => void;
  onRemoveExercise: (dayNumber: number, tempId: string) => void;
  onMoveExerciseUp: (dayNumber: number, tempId: string) => void;
  onMoveExerciseDown: (dayNumber: number, tempId: string) => void;
  onUpdateExerciseField: (dayNumber: number, tempId: string, field: keyof EditorExercise, value: any) => void;
  onOpenSetSchemeEditor: (dayNumber: number, tempId: string) => void;
  onCopySetsFrom: (dayNumber: number, sourceTempId: string, targetTempId: string) => void;
  onCopyDayFrom: (sourceDayNumber: number) => void;
}

function formatSetSummary(sets: PlanSet[]): string {
  if (sets.length === 0) return '';
  const percentages = sets.map(s => Math.round(s.percentage * 100));
  const minPct = Math.min(...percentages);
  const maxPct = Math.max(...percentages);
  const pctRange = minPct === maxPct ? `${minPct}%` : `${minPct}-${maxPct}%`;
  const amrapSets = sets.filter(s => s.isAmrap);
  const parts = [`${sets.length} sets`, pctRange];
  if (amrapSets.length > 0) {
    parts.push(`AMRAP set ${amrapSets.map(s => s.setOrder).join(', ')}`);
  }
  const progSets = sets.filter(s => s.isProgression);
  if (progSets.length > 0) {
    parts.push('Progression');
  }
  return parts.join(' · ');
}

export default function PlanDayEditor({
  days,
  activeDay,
  exercises,
  showExercisePicker,
  exerciseSearch,
  onActiveDayChange,
  onDayNameChange,
  onShowExercisePicker,
  onExerciseSearchChange,
  onAddExercise,
  onRemoveExercise,
  onMoveExerciseUp,
  onMoveExerciseDown,
  onUpdateExerciseField,
  onOpenSetSchemeEditor,
  onCopySetsFrom,
  onCopyDayFrom,
}: PlanDayEditorProps) {
  const exercisePickerRef = useRef<HTMLDialogElement>(null);
  const currentDayData = days.find(d => d.dayNumber === activeDay);
  const copyableDays = days.filter(
    d => d.dayNumber !== activeDay && d.exercises.length > 0
  );

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  useEffect(() => {
    const dialog = exercisePickerRef.current;
    if (!dialog) return;

    if (showExercisePicker) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [showExercisePicker]);

  useEffect(() => {
    const dialog = exercisePickerRef.current;
    if (!dialog) return;

    const handleClose = () => onShowExercisePicker(false);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  return (
    <>
      <div className={styles.dayTabsSection}>
        <div className={styles.dayTabs}>
          {days.map((day) => {
            const hasExercises = day.exercises.length > 0;
            const allHaveSets = hasExercises && day.exercises.every(ex => ex.sets.length > 0);

            let statusClass = '';
            if (allHaveSets) statusClass = styles.dayTabComplete ?? '';
            else if (hasExercises) statusClass = styles.dayTabIncomplete ?? '';

            return (
              <button
                key={day.dayNumber}
                className={`${styles.dayTab} ${activeDay === day.dayNumber ? styles.dayTabActive : ''} ${statusClass}`}
                onClick={() => onActiveDayChange(day.dayNumber)}
                data-testid="day-tab"
                {...(allHaveSets ? { 'data-complete': '' } : hasExercises ? { 'data-incomplete': '' } : {})}
              >
                {day.name && day.name !== `Day ${day.dayNumber}`
                  ? `Day ${day.dayNumber}: ${day.name}`
                  : `Day ${day.dayNumber}`}
                {day.exercises.length > 0 && (
                  <span className={styles.dayTabCount}>({day.exercises.length})</span>
                )}
              </button>
            );
          })}
        </div>

        {currentDayData && (
          <div className={styles.dayEditor}>
            <div className={styles.dayNameInput}>
              <label>
                Day Name
                <input
                  type="text"
                  value={currentDayData.name || ''}
                  onChange={(e) => onDayNameChange(activeDay, e.target.value)}
                  placeholder={`Day ${activeDay}`}
                />
              </label>
            </div>

            <div className={styles.exercisesSection}>
              <div className={styles.exercisesHeader}>
                <h3>Exercises</h3>
                <button
                  className={styles.addExerciseBtn}
                  onClick={() => onShowExercisePicker(true)}
                >
                  + Add Exercise
                </button>
              </div>

              {currentDayData.exercises.length === 0 && (
                <div className={styles.exercisesEmpty}>
                  <p>No exercises yet. Click "Add Exercise" to get started.</p>
                  {copyableDays.length > 0 && (
                    <label className={styles.copyDayLabel}>
                      Or copy exercises from another day:
                      <select
                        className={styles.copyDaySelect}
                        data-testid="copy-day-select"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) onCopyDayFrom(parseInt(e.target.value, 10));
                        }}
                      >
                        <option value="">Copy exercises from...</option>
                        {copyableDays.map(d => (
                          <option key={d.dayNumber} value={d.dayNumber}>
                            {d.name && d.name !== `Day ${d.dayNumber}`
                              ? `Day ${d.dayNumber}: ${d.name}`
                              : `Day ${d.dayNumber}`}{' '}
                            ({d.exercises.length} exercise{d.exercises.length === 1 ? '' : 's'})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}

              {currentDayData.exercises.map((ex, idx) => {
                const exercise = exercises.find(e => e.id === ex.exerciseId);
                if (!exercise) return null;

                const otherWithSets = currentDayData.exercises.filter(
                  other => other.tempId !== ex.tempId && other.sets.length > 0
                );

                return (
                  <div
                    key={ex.tempId}
                    className={`${styles.exerciseRow} ${ex.sets.length > 0 ? styles.exerciseRowHasSets : styles.exerciseRowNoSets}`}
                    data-testid="exercise-row"
                  >
                    <div className={styles.exerciseRowHeader}>
                      <span className={styles.exerciseName}>{idx + 1}. {exercise.name}</span>
                      <div className={styles.exerciseRowActions}>
                        <button
                          onClick={() => onMoveExerciseUp(activeDay, ex.tempId)}
                          disabled={idx === 0}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => onMoveExerciseDown(activeDay, ex.tempId)}
                          disabled={idx === currentDayData.exercises.length - 1}
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => onRemoveExercise(activeDay, ex.tempId)}
                          className={styles.removeBtn}
                          title="Remove"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className={styles.exerciseRowFields}>
                      <label>
                        TM Exercise
                        <select
                          value={ex.tmExerciseId}
                          onChange={(e) =>
                            onUpdateExerciseField(
                              activeDay,
                              ex.tempId,
                              'tmExerciseId',
                              parseInt(e.target.value, 10)
                            )
                          }
                        >
                          {exercises.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Display Name (optional)
                        <input
                          type="text"
                          value={ex.displayName || ''}
                          onChange={(e) =>
                            onUpdateExerciseField(activeDay, ex.tempId, 'displayName', e.target.value)
                          }
                          placeholder={exercise.name}
                        />
                      </label>
                    </div>

                    <div className={styles.exerciseSetsInfo}>
                      {ex.sets.length > 0 ? (
                        <span className={styles.setsSummary}>{formatSetSummary(ex.sets)}</span>
                      ) : (
                        <span className={styles.setsWarningBadge}>No sets defined</span>
                      )}
                      <div className={styles.exerciseSetsActions}>
                        <button
                          className={styles.editSetsBtn}
                          onClick={() => onOpenSetSchemeEditor(activeDay, ex.tempId)}
                        >
                          Edit Sets
                        </button>
                        {otherWithSets.length > 0 && (
                          <select
                            className={styles.copySetsSelect}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) onCopySetsFrom(activeDay, e.target.value, ex.tempId);
                            }}
                          >
                            <option value="">Copy sets from...</option>
                            {otherWithSets.map(other => {
                              const otherExData = exercises.find(e => e.id === other.exerciseId);
                              return (
                                <option key={other.tempId} value={other.tempId}>
                                  {otherExData?.name || 'Exercise'} ({other.sets.length} sets)
                                </option>
                              );
                            })}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <dialog
        ref={exercisePickerRef}
        className={styles.pickerDialog}
        onClick={(e) => { if (e.target === exercisePickerRef.current) onShowExercisePicker(false); }}
      >
        <div className={styles.pickerContent}>
          <div className={styles.pickerHeader}>
            <h3>Add Exercise</h3>
            <button onClick={() => onShowExercisePicker(false)}>×</button>
          </div>

          <input
            type="text"
            className={styles.exerciseSearch}
            placeholder="Search exercises..."
            value={exerciseSearch}
            onChange={(e) => onExerciseSearchChange(e.target.value)}
          />

          <div className={styles.pickerList}>
            {filteredExercises.map((ex) => (
              <button
                key={ex.id}
                className={styles.pickerItem}
                onClick={() => onAddExercise(ex)}
                data-testid="exercise-picker-item"
              >
                <div className={styles.pickerItemName}>{ex.name}</div>
                <div className={styles.pickerItemMeta}>
                  {ex.muscleGroup && <span>{ex.muscleGroup}</span>}
                  <span className={styles.exerciseCategory}>{ex.category}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
