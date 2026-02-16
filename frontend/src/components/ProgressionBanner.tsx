import React from 'react';
import { formatExerciseName, formatWeight, convertWeight, roundWeight } from '../utils/weight';
import type { UnitPreference } from '../types';
import styles from './ProgressionBanner.module.css';

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

  if (progressionArray.length === 0) {
    return (
      <div className={`${styles.banner} ${styles.neutral}`}>
        No TM changes this session
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {progressionArray.map((prog, index) => {
        const exerciseName = formatExerciseName(prog.exercise);

        // Convert and round the increase value for display
        const increaseInUserUnit = roundWeight(convertWeight(prog.increase, unit), unit);
        const increaseStr = increaseInUserUnit > 0 ? `+${increaseInUserUnit} ${unit}` : increaseInUserUnit === 0 ? 'No change' : `${increaseInUserUnit} ${unit}`;

        // Format the new TM
        const newTMFormatted = formatWeight(prog.newTM, unit);

        // Color-coded: green for increase, neutral for no change
        const bannerClass = prog.increase > 0 ? styles.success : styles.neutral;

        return (
          <div key={index} className={`${styles.banner} ${bannerClass}`}>
            {exerciseName} TM {increaseStr}! New TM: {newTMFormatted}
          </div>
        );
      })}
    </div>
  );
};
