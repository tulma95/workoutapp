import { useState, useEffect, useRef } from 'react';
import { PlanSet } from '../api/adminPlans';
import { ConfirmDialog } from './ConfirmDialog';
import './SetSchemeEditorModal.css';

interface SetSchemeEditorModalProps {
  exerciseName: string;
  initialSets: PlanSet[];
  onSave: (sets: PlanSet[]) => void;
  onClose: () => void;
}

export default function SetSchemeEditorModal({
  exerciseName,
  initialSets,
  onSave,
  onClose,
}: SetSchemeEditorModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sets, setSets] = useState<PlanSet[]>([]);
  const [showProgressionWarning, setShowProgressionWarning] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  useEffect(() => {
    const orderedSets = initialSets
      .map(set => ({ ...set }))
      .sort((a, b) => a.setOrder - b.setOrder)
      .map((set, idx) => ({ ...set, setOrder: idx + 1 }));

    setSets(orderedSets.length > 0 ? orderedSets : []);
  }, [initialSets]);

  function addSet() {
    const lastSet = sets[sets.length - 1];
    const newSet: PlanSet = lastSet
      ? { ...lastSet, setOrder: sets.length + 1, isAmrap: false, isProgression: false }
      : { setOrder: 1, percentage: 0, reps: 0, isAmrap: false, isProgression: false };
    setSets([...sets, newSet]);
  }

  function removeSet(setOrder: number) {
    const filtered = sets.filter(s => s.setOrder !== setOrder);
    const renumbered = filtered.map((s, idx) => ({ ...s, setOrder: idx + 1 }));
    setSets(renumbered);
  }

  function updateSet(setOrder: number, field: keyof PlanSet, value: any) {
    setSets(sets.map(s =>
      s.setOrder === setOrder ? { ...s, [field]: value } : s
    ));
  }

  function handleSave() {
    const progressionCount = sets.filter(s => s.isProgression).length;
    if (progressionCount > 1) {
      setShowProgressionWarning(true);
      return;
    }

    onSave(sets);
  }

  function doSaveWithWarning() {
    setShowProgressionWarning(false);
    onSave(sets);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog className="set-scheme-modal" ref={dialogRef} onClick={handleBackdropClick}>
      <div className="set-scheme-modal__content">
        <div className="set-scheme-header">
          <h3>Edit Set Scheme: {exerciseName}</h3>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        <div className="set-scheme-body">
          {sets.length === 0 ? (
            <div className="sets-empty">
              No sets defined. Click "Add Set" to get started.
            </div>
          ) : (
            <div className="sets-table-container">
              <table className="sets-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>%</th>
                    <th>Reps</th>
                    <th>AMRAP</th>
                    <th title="Mark which set determines training max progression">Prog</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((set) => (
                    <tr key={set.setOrder}>
                      <td className="set-order-cell">{set.setOrder}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round(set.percentage * 100)}
                          onChange={(e) =>
                            updateSet(set.setOrder, 'percentage', (parseFloat(e.target.value) || 0) / 100)
                          }
                          className="percentage-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={set.reps}
                          onChange={(e) =>
                            updateSet(set.setOrder, 'reps', parseInt(e.target.value, 10) || 0)
                          }
                          className="reps-input"
                        />
                      </td>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={set.isAmrap || false}
                          onChange={(e) =>
                            updateSet(set.setOrder, 'isAmrap', e.target.checked)
                          }
                        />
                      </td>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={set.isProgression || false}
                          onChange={(e) =>
                            updateSet(set.setOrder, 'isProgression', e.target.checked)
                          }
                        />
                      </td>
                      <td className="action-cell">
                        <button
                          onClick={() => removeSet(set.setOrder)}
                          className="btn-remove-set"
                          title="Remove set"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="set-scheme-footer">
          <button onClick={addSet} className="btn-add-set">
            + Add Set
          </button>
          <div className="footer-actions">
            <button onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-save">
              Save
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={showProgressionWarning}
          title="Multiple Progression Sets"
          message={`Warning: ${sets.filter(s => s.isProgression).length} sets are marked as progression sets. Typically only one set should be marked for progression. Continue anyway?`}
          confirmLabel="Continue"
          onConfirm={doSaveWithWarning}
          onCancel={() => setShowProgressionWarning(false)}
        />
      </div>
    </dialog>
  );
}
