import { useEffect, useRef } from 'react';
import styles from './ConflictDialog.module.css';
import shared from '../styles/shared.module.css';

interface ConflictDialogProps {
  existingDayNumber: number;
  onContinue: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function ConflictDialog({
  existingDayNumber,
  onContinue,
  onDiscard,
  onClose,
}: ConflictDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClick={handleClick}>
      <div className={styles.content}>
        <h2 className={styles.title}>Workout in Progress</h2>
        <p className={styles.message}>
          You have a Day {existingDayNumber} workout in progress. What would you like to do?
        </p>
        <div className={styles.actions}>
          <button className={shared.btnPrimary} onClick={onContinue}>
            Continue Day {existingDayNumber}
          </button>
          <button className={`${shared.btnSecondary} ${shared.btnDanger}`} onClick={onDiscard}>
            Discard & Start New
          </button>
        </div>
      </div>
    </dialog>
  );
}
