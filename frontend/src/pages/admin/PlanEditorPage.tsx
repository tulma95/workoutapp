import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getAdminPlan, createPlan, updatePlan, setProgressionRules as saveProgressionRules, PlanDayExerciseInput, PlanDayInput, PlanSet, ProgressionRule } from '../../api/adminPlans';
import { getExercises, Exercise } from '../../api/exercises';
import SetSchemeEditorModal from '../../components/SetSchemeEditorModal';
import ProgressionRulesEditor from '../../components/ProgressionRulesEditor';
import { useToast } from '../../components/Toast';
import './PlanEditorPage.css';

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

export default function PlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  useEffect(() => {
    loadExercises();
    if (isEditMode) {
      loadPlan();
    } else if (!initialized.current) {
      initialized.current = true;
      initializeNewPlan();
    }
  }, [id]);

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
            percentage: set.percentage,
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
        increase: rule.increase,
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
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugManuallyEdited(true);
  }

  function handleDaysPerWeekChange(value: number) {
    const newDaysPerWeek = Math.max(1, Math.min(7, value));
    setDaysPerWeek(newDaysPerWeek);

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
  }

  function removeExercise(dayNumber: number, tempId: string) {
    const day = days.find(d => d.dayNumber === dayNumber);
    const exercise = day?.exercises.find(ex => ex.tempId === tempId);

    if (exercise && exercise.sets.length > 0) {
      const confirmed = window.confirm(
        `This exercise has ${exercise.sets.length} sets configured. Delete it?`
      );
      if (!confirmed) return;
    }

    setDays(days.map(d => {
      if (d.dayNumber !== dayNumber) return d;

      const filtered = d.exercises.filter(ex => ex.tempId !== tempId);
      return {
        ...d,
        exercises: filtered.map((ex, idx) => ({ ...ex, sortOrder: idx + 1 })),
      };
    }));
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
      days: days.map(day => ({
        dayNumber: day.dayNumber,
        name: day.name,
        exercises: day.exercises,
      })),
    };

    try {
      let planId: number;

      if (isEditMode && id) {
        await updatePlan(parseInt(id, 10), payload);
        planId = parseInt(id, 10);
        toast.success('Plan updated successfully');
      } else {
        const created = await createPlan(payload);
        planId = created.id;
        toast.success('Plan created successfully');
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

        await saveProgressionRules(planId, rulesPayload);
      }

      if (!isEditMode) {
        navigate(`/admin/plans/${planId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const currentDayData = days.find(d => d.dayNumber === activeDay);

  if (loading) {
    return <div className="plan-editor-loading">Loading plan...</div>;
  }

  return (
    <div className="plan-editor-page">
      <div className="plan-editor-header">
        <h2>{isEditMode ? 'Edit Plan' : 'Create New Plan'}</h2>
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <strong>Please fix the following errors:</strong>
          <ul>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="plan-editor-error">{error}</div>}

      <div className="plan-metadata-section">
        <div className="form-row">
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

        <div className="form-row slug-row">
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
            <button className="btn-reset-slug" onClick={() => {
              setSlugManuallyEdited(false);
              setSlug(generateSlug(name));
            }}>
              Auto-generate
            </button>
          )}
        </div>

        <div className="form-row">
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this workout plan..."
              rows={3}
            />
          </label>
        </div>

        <div className="form-row-inline">
          <label>
            Days per Week *
            <input
              type="number"
              min="1"
              max="7"
              value={daysPerWeek}
              onChange={(e) => handleDaysPerWeekChange(parseInt(e.target.value, 10))}
            />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>Public (visible to users)</span>
          </label>
        </div>
      </div>

      <div className="day-tabs-section">
        <div className="day-tabs">
          {days.map((day) => {
            const hasExercises = day.exercises.length > 0;
            const allHaveSets = hasExercises && day.exercises.every(ex => ex.sets.length > 0);

            let statusClass = '';
            if (allHaveSets) statusClass = 'day-tab--complete';
            else if (hasExercises) statusClass = 'day-tab--incomplete';

            return (
              <button
                key={day.dayNumber}
                className={`day-tab ${activeDay === day.dayNumber ? 'day-tab--active' : ''} ${statusClass}`}
                onClick={() => setActiveDay(day.dayNumber)}
              >
                {day.name && day.name !== `Day ${day.dayNumber}`
                  ? `Day ${day.dayNumber}: ${day.name}`
                  : `Day ${day.dayNumber}`}
              </button>
            );
          })}
        </div>

        {currentDayData && (
          <div className="day-editor">
            <div className="day-name-input">
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

            <div className="exercises-section">
              <div className="exercises-header">
                <h3>Exercises</h3>
                <button
                  className="btn-add-exercise"
                  onClick={() => setShowExercisePicker(true)}
                >
                  + Add Exercise
                </button>
              </div>

              {currentDayData.exercises.length === 0 && (
                <div className="exercises-empty">
                  No exercises yet. Click "Add Exercise" to get started.
                </div>
              )}

              {currentDayData.exercises.map((ex, idx) => {
                const exercise = exercises.find(e => e.id === ex.exerciseId);
                if (!exercise) return null;

                return (
                  <div key={ex.tempId} className="exercise-row">
                    <div className="exercise-row-header">
                      <span className="exercise-name">{exercise.name}</span>
                      <div className="exercise-row-actions">
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
                          className="btn-remove"
                          title="Remove"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="exercise-row-fields">
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

                    <div className="exercise-sets-info">
                      {ex.sets.length > 0 ? (
                        <span>{ex.sets.length} sets defined</span>
                      ) : (
                        <span className="warning">No sets defined</span>
                      )}
                      <div className="exercise-sets-actions">
                        <button
                          className="btn-edit-sets"
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
                              className="copy-sets-select"
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

      {showExercisePicker && (
        <div className="exercise-picker-modal" onClick={() => setShowExercisePicker(false)}>
          <div className="exercise-picker-content" onClick={(e) => e.stopPropagation()}>
            <div className="exercise-picker-header">
              <h3>Add Exercise</h3>
              <button onClick={() => setShowExercisePicker(false)}>×</button>
            </div>

            <input
              type="text"
              className="exercise-search"
              placeholder="Search exercises..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              autoFocus
            />

            <div className="exercise-picker-list">
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  className="exercise-picker-item"
                  onClick={() => addExerciseToDay(ex)}
                >
                  <div className="exercise-picker-item-name">{ex.name}</div>
                  <div className="exercise-picker-item-meta">
                    {ex.muscleGroup && <span>{ex.muscleGroup}</span>}
                    <span className="exercise-category">{ex.category}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ProgressionRulesEditor
        initialRules={progressionRules as ProgressionRule[]}
        exercises={exercises}
        onChange={setProgressionRules}
      />

      <div className="sticky-save-bar">
        <button
          className="btn-save-plan"
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
    </div>
  );
}
