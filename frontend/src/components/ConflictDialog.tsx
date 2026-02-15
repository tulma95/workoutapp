import { useEffect, useRef } from 'react';
import './ConflictDialog.css';

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
    <dialog ref={dialogRef} className="conflict-dialog" onClick={handleClick}>
      <div className="conflict-dialog__content">
        <h2 className="conflict-dialog__title">Workout in Progress</h2>
        <p className="conflict-dialog__message">
          You have a Day {existingDayNumber} workout in progress. What would you like to do?
        </p>
        <div className="conflict-dialog__actions">
          <button className="btn-primary" onClick={onContinue}>
            Continue Day {existingDayNumber}
          </button>
          <button className="btn-secondary btn-danger" onClick={onDiscard}>
            Discard & Start New
          </button>
        </div>
      </div>
    </dialog>
  );
}
