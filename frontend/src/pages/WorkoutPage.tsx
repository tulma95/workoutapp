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

export default function WorkoutPage() {
  const { dayNumber: dayParam } = useParams<{ dayNumber: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressions, setProgressions] = useState<ProgressionResult[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [conflictWorkout, setConflictWorkout] = useState<{ workoutId: number; dayNumber: number } | null>(null);

  const dayNumber = parseInt(dayParam || '0', 10);

  useEffect(() => {
    async function loadWorkout() {
      if (!dayNumber) {
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
  }, [dayNumber]);

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

    // Find progression sets (sets marked with isProgression flag)
    const progressionSets = workout.sets.filter((s) => s.isProgression);

    // Warn if any progression set has no reps logged
    const missingReps = progressionSets.some((s) => s.actualReps === null);
    if (missingReps && progressionSets.length > 0) {
      const confirmed = window.confirm(
        'You haven\'t entered reps for all progression sets. Complete workout without full progression tracking?'
      );
      if (!confirmed) return;
    }

    setIsCompleting(true);

    try {
      const result = await completeWorkout(workout.id);
      // Handle both old format (progression) and new format (progressions array)
      const progressionArray = result.progressions || (result.progression ? [result.progression] : []);
      setProgressions(progressionArray);
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

  // Extract exercise names from workout sets
  const t1ExerciseName = t1Sets.length > 0 ? t1Sets[0].exercise : 'T1';
  const t2ExerciseName = t2Sets.length > 0 ? t2Sets[0].exercise : 'T2';

  // Use day title from workout or fallback to "Day N"
  const dayTitle = `Day ${dayNumber}`;

  if (isCompleted) {
    return (
      <div className="workout-page">
        <h1>Workout Complete!</h1>
        <ProgressionBanner progressions={progressions} unit={unit} />
        <button onClick={handleBackToDashboard} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="workout-page">
      <h1>{dayTitle}</h1>

      <section className="workout-section">
        <h2 className="workout-section__title">T1: {t1ExerciseName}</h2>
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
        <h2 className="workout-section__title">T2: {t2ExerciseName}</h2>
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
