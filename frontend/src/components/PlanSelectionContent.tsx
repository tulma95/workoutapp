import { type WorkoutPlan } from '../api/plans'
import { type PlanSwitchWarnings, PlanSwitchConfirmModal } from './PlanSwitchConfirmModal'
import { Button } from './Button'
import { ErrorMessage } from './ErrorMessage'
import styles from '../styles/PlanSelectionPage.module.css'

type Props = {
  plans: WorkoutPlan[]
  subscribing: number | null
  error: string
  showModal: boolean
  modalWarnings: PlanSwitchWarnings | null
  pendingPlanId: number | null
  onSelectPlan: (planId: number) => void
  onConfirmSwitch: () => void
  onCancelSwitch: () => void
}

export function PlanSelectionContent({
  plans,
  subscribing,
  error,
  showModal,
  modalWarnings,
  pendingPlanId,
  onSelectPlan,
  onConfirmSwitch,
  onCancelSwitch,
}: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Choose a Workout Plan</h1>
        <p>Select a plan that fits your training goals</p>
      </div>

      {error && (
        <ErrorMessage message={error} />
      )}

      <div className={styles.list}>
        {plans.map((plan) => (
          <div key={plan.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>{plan.name}</h2>
              {plan.description && (
                <p className={styles.description}>{plan.description}</p>
              )}
              <div className={styles.meta}>
                <span className={styles.daysPerWeek}>{plan.daysPerWeek} days/week</span>
              </div>
            </div>

            <div className={styles.days}>
              {plan.days.map((day) => (
                <div key={day.id} className={styles.day}>
                  <div className={styles.dayLabel}>
                    {day.name || `Day ${day.dayNumber}`}
                  </div>
                  <div className={styles.dayExercises}>
                    {day.exercises.map((ex) => (
                      <div key={ex.id} className={styles.exerciseItem}>
                        <span className={styles.exerciseName}>
                          {ex.displayName || ex.exercise.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={() => onSelectPlan(plan.id)}
              disabled={subscribing !== null}
            >
              {subscribing === plan.id ? 'Subscribing...' : 'Select Plan'}
            </Button>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className={styles.noPlans}>
          <p>No workout plans available at the moment.</p>
        </div>
      )}

      {showModal && modalWarnings && pendingPlanId && (
        <PlanSwitchConfirmModal
          targetPlanName={plans.find(p => p.id === pendingPlanId)?.name || 'this plan'}
          warnings={modalWarnings}
          onConfirm={onConfirmSwitch}
          onCancel={onCancelSwitch}
        />
      )}
    </div>
  )
}
