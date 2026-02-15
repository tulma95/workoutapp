import { useState, useEffect } from 'react';
import { PlanSet } from '../api/adminPlans';
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
  const [sets, setSets] = useState<PlanSet[]>([]);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkPercentage, setBulkPercentage] = useState(50);
  const [bulkReps, setBulkReps] = useState(10);

  useEffect(() => {
    // Clone initial sets with proper ordering
    const orderedSets = initialSets
      .map(set => ({ ...set }))
      .sort((a, b) => a.setOrder - b.setOrder)
      .map((set, idx) => ({ ...set, setOrder: idx + 1 }));

    setSets(orderedSets.length > 0 ? orderedSets : []);
  }, [initialSets]);

  function addSet() {
    const newSet: PlanSet = {
      setOrder: sets.length + 1,
      percentage: 0,
      reps: 0,
      isAmrap: false,
      isProgression: false,
    };
    setSets([...sets, newSet]);
  }

  function bulkAddSets() {
    const startOrder = sets.length + 1;
    const newSets: PlanSet[] = [];
    for (let i = 0; i < bulkCount; i++) {
      newSets.push({
        setOrder: startOrder + i,
        percentage: bulkPercentage / 100,
        reps: bulkReps,
        isAmrap: false,
        isProgression: false,
      });
    }
    setSets([...sets, ...newSets]);
  }

  function removeSet(setOrder: number) {
    const filtered = sets.filter(s => s.setOrder !== setOrder);
    // Re-number set orders
    const renumbered = filtered.map((s, idx) => ({ ...s, setOrder: idx + 1 }));
    setSets(renumbered);
  }

  function updateSet(setOrder: number, field: keyof PlanSet, value: any) {
    setSets(sets.map(s =>
      s.setOrder === setOrder ? { ...s, [field]: value } : s
    ));
  }

  function handleSave() {
    // Validation: check for multiple progression sets
    const progressionCount = sets.filter(s => s.isProgression).length;
    if (progressionCount > 1) {
      const confirmed = window.confirm(
        `Warning: Multiple sets (${progressionCount}) are marked as progression sets. ` +
        `Typically only one set should be marked for progression. Continue anyway?`
      );
      if (!confirmed) return;
    }

    onSave(sets);
  }

  return (
    <div className="set-scheme-modal" onClick={onClose}>
      <div className="set-scheme-content" onClick={(e) => e.stopPropagation()}>
        <div className="set-scheme-header">
          <h3>Edit Set Scheme: {exerciseName}</h3>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        <div className="set-scheme-body">
          <div className="bulk-add-row">
            <label>
              Add
              <input type="number" min="1" max="20" value={bulkCount}
                onChange={(e) => setBulkCount(parseInt(e.target.value, 10) || 1)}
                className="bulk-input" />
            </label>
            <label>
              sets at
              <input type="number" min="0" max="100" value={bulkPercentage}
                onChange={(e) => setBulkPercentage(parseInt(e.target.value, 10) || 0)}
                className="bulk-input" />
              %
            </label>
            <label>
              for
              <input type="number" min="1" max="100" value={bulkReps}
                onChange={(e) => setBulkReps(parseInt(e.target.value, 10) || 1)}
                className="bulk-input" />
              reps
            </label>
            <button onClick={bulkAddSets} className="btn-bulk-add">+ Add</button>
          </div>

          {sets.length === 0 ? (
            <div className="sets-empty">
              No sets defined. Click "Add Set" to get started.
            </div>
          ) : (
            <div className="sets-table-container">
              <table className="sets-table">
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>% of TM</th>
                    <th>Reps</th>
                    <th>AMRAP</th>
                    <th title="Mark which set determines training max progression">Progression</th>
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
      </div>
    </div>
  );
}
