import React from 'react';
import { formatExerciseName, formatWeight } from '../utils/weight';
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
}

export const ProgressionBanner: React.FC<ProgressionBannerProps> = ({ progression, progressions }) => {
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

        const increaseStr = prog.increase > 0 ? `+${formatWeight(prog.increase)}` : prog.increase === 0 ? 'No change' : formatWeight(prog.increase);

        // Format the new TM
        const newTMFormatted = formatWeight(prog.newTM);

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
