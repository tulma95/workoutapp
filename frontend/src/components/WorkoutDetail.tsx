import React from 'react';
import { Workout, ProgressionResult } from '../api/workouts';
import { ProgressionBanner } from './ProgressionBanner';
import type { UnitPreference } from '../types';
import { formatWeight } from '../utils/weight';
import './WorkoutDetail.css';

interface WorkoutDetailProps {
  workout?: Workout;
  progression: ProgressionResult | null;
  unit: UnitPreference;
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
  unit,
  isLoading = false,
}) => {
  if (isLoading || !workout) {
    return (
      <div className="workout-detail">
        <div className="workout-detail__loading">Loading workout...</div>
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
    <div className="workout-detail">
      <div className="workout-detail__header">
        <h2 className="workout-detail__title">
          Day {workout.dayNumber}{exerciseGroups.length > 0 ? ` - ${exerciseGroups[0].exercise}` : ''}
        </h2>
        <p className="workout-detail__date">{formatDate(workoutDate)}</p>
      </div>

      {exerciseGroups.map((group) => (
        <section key={group.exercise} className="workout-detail__section">
          <h3 className="workout-detail__section-title">{group.exercise}</h3>
          <div className="workout-detail__sets">
            {group.sets.map((set, index) => (
              <div key={set.id} className="workout-detail__set-row">
                <span className="workout-detail__set-number">Set {index + 1}</span>
                <span className="workout-detail__set-weight">
                  {formatWeight(set.prescribedWeight, unit)}
                </span>
                <span className="workout-detail__set-reps">
                  {set.prescribedReps}
                  {set.isAmrap ? '+' : ''} reps
                </span>
                {set.actualReps !== null && (
                  <span className="workout-detail__set-actual">
                    ({set.actualReps} done)
                  </span>
                )}
                {set.completed && (
                  <span className="workout-detail__set-completed" aria-label="completed">
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="workout-detail__progression">
        {progression ? (
          <ProgressionBanner progression={progression} unit={unit} />
        ) : (
          <div className="workout-detail__no-progression">No TM change</div>
        )}
      </div>
    </div>
  );
};
