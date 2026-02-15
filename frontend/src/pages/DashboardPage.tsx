import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getTrainingMaxes, updateTrainingMax, type TrainingMax } from '../api/trainingMaxes';
import { getCurrentWorkout } from '../api/workouts';
import { getCurrentPlan, type WorkoutPlan } from '../api/plans';
import { useAuth } from '../context/useAuth';
import WorkoutCard from '../components/WorkoutCard';
import { formatExerciseName, formatWeight, convertWeight, roundWeight, convertToKg } from '../utils/weight';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, activePlanId, isLoading: authLoading } = useAuth();
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [trainingMaxes, setTrainingMaxes] = useState<TrainingMax[]>([]);
  const [currentWorkout, setCurrentWorkout] = useState<{ dayNumber: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const unit = user?.unitPreference || 'kg';

  useEffect(() => {
    // If user has no active plan, redirect to plan selection
    if (activePlanId === null && !authLoading) {
      navigate('/select-plan');
      return;
    }
    loadData();
  }, [navigate, activePlanId, authLoading]);

  async function loadData() {
    setIsLoading(true);
    setFetchError('');
    try {
      const [plan, tms, workout] = await Promise.all([
        getCurrentPlan(),
        getTrainingMaxes(),
        getCurrentWorkout(),
      ]);

      // If no plan, redirect to plan selection
      if (!plan) {
        navigate('/select-plan');
        return;
      }

      // If no training maxes exist, redirect to setup
      if (!tms || tms.length === 0) {
        navigate('/setup');
        return;
      }

      // Check if all plan exercises have TMs set
      const existingTMSlugs = new Set(tms.map(tm => tm.exercise));
      const tmExercisesMap = new Map<number, { slug: string; exercise: typeof plan.days[0]['exercises'][0]['tmExercise'] }>();
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          if (!tmExercisesMap.has(ex.tmExerciseId)) {
            tmExercisesMap.set(ex.tmExerciseId, { slug: ex.tmExercise.slug, exercise: ex.tmExercise });
          }
        }
      }
      const missingTMs = Array.from(tmExercisesMap.values())
        .filter(({ slug }) => !existingTMSlugs.has(slug))
        .map(({ exercise }) => exercise);

      if (missingTMs.length > 0) {
        navigate('/setup', { state: { missingTMs } });
        return;
      }

      setActivePlan(plan);
      setTrainingMaxes(tms);
      setCurrentWorkout(workout);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to load dashboard data');
      setIsLoading(false);
    }
  }

  function openEditModal(exercise: string, currentWeight: number) {
    setEditingExercise(exercise);
    // Convert weight from kg to user's unit for display in the input
    const weightInUserUnit = roundWeight(convertWeight(currentWeight, unit), unit);
    setEditValue(weightInUserUnit.toString());
    setError('');
  }

  function closeEditModal() {
    setEditingExercise(null);
    setEditValue('');
    setError('');
  }

  async function handleSave() {
    if (!editingExercise) return;

    const weightInUserUnit = parseFloat(editValue);
    if (isNaN(weightInUserUnit) || weightInUserUnit <= 0) {
      setError('Please enter a valid positive number');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Convert weight from user's unit to kg before sending to backend
      const weightInKg = convertToKg(weightInUserUnit, unit);
      await updateTrainingMax(editingExercise, weightInKg);
      await loadData(); // Refresh TMs
      closeEditModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update training max');
    } finally {
      setIsSaving(false);
    }
  }

  function handleStartWorkout(dayNumber: number) {
    navigate(`/workout/${dayNumber}`);
  }

  function getWorkoutStatus(dayNumber: number): 'upcoming' | 'in_progress' | 'completed' {
    if (currentWorkout && currentWorkout.dayNumber === dayNumber) {
      return 'in_progress';
    }
    return 'upcoming';
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (fetchError) {
    return <ErrorMessage message={fetchError} onRetry={loadData} />;
  }

  // Get unique TM exercise IDs from the plan
  const planTMExerciseIds = activePlan
    ? new Set(
        activePlan.days.flatMap((day) =>
          day.exercises.map((ex) => ex.tmExerciseId)
        )
      )
    : new Set();

  // Filter training maxes to show only those used in the current plan
  // Note: TM uses exercise string (slug), need to match by exercise ID from plan
  // For now, show all TMs - proper filtering would require TM to store exerciseId
  const relevantTMs = trainingMaxes;

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      {activePlan && (
        <section className="current-plan-section">
          <div className="current-plan-header">
            <div>
              <h2>Current Plan</h2>
              <p className="plan-name">{activePlan.name}</p>
              {activePlan.description && (
                <p className="plan-description">{activePlan.description}</p>
              )}
            </div>
            <button
              className="btn-secondary"
              onClick={() => navigate('/select-plan')}
            >
              Change
            </button>
          </div>
        </section>
      )}

      <section className="training-maxes-section">
        <h2>Training Maxes</h2>
        <div className="tm-list">
          {relevantTMs.map((tm) => (
            <div key={tm.exercise} className="tm-item">
              <div className="tm-info">
                <span className="tm-exercise">{formatExerciseName(tm.exercise)}</span>
                <span className="tm-weight">
                  {formatWeight(tm.weight, unit)}
                </span>
              </div>
              <button
                className="btn-edit"
                onClick={() => openEditModal(tm.exercise, tm.weight)}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="workout-days-section">
        <h2>Workout Days</h2>
        <div className="workout-cards">
          {activePlan?.days.map((day) => {
            const exerciseNames = day.exercises.map(
              (ex) => ex.displayName || ex.exercise.name
            );

            return (
              <WorkoutCard
                key={day.dayNumber}
                dayNumber={day.dayNumber}
                exercises={exerciseNames}
                status={getWorkoutStatus(day.dayNumber)}
                onStart={handleStartWorkout}
              />
            );
          })}
        </div>
      </section>

      {editingExercise && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit {formatExerciseName(editingExercise)}</h3>

            <div className="modal-body">
              <label htmlFor="tm-input">Training Max ({unit})</label>
              <input
                id="tm-input"
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                step="0.1"
                min="0"
                autoFocus
              />
              {error && <p className="error" role="alert">{error}</p>}
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={closeEditModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
