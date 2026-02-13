import React from 'react';
import { formatExerciseName, formatWeight, convertWeight, roundWeight } from '../utils/weight';
import type { UnitPreference } from '../types';
import './ProgressionBanner.css';

interface ProgressionBannerProps {
  // Support both old (single progression) and new (array) formats
  progression?: {
    exercise: string;
    previousTM: number;
    newTM: number;
    increase: number;
  } | null;
  progressions?: Array<{
    exercise: string;
    previousTM: number;
    newTM: number;
    increase: number;
  }>;
  unit: UnitPreference;
}

export const ProgressionBanner: React.FC<ProgressionBannerProps> = ({ progression, progressions, unit }) => {
  // Normalize to array format
  const progressionArray = progressions || (progression ? [progression] : []);

  // Filter out zero-increase progressions
  const validProgressions = progressionArray.filter((p) => p.increase !== 0);

  if (validProgressions.length === 0) {
    return (
      <div className="progression-banner progression-banner--neutral">
        No TM changes this session
      </div>
    );
  }

  return (
    <div className="progression-banner-container">
      {validProgressions.map((prog, index) => {
        const exerciseName = formatExerciseName(prog.exercise);

        // Convert and round the increase value for display
        const increaseInUserUnit = roundWeight(convertWeight(prog.increase, unit), unit);
        const increaseStr = increaseInUserUnit > 0 ? `+${increaseInUserUnit} ${unit}` : `${increaseInUserUnit} ${unit}`;

        // Format the new TM
        const newTMFormatted = formatWeight(prog.newTM, unit);

        return (
          <div key={index} className="progression-banner progression-banner--success">
            {exerciseName} TM {increaseStr}! New TM: {newTMFormatted}
          </div>
        );
      })}
    </div>
  );
};
