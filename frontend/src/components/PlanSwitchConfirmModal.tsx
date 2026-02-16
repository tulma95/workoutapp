import { useRef, useEffect } from 'react';
import type { Exercise } from '../api/plans';
import { Button } from './Button';
import styles from './PlanSwitchConfirmModal.module.css';

export interface PlanSwitchWarnings {
  hasInProgressWorkout: boolean;
  newExercises: Exercise[];
  existingExercises: Exercise[];
}

interface PlanSwitchConfirmModalProps {
  targetPlanName: string;
  warnings: PlanSwitchWarnings;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PlanSwitchConfirmModal({
  targetPlanName,
  warnings,
  onConfirm,
  onCancel,
}: PlanSwitchConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();

    const handleCancel = () => onCancel();
    dialog.addEventListener('close', handleCancel);
    return () => dialog.removeEventListener('close', handleCancel);
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  };

  return (
    <dialog className={styles.dialog} ref={dialogRef} onClick={handleBackdropClick}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2>Switch to {targetPlanName}?</h2>
        </div>

        <div className={styles.body}>
          {warnings.hasInProgressWorkout && (
            <div className={`${styles.warning} ${styles.danger}`}>
              <strong>⚠️ Warning:</strong> You have an in-progress workout that will be
              discarded if you switch plans.
            </div>
          )}

          {warnings.newExercises.length > 0 && (
            <div className={styles.warning}>
              <h3>New Exercises (No Training Max)</h3>
              <p>You'll need to set up training maxes for these exercises:</p>
              <ul className={styles.exerciseList}>
                {warnings.newExercises.map((ex) => (
                  <li key={ex.id}>{ex.name}</li>
                ))}
              </ul>
            </div>
          )}

          {warnings.existingExercises.length > 0 && (
            <div className={styles.warning}>
              <h3>Existing Training Maxes</h3>
              <p>Your current training maxes for these exercises will carry over:</p>
              <ul className={styles.exerciseList}>
                {warnings.existingExercises.map((ex) => (
                  <li key={ex.id}>{ex.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Confirm Switch
          </Button>
        </div>
      </div>
    </dialog>
  );
}
