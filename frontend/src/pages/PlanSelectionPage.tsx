import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getPlans, subscribeToPlan, type WorkoutPlan } from '../api/plans';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import './PlanSelectionPage.css';

export default function PlanSelectionPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscribing, setSubscribing] = useState<number | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setIsLoading(true);
    setError('');
    try {
      const data = await getPlans();
      setPlans(data);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectPlan(planId: number) {
    setSubscribing(planId);
    setError('');
    try {
      const result = await subscribeToPlan(planId);

      // If there are missing TMs, navigate to setup with the missing exercises
      if (result.missingTMs.length > 0) {
        navigate('/setup', { state: { missingTMs: result.missingTMs } });
      } else {
        // Otherwise, navigate to dashboard
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to subscribe to plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe to plan');
      setSubscribing(null);
    }
  }

  if (isLoading) {
    return (
      <div className="plan-selection-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="plan-selection-page">
        <ErrorMessage message={error} />
        <button className="retry-button" onClick={loadPlans}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="plan-selection-page">
      <div className="plan-selection-header">
        <h1>Choose a Workout Plan</h1>
        <p>Select a plan that fits your training goals</p>
      </div>

      <div className="plan-list">
        {plans.map((plan) => (
          <div key={plan.id} className="plan-card">
            <div className="plan-card-header">
              <h2>{plan.name}</h2>
              {plan.description && (
                <p className="plan-description">{plan.description}</p>
              )}
              <div className="plan-meta">
                <span className="days-per-week">{plan.daysPerWeek} days/week</span>
              </div>
            </div>

            <div className="plan-days">
              {plan.days.map((day) => (
                <div key={day.id} className="plan-day">
                  <div className="day-label">
                    {day.name || `Day ${day.dayNumber}`}
                  </div>
                  <div className="day-exercises">
                    {day.exercises.map((ex) => (
                      <div key={ex.id} className="exercise-item">
                        <span className="tier-badge">{ex.tier}</span>
                        <span className="exercise-name">
                          {ex.displayName || ex.exercise.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="select-plan-button"
              onClick={() => handleSelectPlan(plan.id)}
              disabled={subscribing !== null}
            >
              {subscribing === plan.id ? 'Subscribing...' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="no-plans">
          <p>No workout plans available at the moment.</p>
        </div>
      )}
    </div>
  );
}
