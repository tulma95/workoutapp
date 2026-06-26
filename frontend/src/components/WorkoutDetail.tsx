import React, { useEffect, useRef, useState } from 'react';
import { Workout } from '../api/workouts';
import { ProgressionBanner } from './ProgressionBanner';
import { formatWeight } from '../utils/weight';
import { computeWorkoutSummary, formatDuration, formatVolume } from '../utils/workoutSummary';
import styles from './WorkoutDetail.module.css';

interface WorkoutDetailProps {
  workout?: Workout;
  isLoading?: boolean;
  onDelete?: () => void;
  // When provided, the detail can edit a set's logged reps (record correction;
  // does not recompute training maxes).
  onEditSet?: (setId: number, actualReps: number) => void;
  onSaveNotes?: (notes: string) => void;
}

type WorkoutSet = Workout['sets'][number];

// Editable reps field that persists a corrected value a short debounce after
// the user stops typing. Committing on change (rather than blur/Enter) is
// reliable across browsers including WebKit.
const COMMIT_DELAY_MS = 400;

function EditableReps({
  set,
  onEditSet,
}: {
  set: WorkoutSet;
  onEditSet: (setId: number, actualReps: number) => void;
}) {
  const [value, setValue] = useState(String(set.actualReps ?? set.prescribedReps));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(String(set.actualReps ?? set.prescribedReps));
  }, [set.actualReps, set.prescribedReps]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function persist(raw: string) {
    const reps = parseInt(raw, 10);
    // Only persist a genuine change from what was displayed (the logged reps, or
    // the prescribed reps when nothing was logged) — so merely opening edit mode
    // and tapping Done doesn't silently "confirm" untouched sets.
    const baseline = set.actualReps ?? set.prescribedReps;
    if (!Number.isNaN(reps) && reps >= 0 && reps !== baseline) {
      onEditSet(set.id, reps);
    }
  }

  function handleChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(next), COMMIT_DELAY_MS);
  }

  // Commit immediately on blur — e.g. when the user taps "Done" before the
  // debounce fires the input loses focus first, so the edit isn't dropped.
  function flush() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    persist(value);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={3}
      className={styles.editInput}
      aria-label="Reps performed"
      value={value}
      onChange={(e) => handleChange(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={flush}
    />
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

export const WorkoutDetail: React.FC<WorkoutDetailProps> = ({
  workout,
  isLoading = false,
  onDelete,
  onEditSet,
  onSaveNotes,
}) => {
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState(workout?.notes ?? '');

  // Reset transient UI when a different workout is opened.
  const workoutId = workout?.id;
  useEffect(() => {
    setEditing(false);
    setNoteText(workout?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  if (isLoading || !workout) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>Loading workout...</div>
      </div>
    );
  }

  // Group sets by exercise, preserving exerciseOrder
  const exerciseGroups: Array<{ exercise: string; sets: typeof workout.sets }> = [];
  for (const set of workout.sets) {
    const last = exerciseGroups[exerciseGroups.length - 1];
    if (last && last.exercise === set.exercise) {
      last.sets.push(set);
    } else {
      exerciseGroups.push({ exercise: set.exercise, sets: [set] });
    }
  }

  const workoutDate = workout.completedAt || workout.createdAt;
  const totalSets = workout.sets.length;
  const completedSets = workout.sets.filter(s => s.completed || s.actualReps !== null).length;
  const progressions = workout.progressions ?? [];
  const summary = computeWorkoutSummary(workout);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {workout.isCustom ? 'Custom Workout' : `Day ${workout.dayNumber}`}{exerciseGroups.length > 0 ? ` - ${exerciseGroups.at(0)?.exercise}` : ''}
        </h2>
        <p className={styles.date}>{formatDate(workoutDate)}</p>
        <p className={styles.summary}>
          {completedSets}/{totalSets} sets
          {summary.durationMin !== null && <> · {formatDuration(summary.durationMin)}</>}
          {summary.totalVolumeKg > 0 && <> · {formatVolume(summary.totalVolumeKg)}</>}
        </p>
        {onEditSet && (
          <button
            type="button"
            className={styles.editToggle}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? 'Done' : 'Edit reps'}
          </button>
        )}
        {editing && (
          <p className={styles.editNote}>
            Corrects your logged reps. Training maxes aren&apos;t changed.
          </p>
        )}
      </div>

      {exerciseGroups.map((group) => {
        const exerciseProgression = progressions.find(p => p.exercise === group.exercise);
        return (
          <section key={group.exercise} className={styles.section}>
            <h3 className={styles.sectionTitle}>{group.exercise}</h3>
            <div className={styles.sets}>
              {group.sets.map((set, index) => {
                const isCompleted = set.completed || set.actualReps !== null;
                const isUnder = isCompleted && set.actualReps !== null && set.actualReps < set.prescribedReps;
                const stateClass = !isCompleted
                  ? styles.setMissed
                  : isUnder
                    ? styles.setUnder
                    : styles.setCompleted;

                return (
                  <div key={set.id} className={`${styles.setRow} ${stateClass}`}>
                    <span className={styles.setNumber}>{index + 1}</span>
                    <span className={styles.setWeight}>
                      {formatWeight(set.prescribedWeight)}
                    </span>
                    <span className={styles.setReps}>
                      {set.prescribedReps}
                      {set.isAmrap ? '+' : ''}
                    </span>
                    {editing && onEditSet ? (
                      <EditableReps set={set} onEditSet={onEditSet} />
                    ) : (
                      set.actualReps !== null &&
                      set.actualReps !== set.prescribedReps && (
                        <span className={styles.setActual}>{set.actualReps}</span>
                      )
                    )}
                    {set.rpe !== null && (
                      <span className={styles.setRpe} data-testid="set-rpe">RPE {set.rpe}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {exerciseProgression && (
              <ProgressionBanner progression={exerciseProgression} />
            )}
          </section>
        );
      })}

      {onSaveNotes && (
        <section className={styles.notes}>
          <h3 className={styles.notesTitle}>Notes</h3>
          <textarea
            className={styles.notesInput}
            placeholder="How did the session feel? Energy, injuries, form cues…"
            aria-label="Workout notes"
            value={noteText}
            maxLength={2000}
            rows={3}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button
            type="button"
            className={styles.notesSave}
            disabled={noteText.trim() === (workout.notes ?? '')}
            onClick={() => onSaveNotes(noteText)}
          >
            Save note
          </button>
        </section>
      )}

      {onDelete && (
        <button className={styles.deleteButton} onClick={onDelete}>
          Delete Workout
        </button>
      )}
    </div>
  );
};
