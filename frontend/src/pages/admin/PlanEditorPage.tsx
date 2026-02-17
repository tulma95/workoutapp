import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useBlocker } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { getAdminPlan, createPlan, updatePlan, setProgressionRules as saveProgressionRules, PlanDayExerciseInput, PlanDayInput, PlanSet, ProgressionRule } from '../../api/adminPlans';
import { getExercises, Exercise } from '../../api/exercises';
import SetSchemeEditorModal from '../../components/SetSchemeEditorModal';
import ProgressionRulesEditor from '../../components/ProgressionRulesEditor';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import styles from '../../styles/PlanEditorPage.module.css';

interface EditorExercise extends PlanDayExerciseInput {
  tempId: string; // for React keys before saving
}

interface EditorDay extends Omit<PlanDayInput, 'exercises'> {
  exercises: EditorExercise[];
}

interface EditorProgressionRule {
  tempId: string;
  exerciseId?: number;
  category?: string;
  minReps: number;
  maxReps: number;
  increase: number;
}

export default function PlanEditorPage({ planId }: { planId?: string }) {
  const id = planId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEditMode = Boolean(id);
  const initialized = useRef(false);

  // Plan metadata
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [isPublic, setIsPublic] = useState(true);

  // Days and exercises
  const [days, setDays] = useState<EditorDay[]>([]);
  const [activeDay, setActiveDay] = useState(1);

  // Progression rules
  const [progressionRules, setProgressionRules] = useState<EditorProgressionRule[]>([]);

  // Exercise library
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Exercise picker dialog
  const exercisePickerRef = useRef<HTMLDialogElement>(null);

  // Set scheme editor
  const [editingSets, setEditingSets] = useState<{
    dayNumber: number;
    tempId: string;
    exerciseName: string;
  } | null>(null);

  // Loading/error states
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isDirty, setIsDirtyState] = useState(false);
  const isDirtyRef = useRef(false);
  const [removingExercise, setRemovingExercise] = useState<{ dayNumber: number; tempId: string; setCount: number } | null>(null);
  const [metadataCollapsed, setMetadataCollapsed] = useState(isEditMode);

  function setIsDirty(value: boolean) {
    isDirtyRef.current = value;
    setIsDirtyState(value);
  }

  const blocker = useBlocker({ shouldBlockFn: () => isDirtyRef.current, withResolver: true });

  useEffect(() => {
    const dialog = exercisePickerRef.current;
    if (!dialog) return;

    if (showExercisePicker) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [showExercisePicker]);

  useEffect(() => {
    const dialog = exercisePickerRef.current;
    if (!dialog) return;

    const handleClose = () => setShowExercisePicker(false);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  useEffect(() => {
    loadExercises();
    if (isEditMode) {
      loadPlan();
    } else if (!initialized.current) {
      initialized.current = true;
      initializeNewPlan();
    }
  }, [id]);

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  async function loadExercises() {
    try {
      const data = await getExercises();
      setExercises(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load exercises');
    }
  }

  async function loadPlan() {
    if (!id) return;

    setLoading(true);
    try {
      const plan = await getAdminPlan(parseInt(id, 10));
      setName(plan.name);
      setSlug(plan.slug);
      setSlugManuallyEdited(true);
      setDescription(plan.description || '');
      setDaysPerWeek(plan.daysPerWeek);
      setIsPublic(plan.isPublic);

      // Convert loaded plan to editor format
      const editorDays: EditorDay[] = plan.days.map(day => ({
        dayNumber: day.dayNumber,
        name: day.name || undefined,
        exercises: day.exercises.map(ex => ({
          tempId: `ex-${ex.id}`,
          exerciseId: ex.exerciseId,
          sortOrder: ex.sortOrder,
          tmExerciseId: ex.tmExerciseId,
          displayName: ex.displayName || undefined,
          sets: ex.sets.map(set => ({
            setOrder: set.setOrder,
            percentage: Number(set.percentage),
            reps: set.reps,
            isAmrap: set.isAmrap,
            isProgression: set.isProgression,
          })),
        })),
      }));
      setDays(editorDays);

      // Convert progression rules
      const editorRules: EditorProgressionRule[] = plan.progressionRules.map((rule, idx) => ({
        tempId: rule.id ? `rule-${rule.id}` : `rule-${Date.now()}-${idx}`,
        exerciseId: rule.exerciseId,
        category: rule.category,
        minReps: rule.minReps,
        maxReps: rule.maxReps,
        increase: Number(rule.increase),
      }));
      setProgressionRules(editorRules);
    } catch (err: any) {
      setError(err.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }

  function initializeNewPlan() {
    const initialDays: EditorDay[] = [];
    for (let i = 1; i <= 4; i++) {
      initialDays.push({
        dayNumber: i,
        name: `Day ${i}`,
        exercises: [],
      });
    }
    setDays(initialDays);
  }

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function handleNameChange(value: string) {
    setName(value);
    setIsDirty(true);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugManuallyEdited(true);
    setIsDirty(true);
  }

  function handleDaysPerWeekChange(value: number) {
    const newDaysPerWeek = Math.max(1, Math.min(7, value));
    setDaysPerWeek(newDaysPerWeek);
    setIsDirty(true);

    // Adjust days array
    if (newDaysPerWeek > days.length) {
      const newDays = [...days];
      for (let i = days.length + 1; i <= newDaysPerWeek; i++) {
        newDays.push({
          dayNumber: i,
          name: `Day ${i}`,
          exercises: [],
        });
      }
      setDays(newDays);
    } else if (newDaysPerWeek < days.length) {
      setDays(days.slice(0, newDaysPerWeek));
      if (activeDay > newDaysPerWeek) {
        setActiveDay(newDaysPerWeek);
      }
    }
  }

  function updateDayName(dayNumber: number, value: string) {
    setDays(days.map(day =>
      day.dayNumber === dayNumber ? { ...day, name: value } : day
    ));
    setIsDirty(true);
  }

  function addExerciseToDay(exercise: Exercise) {
    const currentDay = days.find(d => d.dayNumber === activeDay);
    if (!currentDay) return;

    const newExercise: EditorExercise = {
      tempId: `ex-${Date.now()}-${Math.random()}`,
      exerciseId: exercise.id,
      sortOrder: currentDay.exercises.length + 1,
      tmExerciseId: exercise.id, // default to same exercise
      sets: [],
    };

    setDays(days.map(day =>
      day.dayNumber === activeDay
        ? { ...day, exercises: [...day.exercises, newExercise] }
        : day
    ));

    setShowExercisePicker(false);
    setExerciseSearch('');
    setIsDirty(true);
  }

  function removeExercise(dayNumber: number, tempId: string) {
    const day = days.find(d => d.dayNumber === dayNumber);
    const exercise = day?.exercises.find(ex => ex.tempId === tempId);

    if (exercise && exercise.sets.length > 0) {
      setRemovingExercise({ dayNumber, tempId, setCount: exercise.sets.length });
      return;
    }

    doRemoveExercise(dayNumber, tempId);
  }

  function doRemoveExercise(dayNumber: number, tempId: string) {
    setRemovingExercise(null);
    setDays(days.map(d => {
      if (d.dayNumber !== dayNumber) return d;

      const filtered = d.exercises.filter(ex => ex.tempId !== tempId);
      return {
        ...d,
        exercises: filtered.map((ex, idx) => ({ ...ex, sortOrder: idx + 1 })),
      };
    }));
    setIsDirty(true);
  }

  function updateExerciseField(
    dayNumber: number,
    tempId: string,
    field: keyof EditorExercise,
    value: any
  ) {
    setDays(days.map(day => {
      if (day.dayNumber !== dayNumber) return day;
      return {
        ...day,
        exercises: day.exercises.map(ex =>
          ex.tempId === tempId ? { ...ex, [field]: value } : ex
        ),
      };
    }));
    setIsDirty(true);
  }

  function moveExerciseUp(dayNumber: number, tempId: string) {
    setDays(days.map(day => {
      if (day.dayNumber !== dayNumber) return day;

      const idx = day.exercises.findIndex(ex => ex.tempId === tempId);
      if (idx <= 0) return day;

      const reordered = [...day.exercises];
      [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];

      return {
        ...day,
        exercises: reordered.map((ex, i) => ({ ...ex, sortOrder: i + 1 })),
      };
    }));
    setIsDirty(true);
  }

  function moveExerciseDown(dayNumber: number, tempId: string) {
    setDays(days.map(day => {
      if (day.dayNumber !== dayNumber) return day;

      const idx = day.exercises.findIndex(ex => ex.tempId === tempId);
      if (idx < 0 || idx >= day.exercises.length - 1) return day;

      const reordered = [...day.exercises];
      [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];

      return {
        ...day,
        exercises: reordered.map((ex, i) => ({ ...ex, sortOrder: i + 1 })),
      };
    }));
    setIsDirty(true);
  }

  function openSetSchemeEditor(dayNumber: number, tempId: string) {
    const day = days.find(d => d.dayNumber === dayNumber);
    const exercise = day?.exercises.find(ex => ex.tempId === tempId);
    if (!exercise) return;

    const exerciseData = exercises.find(e => e.id === exercise.exerciseId);
    if (!exerciseData) return;

    setEditingSets({
      dayNumber,
      tempId,
      exerciseName: exerciseData.name,
    });
  }

  function saveSetScheme(sets: PlanSet[]) {
    if (!editingSets) return;

    const { dayNumber, tempId } = editingSets;

    setDays(days.map(day => {
      if (day.dayNumber !== dayNumber) return day;

      return {
        ...day,
        exercises: day.exercises.map(ex =>
          ex.tempId === tempId ? { ...ex, sets } : ex
        ),
      };
    }));

    setEditingSets(null);
    setIsDirty(true);
  }

  function closeSetSchemeEditor() {
    setEditingSets(null);
  }

  function copySetsFrom(dayNumber: number, sourceTempId: string, targetTempId: string) {
    const day = days.find(d => d.dayNumber === dayNumber);
    if (!day) return;
    const source = day.exercises.find(ex => ex.tempId === sourceTempId);
    if (!source) return;

    const copiedSets = source.sets.map(set => ({ ...set }));
    updateExerciseField(dayNumber, targetTempId, 'sets', copiedSets);
  }

  async function handleSave() {
    const errors: string[] = [];

    if (!name.trim()) errors.push('Plan name is required');
    if (!slug.trim()) errors.push('Plan slug is required');

    for (const day of days) {
      for (const ex of day.exercises) {
        if (ex.sets.length === 0) {
          const exerciseData = exercises.find(e => e.id === ex.exerciseId);
          errors.push(`Day ${day.dayNumber}: ${exerciseData?.name || 'Exercise'} has no sets defined`);
        }
      }
    }

    // Only send days that have exercises (backend requires min 1 exercise per day)
    const daysWithExercises = days
      .filter(day => day.exercises.length > 0)
      .map(day => ({
        dayNumber: day.dayNumber,
        name: day.name,
        exercises: day.exercises,
      }));

    if (daysWithExercises.length === 0) {
      errors.push('At least one day must have exercises');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error(`Plan has ${errors.length} validation error${errors.length > 1 ? 's' : ''}`);
      return;
    }
    setValidationErrors([]);

    setSaving(true);
    setError('');

    const payload = {
      slug,
      name,
      description: description || undefined,
      daysPerWeek,
      isPublic,
      days: daysWithExercises,
    };

    try {
      let savedPlanId: number;

      if (isEditMode && id) {
        await updatePlan(parseInt(id, 10), payload);
        savedPlanId = parseInt(id, 10);
        toast.success('Plan updated successfully');
        setIsDirty(false);
      } else {
        const created = await createPlan(payload);
        savedPlanId = created.id;
        toast.success('Plan created successfully');
        setIsDirty(false);
      }

      // Save progression rules if there are any
      if (progressionRules.length > 0) {
        const rulesPayload = progressionRules.map(rule => ({
          exerciseId: rule.exerciseId,
          category: rule.category,
          minReps: rule.minReps,
          maxReps: rule.maxReps,
          increase: rule.increase,
        }));

        await saveProgressionRules(savedPlanId, rulesPayload);
      }

      if (!isEditMode) {
        await queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
        navigate({ to: '/admin/plans/$id', params: { id: String(savedPlanId) } });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  function formatSetSummary(sets: PlanSet[]): string {
    if (sets.length === 0) return '';
    const percentages = sets.map(s => Math.round(s.percentage * 100));
    const minPct = Math.min(...percentages);
    const maxPct = Math.max(...percentages);
    const pctRange = minPct === maxPct ? `${minPct}%` : `${minPct}-${maxPct}%`;
    const amrapSets = sets.filter(s => s.isAmrap);
    const parts = [`${sets.length} sets`, pctRange];
    if (amrapSets.length > 0) {
      parts.push(`AMRAP set ${amrapSets.map(s => s.setOrder).join(', ')}`);
    }
    const progSets = sets.filter(s => s.isProgression);
    if (progSets.length > 0) {
      parts.push('Progression');
    }
    return parts.join(' · ');
  }

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const currentDayData = days.find(d => d.dayNumber === activeDay);

  if (loading) {
    return <div className={styles.loading}>Loading plan...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>{isEditMode ? 'Edit Plan' : 'Create New Plan'}</h2>
      </div>

      {validationErrors.length > 0 && (
        <div className={styles.validationErrors} data-testid="validation-errors">
          <strong>Please fix the following errors:</strong>
          <ul>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}

      <div className={`${styles.metadataSection} ${metadataCollapsed ? styles.metadataCollapsed : ''}`} data-testid="metadata-section" data-collapsed={metadataCollapsed || undefined}>
        <button
          className={styles.metadataToggle}
          onClick={() => setMetadataCollapsed(!metadataCollapsed)}
          data-testid="metadata-toggle"
        >
          <span className={styles.metadataToggleLabel}>
            {metadataCollapsed ? '▸' : '▾'} Plan Details
            {metadataCollapsed && name && (
              <span className={styles.metadataSummary}> — {name} ({daysPerWeek} days/week)</span>
            )}
          </span>
        </button>

        {!metadataCollapsed && (
          <>
            <div className={styles.formRow}>
              <label>
                Plan Name *
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., nSuns 4-Day LP"
                />
              </label>
            </div>

            <div className={`${styles.formRow} ${styles.slugRow}`}>
              <label>
                Slug *
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="e.g., nsuns-4day-lp"
                />
              </label>
              {slugManuallyEdited && (
                <button className={styles.resetSlugBtn} onClick={() => {
                  setSlugManuallyEdited(false);
                  setSlug(generateSlug(name));
                }}>
                  Auto-generate
                </button>
              )}
            </div>

            <div className={styles.formRow}>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
                  placeholder="Describe this workout plan..."
                  rows={3}
                />
              </label>
            </div>

            <div className={styles.formRowInline}>
              <label>
                Days per Week *
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="7"
                  value={daysPerWeek}
                  onChange={(e) => handleDaysPerWeekChange(parseInt(e.target.value, 10))}
                />
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => { setIsPublic(e.target.checked); setIsDirty(true); }}
                />
                <span>Public (visible to users)</span>
              </label>
            </div>
          </>
        )}
      </div>

      <div className={styles.dayTabsSection}>
        <div className={styles.dayTabs}>
          {days.map((day) => {
            const hasExercises = day.exercises.length > 0;
            const allHaveSets = hasExercises && day.exercises.every(ex => ex.sets.length > 0);

            let statusClass = '';
            if (allHaveSets) statusClass = styles.dayTabComplete;
            else if (hasExercises) statusClass = styles.dayTabIncomplete;

            return (
              <button
                key={day.dayNumber}
                className={`${styles.dayTab} ${activeDay === day.dayNumber ? styles.dayTabActive : ''} ${statusClass}`}
                onClick={() => setActiveDay(day.dayNumber)}
                data-testid="day-tab"
                {...(allHaveSets ? { 'data-complete': '' } : hasExercises ? { 'data-incomplete': '' } : {})}
              >
                {day.name && day.name !== `Day ${day.dayNumber}`
                  ? `Day ${day.dayNumber}: ${day.name}`
                  : `Day ${day.dayNumber}`}
                {day.exercises.length > 0 && (
                  <span className={styles.dayTabCount}>({day.exercises.length})</span>
                )}
              </button>
            );
          })}
        </div>

        {currentDayData && (
          <div className={styles.dayEditor}>
            <div className={styles.dayNameInput}>
              <label>
                Day Name
                <input
                  type="text"
                  value={currentDayData.name || ''}
                  onChange={(e) => updateDayName(activeDay, e.target.value)}
                  placeholder={`Day ${activeDay}`}
                />
              </label>
            </div>

            <div className={styles.exercisesSection}>
              <div className={styles.exercisesHeader}>
                <h3>Exercises</h3>
                <button
                  className={styles.addExerciseBtn}
                  onClick={() => setShowExercisePicker(true)}
                >
                  + Add Exercise
                </button>
              </div>

              {currentDayData.exercises.length === 0 && (
                <div className={styles.exercisesEmpty}>
                  No exercises yet. Click "Add Exercise" to get started.
                </div>
              )}

              {currentDayData.exercises.map((ex, idx) => {
                const exercise = exercises.find(e => e.id === ex.exerciseId);
                if (!exercise) return null;

                return (
                  <div key={ex.tempId} className={`${styles.exerciseRow} ${ex.sets.length > 0 ? styles.exerciseRowHasSets : styles.exerciseRowNoSets}`} data-testid="exercise-row">
                    <div className={styles.exerciseRowHeader}>
                      <span className={styles.exerciseName}>{idx + 1}. {exercise.name}</span>
                      <div className={styles.exerciseRowActions}>
                        <button
                          onClick={() => moveExerciseUp(activeDay, ex.tempId)}
                          disabled={idx === 0}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveExerciseDown(activeDay, ex.tempId)}
                          disabled={idx === currentDayData.exercises.length - 1}
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeExercise(activeDay, ex.tempId)}
                          className={styles.removeBtn}
                          title="Remove"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className={styles.exerciseRowFields}>
                      <label>
                        TM Exercise
                        <select
                          value={ex.tmExerciseId}
                          onChange={(e) =>
                            updateExerciseField(
                              activeDay,
                              ex.tempId,
                              'tmExerciseId',
                              parseInt(e.target.value, 10)
                            )
                          }
                        >
                          {exercises.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Display Name (optional)
                        <input
                          type="text"
                          value={ex.displayName || ''}
                          onChange={(e) =>
                            updateExerciseField(activeDay, ex.tempId, 'displayName', e.target.value)
                          }
                          placeholder={exercise.name}
                        />
                      </label>
                    </div>

                    <div className={styles.exerciseSetsInfo}>
                      {ex.sets.length > 0 ? (
                        <span className={styles.setsSummary}>{formatSetSummary(ex.sets)}</span>
                      ) : (
                        <span className={styles.setsWarningBadge}>No sets defined</span>
                      )}
                      <div className={styles.exerciseSetsActions}>
                        <button
                          className={styles.editSetsBtn}
                          onClick={() => openSetSchemeEditor(activeDay, ex.tempId)}
                        >
                          Edit Sets
                        </button>
                        {(() => {
                          const otherWithSets = currentDayData!.exercises.filter(
                            other => other.tempId !== ex.tempId && other.sets.length > 0
                          );
                          if (otherWithSets.length === 0) return null;
                          return (
                            <select
                              className={styles.copySetsSelect}
                              value=""
                              onChange={(e) => {
                                if (e.target.value) copySetsFrom(activeDay, e.target.value, ex.tempId);
                              }}
                            >
                              <option value="">Copy sets from...</option>
                              {otherWithSets.map(other => {
                                const otherExData = exercises.find(e => e.id === other.exerciseId);
                                return (
                                  <option key={other.tempId} value={other.tempId}>
                                    {otherExData?.name || 'Exercise'} ({other.sets.length} sets)
                                  </option>
                                );
                              })}
                            </select>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <dialog
        ref={exercisePickerRef}
        className={styles.pickerDialog}
        onClick={(e) => { if (e.target === exercisePickerRef.current) setShowExercisePicker(false); }}
      >
        <div className={styles.pickerContent}>
          <div className={styles.pickerHeader}>
            <h3>Add Exercise</h3>
            <button onClick={() => setShowExercisePicker(false)}>×</button>
          </div>

          <input
            type="text"
            className={styles.exerciseSearch}
            placeholder="Search exercises..."
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
          />

          <div className={styles.pickerList}>
            {filteredExercises.map((ex) => (
              <button
                key={ex.id}
                className={styles.pickerItem}
                onClick={() => addExerciseToDay(ex)}
                data-testid="exercise-picker-item"
              >
                <div className={styles.pickerItemName}>{ex.name}</div>
                <div className={styles.pickerItemMeta}>
                  {ex.muscleGroup && <span>{ex.muscleGroup}</span>}
                  <span className={styles.exerciseCategory}>{ex.category}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </dialog>

      <ProgressionRulesEditor
        initialRules={progressionRules as ProgressionRule[]}
        exercises={exercises}
        onChange={(rules) => { setProgressionRules(rules); setIsDirty(true); }}
      />

      <div className={styles.stickySaveBar}>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>

      {editingSets && (
        <SetSchemeEditorModal
          exerciseName={editingSets.exerciseName}
          initialSets={
            days
              .find(d => d.dayNumber === editingSets.dayNumber)
              ?.exercises.find(ex => ex.tempId === editingSets.tempId)
              ?.sets || []
          }
          onSave={saveSetScheme}
          onClose={closeSetSchemeEditor}
        />
      )}

      <ConfirmDialog
        open={removingExercise !== null}
        title="Delete Exercise"
        message={`This exercise has ${removingExercise?.setCount ?? 0} sets configured. Delete it?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (removingExercise) doRemoveExercise(removingExercise.dayNumber, removingExercise.tempId);
        }}
        onCancel={() => setRemovingExercise(null)}
      />

      {blocker.status === 'blocked' && (
        <div className={styles.unsavedModal} onClick={() => blocker.reset()} data-testid="unsaved-modal">
          <div className={styles.unsavedModalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Unsaved Changes</h3>
            <p>You have unsaved changes. Leave without saving?</p>
            <div className={styles.unsavedModalActions}>
              <button className={styles.stayBtn} onClick={() => blocker.reset()}>
                Stay
              </button>
              <button className={styles.leaveBtn} onClick={() => blocker.proceed()}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
