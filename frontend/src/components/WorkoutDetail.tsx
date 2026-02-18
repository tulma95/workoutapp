import React from 'react';
import { Workout, ProgressionResult } from '../api/workouts';
import { ProgressionBanner } from './ProgressionBanner';
import { formatWeight } from '../utils/weight';
import styles from './WorkoutDetail.module.css';

interface WorkoutDetailProps {
  workout?: Workout;
  progression: ProgressionResult | null;
  isLoading?: boolean;
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
  progression,
  isLoading = false,
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

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Day {workout.dayNumber}{exerciseGroups.length > 0 ? ` - ${exerciseGroups.at(0)?.exercise}` : ''}
        </h2>
        <p className={styles.date}>{formatDate(workoutDate)}</p>
      </div>

      {exerciseGroups.map((group) => (
        <section key={group.exercise} className={styles.section}>
          <h3 className={styles.sectionTitle}>{group.exercise}</h3>
          <div className={styles.sets}>
            {group.sets.map((set, index) => (
              <div key={set.id} className={styles.setRow}>
                <span className={styles.setNumber}>Set {index + 1}</span>
                <span className={styles.setWeight}>
                  {formatWeight(set.prescribedWeight)}
                </span>
                <span className={styles.setReps}>
                  {set.prescribedReps}
                  {set.isAmrap ? '+' : ''} reps
                </span>
                {set.actualReps !== null && set.actualReps !== set.prescribedReps && (
                  <span className={styles.setActual}>
                    ({set.actualReps} done)
                  </span>
                )}
                {(set.completed || set.actualReps !== null) && (
                  <span className={styles.setCompleted} aria-label="completed">
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className={styles.progression}>
        {progression ? (
          <ProgressionBanner progression={progression} />
        ) : (
          <div className={styles.noProgression}>No TM change</div>
        )}
      </div>
    </div>
  );
};
