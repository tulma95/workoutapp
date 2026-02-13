import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/useAuth';
import { setupTrainingMaxesFromExercises, ExerciseTM } from '../api/trainingMaxes';
import { getCurrentPlan, type Exercise } from '../api/plans';
import { convertToKg } from '../utils/weight';
import { ErrorMessage } from '../components/ErrorMessage';
import './SetupPage.css';

interface LocationState {
  missingTMs?: Exercise[];
}

export default function SetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [requiredExercises, setRequiredExercises] = useState<Exercise[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch required exercises on mount
  useEffect(() => {
    async function loadRequiredExercises() {
      try {
        const state = location.state as LocationState | null;

        // Check if we're in partial setup mode (from plan subscription with missing TMs)
        if (state?.missingTMs && state.missingTMs.length > 0) {
          setRequiredExercises(state.missingTMs);
        } else {
          // Full setup mode: fetch current plan and extract all required exercises
          const plan = await getCurrentPlan();
          if (!plan) {
            setError('No active plan found. Please select a plan first.');
            setIsLoading(false);
            return;
          }

          // Extract unique TM exercises from plan days
          const tmExerciseIds = new Set<number>();
          const tmExercisesMap = new Map<number, Exercise>();

          plan.days.forEach(day => {
            day.exercises.forEach(planExercise => {
              if (!tmExerciseIds.has(planExercise.tmExerciseId)) {
                tmExerciseIds.add(planExercise.tmExerciseId);
                tmExercisesMap.set(planExercise.tmExerciseId, planExercise.tmExercise);
              }
            });
          });

          const exercises = Array.from(tmExercisesMap.values());
          setRequiredExercises(exercises);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exercises');
      } finally {
        setIsLoading(false);
      }
    }

    loadRequiredExercises();
  }, [location.state]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all required exercises have values
    const exerciseTMs: ExerciseTM[] = [];
    for (const exercise of requiredExercises) {
      const value = formData[exercise.id.toString()];
      if (!value) {
        setError('All fields are required');
        return;
      }

      const oneRepMaxInUserUnit = parseFloat(value);
      if (isNaN(oneRepMaxInUserUnit) || oneRepMaxInUserUnit <= 0) {
        setError('All fields must be positive numbers');
        return;
      }

      exerciseTMs.push({
        exerciseId: exercise.id,
        oneRepMax: convertToKg(oneRepMaxInUserUnit, unit),
      });
    }

    setIsLoading(true);

    try {
      await setupTrainingMaxesFromExercises(exerciseTMs);
      // Redirect to dashboard on success
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup training maxes');
    } finally {
      setIsLoading(false);
    }
  };

  const unit = user?.unitPreference || 'kg';

  if (isLoading) {
    return (
      <div className="setup-page">
        <div className="setup-container">
          <p>Loading exercises...</p>
        </div>
      </div>
    );
  }

  if (requiredExercises.length === 0) {
    return (
      <div className="setup-page">
        <div className="setup-container">
          <h1>No Exercises Found</h1>
          <p className="setup-description">
            Please select a workout plan first.
          </p>
          {error && <ErrorMessage message={error} />}
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/select-plan')}
          >
            Select a Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        <h1>Enter Your 1 Rep Maxes</h1>
        <p className="setup-description">
          These will be used to calculate your training maxes (90% of 1RM).
        </p>

        <form onSubmit={handleSubmit} className="setup-form">
          {requiredExercises.map((exercise) => (
            <div key={exercise.id} className="form-group">
              <label htmlFor={`exercise-${exercise.id}`}>
                {exercise.name} ({unit})
              </label>
              <input
                type="number"
                id={`exercise-${exercise.id}`}
                name={exercise.id.toString()}
                value={formData[exercise.id.toString()] || ''}
                onChange={handleInputChange}
                placeholder={`Enter ${exercise.name} 1RM (${unit})`}
                step="0.1"
                min="0"
              />
            </div>
          ))}

          {error && <ErrorMessage message={error} />}

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Calculate Training Maxes'}
          </button>
        </form>
      </div>
    </div>
  );
}
