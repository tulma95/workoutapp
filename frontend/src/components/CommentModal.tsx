import { useEffect, useRef } from 'react';
import { CommentSection } from './CommentSection';
import styles from './CommentModal.module.css';

interface CommentModalProps {
  open: boolean;
  eventId: number;
  eventOwnerId: number;
  commentCount: number;
  currentUserId: number;
  onClose: () => void;
}

export function CommentModal({ open, eventId, eventOwnerId, commentCount, currentUserId, onClose }: CommentModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClick={handleBackdropClick}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.title}>Comments</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close comments"
          >
            ✕
          </button>
        </div>
        <CommentSection eventId={eventId} eventOwnerId={eventOwnerId} commentCount={commentCount} currentUserId={currentUserId} />
      </div>
    </dialog>
  );
}
