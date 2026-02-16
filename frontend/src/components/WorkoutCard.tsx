import styles from './WorkoutCard.module.css';
import shared from '../styles/shared.module.css';

interface WorkoutCardProps {
  dayNumber: number;
  exercises: string[];
  status: 'upcoming' | 'in_progress' | 'completed';
  onStart: (dayNumber: number) => void;
}

export default function WorkoutCard({
  dayNumber,
  exercises,
  status,
  onStart,
}: WorkoutCardProps) {
  return (
    <div className={`${styles.card} ${status === 'in_progress' ? styles.inProgress : status === 'completed' ? styles.completed : styles.upcoming}`} style={{ viewTransitionName: `workout-day-${dayNumber}` }}>
      <div className={styles.header}>
        <h3 className={styles.title}>Day {dayNumber}</h3>
        {status === 'completed' && (
          <span className={styles.checkmark}>✓</span>
        )}
      </div>

      <div className={styles.exercises}>
        {exercises.map((name) => (
          <div key={name} className={styles.exercise}>
            <span className={styles.name}>{name}</span>
          </div>
        ))}
      </div>

      {status !== 'completed' && (
        <button
          className={`${shared.btnPrimary} ${styles.button}`}
          onClick={() => onStart(dayNumber)}
        >
          {status === 'in_progress' ? 'Continue Workout' : 'Start Workout'}
        </button>
      )}
    </div>
  );
}
