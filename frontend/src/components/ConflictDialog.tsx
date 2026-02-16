import { useEffect, useRef } from 'react';
import { Button } from './Button';
import styles from './ConflictDialog.module.css';

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
          <Button onClick={onContinue}>
            Continue Day {existingDayNumber}
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            Discard & Start New
          </Button>
        </div>
      </div>
    </dialog>
  );
}
