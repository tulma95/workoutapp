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
  return (
    <div className="conflict-dialog-overlay" onClick={onClose}>
      <div className="conflict-dialog" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}
