import React from 'react';
import { formatExerciseName } from '../utils/weight';
import type { UnitPreference } from '../types';
import './ProgressionBanner.css';

interface ProgressionBannerProps {
  progression: {
    exercise: string;
    previousTM: number;
    newTM: number;
    increase: number;
  } | null;
  unit: UnitPreference;
}

export const ProgressionBanner: React.FC<ProgressionBannerProps> = ({ progression, unit }) => {
  if (!progression || progression.increase === 0) {
    return (
      <div className="progression-banner progression-banner--neutral">
        No TM change this session
      </div>
    );
  }

  const exerciseName = formatExerciseName(progression.exercise);
  const increaseStr = progression.increase > 0 ? `+${progression.increase}${unit}` : `${progression.increase}${unit}`;

  return (
    <div className="progression-banner progression-banner--success">
      {exerciseName} TM {increaseStr}! New TM: {progression.newTM}{unit}
    </div>
  );
};
