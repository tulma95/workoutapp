import { useState } from 'react';
import { ProgressionRule } from '../api/adminPlans';
import { Exercise } from '../api/exercises';
import styles from './ProgressionRulesEditor.module.css';

interface EditorRule {
  tempId: string;
  exerciseId?: number;
  category?: string;
  minReps: number;
  maxReps: number;
  increase: number;
}

interface ProgressionRulesEditorProps {
  initialRules: ProgressionRule[];
  exercises: Exercise[];
  onChange: (rules: EditorRule[]) => void;
}

export default function ProgressionRulesEditor({
  initialRules,
  exercises,
  onChange,
}: ProgressionRulesEditorProps) {
  const [rules, setRules] = useState<EditorRule[]>(() => {
    if (initialRules.length === 0) {
      return [];
    }
    return initialRules.map((rule, idx) => ({
      tempId: rule.id ? `rule-${rule.id}` : `rule-${Date.now()}-${idx}`,
      exerciseId: rule.exerciseId,
      category: rule.category,
      minReps: rule.minReps,
      maxReps: rule.maxReps,
      increase: rule.increase,
    }));
  });

  function handleRuleChange(tempId: string, field: keyof EditorRule, value: any) {
    const updated = rules.map((rule) =>
      rule.tempId === tempId ? { ...rule, [field]: value } : rule
    );
    setRules(updated);
    onChange(updated);
  }

  function handleTargetChange(tempId: string, value: string) {
    // value can be: "upper", "lower", or exercise ID number
    const updated = rules.map((rule) => {
      if (rule.tempId !== tempId) return rule;

      if (value === 'upper' || value === 'lower') {
        return { ...rule, exerciseId: undefined, category: value };
      } else {
        const exerciseId = parseInt(value, 10);
        return { ...rule, exerciseId, category: undefined };
      }
    });
    setRules(updated);
    onChange(updated);
  }

  function addRule() {
    const newRule: EditorRule = {
      tempId: `rule-${Date.now()}-${Math.random()}`,
      minReps: 1,
      maxReps: 5,
      increase: 2.5,
    };
    const updated = [...rules, newRule];
    setRules(updated);
    onChange(updated);
  }

  function removeRule(tempId: string) {
    const updated = rules.filter((rule) => rule.tempId !== tempId);
    setRules(updated);
    onChange(updated);
  }

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h3>Progression Rules</h3>
        <button className={styles.addBtn} onClick={addRule}>
          + Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className={styles.empty}>
          No progression rules defined. Click "+ Add Rule" to configure how training maxes increase.
        </div>
      ) : (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Target</th>
              <th>Min Reps</th>
              <th>Max Reps</th>
              <th>TM Increase (kg)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              // Determine current value for the target dropdown
              let targetValue = '';
              if (rule.category) {
                targetValue = rule.category;
              } else if (rule.exerciseId) {
                targetValue = rule.exerciseId.toString();
              }

              return (
                <tr key={rule.tempId}>
                  <td>
                    <select
                      className={styles.targetSelect}
                      value={targetValue}
                      onChange={(e) => handleTargetChange(rule.tempId, e.target.value)}
                    >
                      <option value="">-- Select Target --</option>
                      <optgroup label="Category Rules">
                        <option value="upper">All Upper Body</option>
                        <option value="lower">All Lower Body</option>
                      </optgroup>
                      <optgroup label="Exercise-Specific Rules">
                        {exercises.map((ex) => (
                          <option key={ex.id} value={ex.id.toString()}>
                            {ex.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Min Reps</span>
                    <input
                      type="number"
                      className={styles.repsInput}
                      min="0"
                      value={rule.minReps}
                      onChange={(e) =>
                        handleRuleChange(rule.tempId, 'minReps', parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Max Reps</span>
                    <input
                      type="number"
                      className={styles.repsInput}
                      min="0"
                      value={rule.maxReps}
                      onChange={(e) =>
                        handleRuleChange(rule.tempId, 'maxReps', parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>TM Increase (kg)</span>
                    <input
                      type="number"
                      className={styles.increaseInput}
                      min="0"
                      step="0.5"
                      value={rule.increase}
                      onChange={(e) =>
                        handleRuleChange(rule.tempId, 'increase', parseFloat(e.target.value) || 0)
                      }
                    />
                  </td>
                  <td>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeRule(rule.tempId)}
                      title="Remove rule"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      <div className={styles.info}>
        <p>
          <strong>How it works:</strong> After completing a workout, the app checks the AMRAP reps
          against these rules. Exercise-specific rules take precedence over category rules.
        </p>
      </div>
    </div>
  );
}
