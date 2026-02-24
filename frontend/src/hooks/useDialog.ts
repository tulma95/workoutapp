import { useEffect, useRef } from 'react';

/**
 * Manages the lifecycle of a native <dialog> element with an open-prop pattern.
 *
 * Two effects are kept intentionally separate:
 * 1. `[dialogRef, open]` — syncs showModal()/close() when the open prop changes.
 * 2. `[dialogRef]` only — attaches the 'close' event listener once for the element's
 *    lifetime. The listener reads onClose from a ref so it always calls the latest
 *    version without requiring callers to wrap onClose in useCallback.
 *
 * Usage:
 *   const dialogRef = useRef<HTMLDialogElement>(null);
 *   useDialog(dialogRef, open, onClose);
 */
export function useDialog(
  dialogRef: React.RefObject<HTMLDialogElement | null>,
  open: boolean,
  onClose: () => void
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [dialogRef, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [dialogRef]);
}
