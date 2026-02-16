import './WorkoutCard.css';

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
    <div className={`workout-card workout-card--${status}`} style={{ viewTransitionName: `workout-day-${dayNumber}` }}>
      <div className="workout-card__header">
        <h3 className="workout-card__title">Day {dayNumber}</h3>
        {status === 'completed' && (
          <span className="workout-card__checkmark">✓</span>
        )}
      </div>

      <div className="workout-card__exercises">
        {exercises.map((name) => (
          <div key={name} className="workout-card__exercise">
            <span className="workout-card__name">{name}</span>
          </div>
        ))}
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
