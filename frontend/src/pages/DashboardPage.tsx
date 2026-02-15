import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getTrainingMaxes, type TrainingMax } from '../api/trainingMaxes';
import { getCurrentWorkout } from '../api/workouts';
import { getCurrentPlan, type WorkoutPlan } from '../api/plans';
import { useAuth } from '../context/useAuth';
import WorkoutCard from '../components/WorkoutCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { activePlanId, isLoading: authLoading } = useAuth();
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [trainingMaxes, setTrainingMaxes] = useState<TrainingMax[]>([]);
  const [currentWorkout, setCurrentWorkout] = useState<{ dayNumber: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
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
    </div>
  );
}
