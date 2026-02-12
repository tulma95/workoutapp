import React from 'react';
import { Workout, ProgressionResult } from '../api/workouts';
import { ProgressionBanner } from './ProgressionBanner';
import type { UnitPreference } from '../types';
import { formatWeight } from '../utils/weight';
import './WorkoutDetail.css';

const WORKOUT_DAYS = [
  { day: 1, t1: 'Bench Volume', t2: 'OHP' },
  { day: 2, t1: 'Squat', t2: 'Sumo Deadlift' },
  { day: 3, t1: 'Bench Heavy', t2: 'Close Grip Bench' },
  { day: 4, t1: 'Deadlift', t2: 'Front Squat' },
];

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

  const dayInfo = WORKOUT_DAYS.find((d) => d.day === workout.dayNumber);
  if (!dayInfo) {
    return (
      <div className="workout-detail">
        <div className="workout-detail__error">Invalid workout day</div>
      </div>
    );
  }

  const t1Sets = workout.sets.filter((s) => s.tier === 'T1');
  const t2Sets = workout.sets.filter((s) => s.tier === 'T2');
  const workoutDate = workout.completedAt || workout.createdAt;

  return (
    <div className="workout-detail">
      <div className="workout-detail__header">
        <h2 className="workout-detail__title">
          Day {workout.dayNumber} - {dayInfo.t1}
        </h2>
        <p className="workout-detail__date">{formatDate(workoutDate)}</p>
      </div>

      <section className="workout-detail__section">
        <h3 className="workout-detail__section-title">T1: {dayInfo.t1}</h3>
        <div className="workout-detail__sets">
          {t1Sets.map((set, index) => (
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

      <section className="workout-detail__section">
        <h3 className="workout-detail__section-title">T2: {dayInfo.t2}</h3>
        <div className="workout-detail__sets">
          {t2Sets.map((set, index) => (
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
