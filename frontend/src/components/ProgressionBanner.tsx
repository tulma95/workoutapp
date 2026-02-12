import React from 'react';
import { formatExerciseName, formatWeight, convertWeight, roundWeight } from '../utils/weight';
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

  // Convert and round the increase value for display
  const increaseInUserUnit = roundWeight(convertWeight(progression.increase, unit), unit);
  const increaseStr = increaseInUserUnit > 0 ? `+${increaseInUserUnit} ${unit}` : `${increaseInUserUnit} ${unit}`;

  // Format the new TM
  const newTMFormatted = formatWeight(progression.newTM, unit);

  return (
    <div className="progression-banner progression-banner--success">
      {exerciseName} TM {increaseStr}! New TM: {newTMFormatted}
    </div>
  );
};
