import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getPlans, subscribeToPlan, getCurrentPlan, type WorkoutPlan, type Exercise } from '../api/plans';
import { getCurrentWorkout } from '../api/workouts';
import { getTrainingMaxes } from '../api/trainingMaxes';
import { useAuth } from '../context/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { PlanSwitchConfirmModal, type PlanSwitchWarnings } from '../components/PlanSwitchConfirmModal';
import './PlanSelectionPage.css';

export default function PlanSelectionPage() {
  const navigate = useNavigate();
  const { activePlanId } = useAuth();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);
  const [modalWarnings, setModalWarnings] = useState<PlanSwitchWarnings | null>(null);

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
    // If user already has an active plan, show confirmation modal
    if (activePlanId && activePlanId !== planId) {
      await showSwitchConfirmation(planId);
    } else {
      // No active plan or same plan - subscribe directly
      await subscribeToPlanDirectly(planId);
    }
  }

  async function showSwitchConfirmation(planId: number) {
    setError('');
    try {
      // Gather information for the modal
      const [currentPlan, currentWorkout, trainingMaxes, targetPlan] = await Promise.all([
        getCurrentPlan(),
        getCurrentWorkout(),
        getTrainingMaxes(),
        Promise.resolve(plans.find(p => p.id === planId)),
      ]);

      if (!targetPlan) {
        setError('Selected plan not found');
        return;
      }

      // Extract unique TM exercises from current plan
      const currentExerciseIds = new Set<number>();
      if (currentPlan) {
        currentPlan.days.forEach((day) => {
          day.exercises.forEach((ex) => {
            currentExerciseIds.add(ex.tmExerciseId);
          });
        });
      }

      // Extract unique TM exercises from target plan
      const targetExercises = new Map<number, Exercise>();
      targetPlan.days.forEach((day) => {
        day.exercises.forEach((ex) => {
          targetExercises.set(ex.tmExerciseId, ex.tmExercise);
        });
      });

      // Determine which exercises are new vs existing
      const newExercises: Exercise[] = [];
      const existingExercises: Exercise[] = [];

      targetExercises.forEach((exercise, exerciseId) => {
        if (currentExerciseIds.has(exerciseId)) {
          existingExercises.push(exercise);
        } else {
          newExercises.push(exercise);
        }
      });

      const warnings: PlanSwitchWarnings = {
        hasInProgressWorkout: currentWorkout !== null,
        newExercises,
        existingExercises,
      };

      setPendingPlanId(planId);
      setModalWarnings(warnings);
      setShowModal(true);
    } catch (err) {
      console.error('Failed to check plan switch warnings:', err);
      setError(err instanceof Error ? err.message : 'Failed to check plan compatibility');
    }
  }

  async function confirmPlanSwitch() {
    if (pendingPlanId === null) return;

    setShowModal(false);
    await subscribeToPlanDirectly(pendingPlanId);
    setPendingPlanId(null);
    setModalWarnings(null);
  }

  function cancelPlanSwitch() {
    setShowModal(false);
    setPendingPlanId(null);
    setModalWarnings(null);
  }

  async function subscribeToPlanDirectly(planId: number) {
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

      {showModal && modalWarnings && pendingPlanId && (
        <PlanSwitchConfirmModal
          targetPlanName={plans.find(p => p.id === pendingPlanId)?.name || 'this plan'}
          warnings={modalWarnings}
          onConfirm={confirmPlanSwitch}
          onCancel={cancelPlanSwitch}
        />
      )}
    </div>
  );
}
