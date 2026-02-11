import './WorkoutCard.css';

interface WorkoutCardProps {
  dayNumber: number;
  t1Exercise: string;
  t2Exercise: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  onStart: (dayNumber: number) => void;
}

export default function WorkoutCard({
  dayNumber,
  t1Exercise,
  t2Exercise,
  status,
  onStart,
}: WorkoutCardProps) {
  return (
    <div className={`workout-card workout-card--${status}`}>
      <div className="workout-card__header">
        <h3 className="workout-card__title">Day {dayNumber}</h3>
        {status === 'completed' && (
          <span className="workout-card__checkmark">✓</span>
        )}
      </div>

      <div className="workout-card__exercises">
        <div className="workout-card__exercise">
          <span className="workout-card__label">T1:</span>
          <span className="workout-card__name">{t1Exercise}</span>
        </div>
        <div className="workout-card__exercise">
          <span className="workout-card__label">T2:</span>
          <span className="workout-card__name">{t2Exercise}</span>
        </div>
      </div>

      {status !== 'completed' && (
        <button
          className="btn-primary workout-card__button"
          onClick={() => onStart(dayNumber)}
        >
          {status === 'in_progress' ? 'Continue Workout' : 'Start Workout'}
        </button>
      )}
    </div>
  );
}
