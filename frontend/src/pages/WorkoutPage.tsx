import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import {
  getCurrentWorkout,
  startWorkout,
  logSet,
  completeWorkout,
  cancelWorkout,
  type Workout,
  type WorkoutSet,
  type ProgressionResult,
} from '../api/workouts';
import SetRow from '../components/SetRow';
import { ProgressionBanner } from '../components/ProgressionBanner';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { ConflictDialog } from '../components/ConflictDialog';
import './WorkoutPage.css';

const WORKOUT_DAYS = [
  { day: 1, t1: 'Bench Volume', t2: 'OHP' },
  { day: 2, t1: 'Squat', t2: 'Sumo Deadlift' },
  { day: 3, t1: 'Bench Heavy', t2: 'Close Grip Bench' },
  { day: 4, t1: 'Deadlift', t2: 'Front Squat' },
];

// Progression AMRAP set index (0-based) for each day
const PROGRESSION_AMRAP_INDEX: Record<number, number> = {
  1: 8, // Day 1: set 9 (65% x 8+)
  2: 2, // Day 2: set 3 (95% x 1+)
  3: 2, // Day 3: set 3 (95% x 1+)
  4: 2, // Day 4: set 3 (95% x 1+)
};

export default function WorkoutPage() {
  const { dayNumber: dayParam } = useParams<{ dayNumber: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progression, setProgression] = useState<ProgressionResult | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [conflictWorkout, setConflictWorkout] = useState<{ workoutId: number; dayNumber: number } | null>(null);

  const dayNumber = parseInt(dayParam || '0', 10);
  const dayInfo = WORKOUT_DAYS.find((d) => d.day === dayNumber);

  useEffect(() => {
    async function loadWorkout() {
      if (!dayNumber || !dayInfo) {
        setError('Invalid day number');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Check for existing in-progress workout
        const currentWorkout = await getCurrentWorkout();

        if (currentWorkout) {
          if (currentWorkout.dayNumber === dayNumber) {
            // Resume existing workout for this day
            setWorkout(currentWorkout);
          } else {
            // Existing workout for a different day - show conflict dialog
            setConflictWorkout({
              workoutId: currentWorkout.id,
              dayNumber: currentWorkout.dayNumber,
            });
            setIsLoading(false);
            return;
          }
        } else {
          // Start a new workout
          try {
            const newWorkout = await startWorkout(dayNumber);
            setWorkout(newWorkout);
          } catch (startErr: unknown) {
            // Handle 409 conflict from backend
            if (
              startErr &&
              typeof startErr === 'object' &&
              'error' in startErr &&
              startErr.error === 'EXISTING_WORKOUT' &&
              'workoutId' in startErr &&
              'dayNumber' in startErr
            ) {
              setConflictWorkout({
                workoutId: startErr.workoutId as number,
                dayNumber: startErr.dayNumber as number,
              });
              setIsLoading(false);
              return;
            }
            throw startErr;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workout');
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkout();
  }, [dayNumber, dayInfo]);

  const handleSetComplete = async (setId: number) => {
    if (!workout) return;

    const set = workout.sets.find((s) => s.id === setId);
    if (!set) return;

    const newCompleted = !set.completed;

    // Optimistic update
    setWorkout({
      ...workout,
      sets: workout.sets.map((s) =>
        s.id === setId ? { ...s, completed: newCompleted } : s
      ),
    });

    try {
      await logSet(workout.id, setId, { completed: newCompleted });
    } catch (err) {
      // Revert on error
      setWorkout({
        ...workout,
        sets: workout.sets.map((s) =>
          s.id === setId ? { ...s, completed: !newCompleted } : s
        ),
      });
      console.error('Failed to update set:', err);
    }
  };

  const handleAmrapRepsChange = async (setId: number, reps: number) => {
    if (!workout) return;

    // Optimistic update
    setWorkout({
      ...workout,
      sets: workout.sets.map((s) =>
        s.id === setId ? { ...s, actualReps: reps, completed: true } : s
      ),
    });

    try {
      await logSet(workout.id, setId, { actualReps: reps, completed: true });
    } catch (err) {
      console.error('Failed to update AMRAP reps:', err);
    }
  };

  const handleCompleteWorkout = async () => {
    if (!workout) return;

    // Find the progression AMRAP set (highest % AMRAP in T1)
    const t1Sets = workout.sets.filter((s) => s.tier === 'T1');
    const progressionAmrapIndex = PROGRESSION_AMRAP_INDEX[dayNumber];
    const progressionSet = t1Sets[progressionAmrapIndex];

    if (progressionSet && progressionSet.actualReps === null) {
      const confirmed = window.confirm(
        'You haven\'t entered reps for the progression AMRAP set. Complete workout without progression?'
      );
      if (!confirmed) return;
    }

    setIsCompleting(true);

    try {
      const result = await completeWorkout(workout.id);
      setProgression(result.progression);
      setIsCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete workout');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/');
  };

  const handleCancelWorkout = async () => {
    if (!workout) return;

    const confirmed = window.confirm(
      'Cancel this workout? All progress will be lost.'
    );

    if (!confirmed) return;

    setIsCanceling(true);

    try {
      await cancelWorkout(workout.id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel workout');
      setIsCanceling(false);
    }
  };

  const handleContinueExisting = () => {
    if (!conflictWorkout) return;
    navigate(`/workout/${conflictWorkout.dayNumber}`);
  };

  const handleDiscardAndStartNew = async () => {
    if (!conflictWorkout) return;

    try {
      await cancelWorkout(conflictWorkout.workoutId);
      // Reload the page to start a new workout for the requested day
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discard workout');
      setConflictWorkout(null);
    }
  };

  const handleCloseConflictDialog = () => {
    setConflictWorkout(null);
    navigate('/');
  };

  if (!dayInfo) {
    return (
      <div className="workout-page">
        <ErrorMessage message="Invalid day number" />
      </div>
    );
  }

  if (conflictWorkout) {
    return (
      <>
        <ConflictDialog
          existingDayNumber={conflictWorkout.dayNumber}
          onContinue={handleContinueExisting}
          onDiscard={handleDiscardAndStartNew}
          onClose={handleCloseConflictDialog}
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="workout-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="workout-page">
        <ErrorMessage message={error} />
        <button onClick={handleBackToDashboard} className="btn-secondary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="workout-page">
        <ErrorMessage message="Failed to load workout" />
      </div>
    );
  }

  const t1Sets = workout.sets.filter((s) => s.tier === 'T1');
  const t2Sets = workout.sets.filter((s) => s.tier === 'T2');
  const unit = user?.unitPreference || 'kg';

  if (isCompleted) {
    return (
      <div className="workout-page">
        <h1>Workout Complete!</h1>
        <ProgressionBanner progression={progression} unit={unit} />
        <button onClick={handleBackToDashboard} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="workout-page">
      <h1>Day {dayNumber} - {dayInfo.t1}</h1>

      <section className="workout-section">
        <h2 className="workout-section__title">T1: {dayInfo.t1}</h2>
        <div className="workout-section__sets">
          {t1Sets.map((set, index) => (
            <SetRow
              key={set.id}
              setNumber={index + 1}
              weight={set.prescribedWeight}
              reps={set.prescribedReps}
              isAmrap={set.isAmrap}
              completed={set.completed}
              actualReps={set.actualReps}
              unit={unit}
              onComplete={() => handleSetComplete(set.id)}
              onAmrapRepsChange={(reps) => handleAmrapRepsChange(set.id, reps)}
            />
          ))}
        </div>
      </section>

      <section className="workout-section">
        <h2 className="workout-section__title">T2: {dayInfo.t2}</h2>
        <div className="workout-section__sets">
          {t2Sets.map((set, index) => (
            <SetRow
              key={set.id}
              setNumber={index + 1}
              weight={set.prescribedWeight}
              reps={set.prescribedReps}
              isAmrap={set.isAmrap}
              completed={set.completed}
              actualReps={set.actualReps}
              unit={unit}
              onComplete={() => handleSetComplete(set.id)}
              onAmrapRepsChange={(reps) => handleAmrapRepsChange(set.id, reps)}
            />
          ))}
        </div>
      </section>

      <div className="workout-actions">
        <button
          onClick={handleCompleteWorkout}
          disabled={isCompleting || isCanceling}
          className="btn-primary btn-large"
        >
          {isCompleting ? 'Completing...' : 'Complete Workout'}
        </button>
        <button
          onClick={handleCancelWorkout}
          disabled={isCanceling || isCompleting}
          className="btn-secondary btn-large"
        >
          {isCanceling ? 'Canceling...' : 'Cancel Workout'}
        </button>
      </div>
    </div>
  );
}
