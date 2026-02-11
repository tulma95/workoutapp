import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getTrainingMaxes, updateTrainingMax, type TrainingMax } from '../api/trainingMaxes';
import { useAuth } from '../context/AuthContext';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trainingMaxes, setTrainingMaxes] = useState<TrainingMax[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const unit = user?.unitPreference || 'kg';

  useEffect(() => {
    loadTrainingMaxes();
  }, [navigate]);

  async function loadTrainingMaxes() {
    try {
      const tms = await getTrainingMaxes();

      // If no training maxes exist, redirect to setup
      if (!tms || tms.length === 0) {
        navigate('/setup');
        return;
      }

      setTrainingMaxes(tms);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch training maxes:', error);
      setIsLoading(false);
    }
  }

  function openEditModal(exercise: string, currentWeight: number) {
    setEditingExercise(exercise);
    setEditValue(currentWeight.toString());
    setError('');
  }

  function closeEditModal() {
    setEditingExercise(null);
    setEditValue('');
    setError('');
  }

  async function handleSave() {
    if (!editingExercise) return;

    const weight = parseFloat(editValue);
    if (isNaN(weight) || weight <= 0) {
      setError('Please enter a valid positive number');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await updateTrainingMax(editingExercise, weight);
      await loadTrainingMaxes(); // Refresh TMs
      closeEditModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update training max');
    } finally {
      setIsSaving(false);
    }
  }

  function formatExerciseName(exercise: string): string {
    const names: Record<string, string> = {
      bench: 'Bench',
      squat: 'Squat',
      ohp: 'OHP',
      deadlift: 'Deadlift',
    };
    return names[exercise] || exercise.charAt(0).toUpperCase() + exercise.slice(1);
  }

  if (isLoading) {
    return <div className="loading">Loading...</div>;
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
                  {tm.weight} {unit}
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
