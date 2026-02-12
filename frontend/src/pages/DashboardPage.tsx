import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getTrainingMaxes, updateTrainingMax, type TrainingMax } from '../api/trainingMaxes';
import { getCurrentWorkout } from '../api/workouts';
import { useAuth } from '../context/useAuth';
import WorkoutCard from '../components/WorkoutCard';
import { formatExerciseName, formatWeight, convertWeight, roundWeight, convertToKg } from '../utils/weight';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import './DashboardPage.css';

const WORKOUT_DAYS = [
  { day: 1, t1: 'Bench Volume', t2: 'OHP' },
  { day: 2, t1: 'Squat', t2: 'Sumo Deadlift' },
  { day: 3, t1: 'Bench Heavy', t2: 'Close Grip Bench' },
  { day: 4, t1: 'Deadlift', t2: 'Front Squat' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
    loadData();
  }, [navigate]);

  async function loadData() {
    setIsLoading(true);
    setFetchError('');
    try {
      const [tms, workout] = await Promise.all([
        getTrainingMaxes(),
        getCurrentWorkout(),
      ]);

      // If no training maxes exist, redirect to setup
      if (!tms || tms.length === 0) {
        navigate('/setup');
        return;
      }

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

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      <section className="training-maxes-section">
        <h2>Training Maxes</h2>
        <div className="tm-list">
          {trainingMaxes.map((tm) => (
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
          {WORKOUT_DAYS.map((day) => (
            <WorkoutCard
              key={day.day}
              dayNumber={day.day}
              t1Exercise={day.t1}
              t2Exercise={day.t2}
              status={getWorkoutStatus(day.day)}
              onStart={handleStartWorkout}
            />
          ))}
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
