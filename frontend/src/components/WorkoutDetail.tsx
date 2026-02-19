import React from 'react';
import { Workout } from '../api/workouts';
import { ProgressionBanner } from './ProgressionBanner';
import { formatWeight } from '../utils/weight';
import styles from './WorkoutDetail.module.css';

interface WorkoutDetailProps {
  workout?: Workout;
  isLoading?: boolean;
  onDelete?: () => void;
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
}) => {
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

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {workout.isCustom ? 'Custom Workout' : `Day ${workout.dayNumber}`}{exerciseGroups.length > 0 ? ` - ${exerciseGroups.at(0)?.exercise}` : ''}
        </h2>
        <p className={styles.date}>{formatDate(workoutDate)}</p>
        <p className={styles.summary}>{completedSets}/{totalSets} sets</p>
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
                    {set.actualReps !== null && set.actualReps !== set.prescribedReps && (
                      <span className={styles.setActual}>
                        {set.actualReps}
                      </span>
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

      {onDelete && (
        <button className={styles.deleteButton} onClick={onDelete}>
          Delete Workout
        </button>
      )}
    </div>
  );
};
