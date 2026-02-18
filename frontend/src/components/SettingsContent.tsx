import { Button } from './Button'
import { ButtonLink } from './ButtonLink'
import { formatExerciseName, formatWeight } from '../utils/weight'
import styles from '../styles/SettingsPage.module.css'
import type { RefObject } from 'react'
import type { User } from '../api/schemas'
import type { WorkoutPlan } from '../api/plans'
import type { TrainingMax } from '../api/trainingMaxes'

type Props = {
  user: User
  currentPlan: WorkoutPlan | null
  trainingMaxes: TrainingMax[]
  editingExercise: string | null
  editValue: string
  tmSaving: boolean
  tmError: string
  dialogRef: RefObject<HTMLDialogElement | null>
  onOpenEditModal: (exercise: string, currentWeight: number) => void
  onCloseEditModal: () => void
  onEditValueChange: (value: string) => void
  onTmSave: () => void
  onLogout: () => void
}

export function SettingsContent({
  user,
  currentPlan,
  trainingMaxes,
  editingExercise,
  editValue,
  tmSaving,
  tmError,
  dialogRef,
  onOpenEditModal,
  onCloseEditModal,
  onEditValueChange,
  onTmSave,
  onLogout,
}: Props) {
  return (
    <div>
      <h2>Settings</h2>

      <div className={styles.card}>
        <p className={styles.cardLabel}>Current Plan</p>
        {currentPlan ? (
          <>
            <p className={styles.cardTitle}>{currentPlan.name}</p>
            {currentPlan.description && (
              <p className={styles.cardMeta}>{currentPlan.description}</p>
            )}
            <ButtonLink
              variant="secondary"
              to="/select-plan"
              className={styles.changePlanLink}
            >
              Change Plan
            </ButtonLink>
          </>
        ) : (
          <>
            <p className={styles.cardMeta}>No plan selected</p>
            <ButtonLink to="/select-plan">Browse Plans</ButtonLink>
          </>
        )}
      </div>

      <div className={styles.card}>
        <p className={styles.cardSubLabel}>Display Name</p>
        <p className={styles.cardValue}>{user?.displayName}</p>
      </div>

      <div className={styles.card}>
        <p className={styles.cardSubLabel}>Email</p>
        <p className={styles.cardValue}>{user?.email}</p>
      </div>

      {trainingMaxes.length > 0 && (
        <section className={styles.tmSection}>
          <h3>Training Maxes</h3>
          <div className={styles.tmList}>
            {trainingMaxes.map((tm: TrainingMax) => (
              <div
                key={tm.exercise}
                className={styles.tmItem}
                data-testid="tm-item"
              >
                <div className={styles.tmInfo}>
                  <span className={styles.tmExercise}>
                    {formatExerciseName(tm.exercise)}
                  </span>
                  <span className={styles.tmWeight}>
                    {formatWeight(tm.weight)}
                  </span>
                </div>
                <button
                  className={styles.editBtn}
                  onClick={() => onOpenEditModal(tm.exercise, tm.weight)}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Button
        variant="secondary"
        className={styles.logoutBtn}
        onClick={onLogout}
      >
        Log Out
      </Button>

      <dialog
        ref={dialogRef}
        className={styles.editDialog}
        onClick={(e) => {
          if (e.target === dialogRef.current) onCloseEditModal()
        }}
      >
        <div className={styles.editDialogContent}>
          <h3>
            Edit {editingExercise ? formatExerciseName(editingExercise) : ''}
          </h3>

          <div className={styles.editDialogBody}>
            <label htmlFor="tm-input">Training Max (kg)</label>
            <input
              id="tm-input"
              type="number"
              inputMode="decimal"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              step="0.1"
              min="0"
              autoFocus
            />
            {tmError && (
              <p className={styles.editDialogError} role="alert">
                {tmError}
              </p>
            )}
          </div>

          <div className={styles.editDialogActions}>
            <Button
              variant="secondary"
              onClick={onCloseEditModal}
              disabled={tmSaving}
            >
              Cancel
            </Button>
            <Button onClick={onTmSave} disabled={tmSaving}>
              {tmSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
