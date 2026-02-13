import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getAdminPlan, createPlan, updatePlan, setProgressionRules as saveProgressionRules, PlanDayExerciseInput, PlanDayInput, PlanSet, ProgressionRule } from '../../api/adminPlans';
import { getExercises, Exercise } from '../../api/exercises';
import SetSchemeEditorModal from '../../components/SetSchemeEditorModal';
import ProgressionRulesEditor from '../../components/ProgressionRulesEditor';
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
  const isEditMode = Boolean(id);

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

  useEffect(() => {
    loadExercises();
    if (isEditMode) {
      loadPlan();
    } else {
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
          tier: ex.tier,
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
      tier: 'T1',
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
    setDays(days.map(day => {
      if (day.dayNumber !== dayNumber) return day;

      const filtered = day.exercises.filter(ex => ex.tempId !== tempId);
      // Re-number sort orders
      return {
        ...day,
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

  async function handleSave() {
    if (!name.trim()) {
      alert('Plan name is required');
      return;
    }
    if (!slug.trim()) {
      alert('Plan slug is required');
      return;
    }

    // Validate all exercises have at least one set
    for (const day of days) {
      for (const ex of day.exercises) {
        if (ex.sets.length === 0) {
          alert(`Exercise in Day ${day.dayNumber} has no sets defined. Please add sets or remove the exercise.`);
          return;
        }
      }
    }

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
        alert('Plan updated successfully');
      } else {
        const created = await createPlan(payload);
        planId = created.id;
        alert('Plan created successfully');
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
        <button
          className="btn-save-plan"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>

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

        <div className="form-row">
          <label>
            Slug *
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="e.g., nsuns-4day-lp"
            />
          </label>
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
          {days.map((day) => (
            <button
              key={day.dayNumber}
              className={`day-tab ${activeDay === day.dayNumber ? 'day-tab--active' : ''}`}
              onClick={() => setActiveDay(day.dayNumber)}
            >
              Day {day.dayNumber}
            </button>
          ))}
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
                        Tier
                        <select
                          value={ex.tier}
                          onChange={(e) =>
                            updateExerciseField(activeDay, ex.tempId, 'tier', e.target.value)
                          }
                        >
                          <option value="T1">T1</option>
                          <option value="T2">T2</option>
                        </select>
                      </label>

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
                        <span className="warning">⚠️ No sets defined</span>
                      )}
                      <button
                        className="btn-edit-sets"
                        onClick={() => openSetSchemeEditor(activeDay, ex.tempId)}
                      >
                        Edit Sets
                      </button>
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
