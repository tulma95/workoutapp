import { type Workout, type ProgressionResult } from '../api/workouts'
import SetRow from './SetRow'
import { ProgressionBanner } from './ProgressionBanner'
import { RestTimerBanner } from './RestTimerBanner'
import { Button } from './Button'
import { ButtonLink } from './ButtonLink'
import { ConfirmDialog } from './ConfirmDialog'
import { ErrorMessage } from './ErrorMessage'
import styles from '../styles/WorkoutPage.module.css'

type ActivePhase =
  | { phase: 'active' }
  | { phase: 'completing' }
  | { phase: 'completed'; progressions: ProgressionResult[] }
  | { phase: 'canceling' }
  | { phase: 'error'; message: string }

type Props = {
  workout: Workout
  dayNumber: number
  phase: ActivePhase
  showCompleteConfirm: boolean
  showCancelConfirm: boolean
  onConfirmSet: (setId: number) => void
  onRepsChange: (setId: number, reps: number) => void
  onCompleteWorkout: () => void
  onDoCompleteWorkout: () => void
  onCancelWorkout: () => void
  onDoCancelWorkout: () => void
  onDismissCompleteConfirm: () => void
  onDismissCancelConfirm: () => void
  restTimer: {
    secondsRemaining: number
    totalSeconds: number
    onAdjust: (delta: number) => void
    onSkip: () => void
  } | null
}

export function ActiveWorkoutView({
  workout,
  dayNumber,
  phase,
  showCompleteConfirm,
  showCancelConfirm,
  onConfirmSet,
  onRepsChange,
  onCompleteWorkout,
  onDoCompleteWorkout,
  onCancelWorkout,
  onDoCancelWorkout,
  onDismissCompleteConfirm,
  onDismissCancelConfirm,
  restTimer,
}: Props) {
  if (phase.phase === 'error') {
    return (
      <div className={styles.page}>
        <ErrorMessage message={phase.message} />
        <ButtonLink variant="secondary" to="/">
          Back to Dashboard
        </ButtonLink>
      </div>
    )
  }

  if (phase.phase === 'completed') {
    return (
      <div className={styles.page}>
        <h1>Workout Complete!</h1>
        <ProgressionBanner progressions={phase.progressions} />
        <ButtonLink to="/">Back to Dashboard</ButtonLink>
      </div>
    )
  }

  const exerciseGroups: Array<{ exercise: string; sets: typeof workout.sets }> = []
  for (const set of workout.sets) {
    const last = exerciseGroups[exerciseGroups.length - 1]
    if (last && last.exercise === set.exercise) {
      last.sets.push(set)
    } else {
      exerciseGroups.push({ exercise: set.exercise, sets: [set] })
    }
  }

  return (
    <div className={styles.page}>
      <h1>Day {dayNumber}</h1>

      {restTimer && (
        <RestTimerBanner
          secondsRemaining={restTimer.secondsRemaining}
          totalSeconds={restTimer.totalSeconds}
          onAdjust={restTimer.onAdjust}
          onSkip={restTimer.onSkip}
        />
      )}

      {exerciseGroups.map((group) => (
        <section key={group.exercise} className={styles.section}>
          <h2 className={styles.sectionTitle}>{group.exercise}</h2>
          <div className={styles.sectionSets} data-set-list>
            {group.sets.map((set, index) => (
              <SetRow
                key={set.id}
                setNumber={index + 1}
                weight={set.prescribedWeight}
                reps={set.prescribedReps}
                isAmrap={set.isAmrap}
                completed={set.completed}
                actualReps={set.actualReps}
                onConfirm={() => onConfirmSet(set.id)}
                onRepsChange={(reps) => onRepsChange(set.id, reps)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className={styles.actions}>
        <Button
          size="large"
          onClick={onCompleteWorkout}
          disabled={phase.phase === 'completing' || phase.phase === 'canceling'}
        >
          {phase.phase === 'completing' ? 'Completing...' : 'Complete Workout'}
        </Button>
        <Button
          variant="secondary"
          size="large"
          onClick={onCancelWorkout}
          disabled={phase.phase === 'canceling' || phase.phase === 'completing'}
        >
          {phase.phase === 'canceling' ? 'Canceling...' : 'Cancel Workout'}
        </Button>
      </div>

      <ConfirmDialog
        open={showCompleteConfirm}
        title="Missing Progression Reps"
        message="You haven't entered reps for all progression sets. Complete workout without full progression tracking?"
        confirmLabel="Complete Anyway"
        variant="danger"
        onConfirm={onDoCompleteWorkout}
        onCancel={onDismissCompleteConfirm}
      />

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Workout"
        message="Cancel this workout? All progress will be lost."
        confirmLabel="Cancel Workout"
        variant="danger"
        onConfirm={onDoCancelWorkout}
        onCancel={onDismissCancelConfirm}
      />
    </div>
  )
}
