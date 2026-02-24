import { useState, useRef, useEffect } from 'react';
import { useNavigate, useBlocker } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import {
  getAdminPlan,
  createPlan,
  updatePlan,
  setProgressionRules as saveProgressionRules,
  PlanDayExerciseInput,
  PlanDayInput,
  PlanSet,
} from '../api/adminPlans';
import { getExercises, Exercise } from '../api/exercises';
import { useToast } from '../components/Toast';

export interface EditorExercise extends PlanDayExerciseInput {
  tempId: string;
}

export interface EditorDay extends Omit<PlanDayInput, 'exercises'> {
  exercises: EditorExercise[];
}

export interface EditorProgressionRule {
  tempId: string;
  exerciseId?: number | null;
  category?: string | null;
  minReps: number;
  maxReps: number;
  increase: number;
}

export interface EditingSets {
  dayNumber: number;
  tempId: string;
  exerciseName: string;
}

export interface RemovingExercise {
  dayNumber: number;
  tempId: string;
  setCount: number;
}

export function usePlanEditorState(planId?: string) {
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

  // Set scheme editor
  const [editingSets, setEditingSets] = useState<EditingSets | null>(null);

  // Loading/error states
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isDirty, setIsDirtyState] = useState(false);
  const isDirtyRef = useRef(false);
  const [removingExercise, setRemovingExercise] = useState<RemovingExercise | null>(null);
  const [metadataCollapsed, setMetadataCollapsed] = useState(isEditMode);

  function setIsDirty(value: boolean) {
    isDirtyRef.current = value;
    setIsDirtyState(value);
  }

  const blocker = useBlocker({ shouldBlockFn: () => isDirtyRef.current, withResolver: true });

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
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

      const editorRules: EditorProgressionRule[] = plan.progressionRules.map((rule, idx) => ({
        tempId: rule.id ? `rule-${rule.id}` : `rule-${Date.now()}-${idx}`,
        exerciseId: rule.exerciseId,
        category: rule.category,
        minReps: rule.minReps,
        maxReps: rule.maxReps,
        increase: Number(rule.increase),
      }));
      setProgressionRules(editorRules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan');
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

  function handleResetSlug() {
    setSlugManuallyEdited(false);
    setSlug(generateSlug(name));
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    setIsDirty(true);
  }

  function handleIsPublicChange(value: boolean) {
    setIsPublic(value);
    setIsDirty(true);
  }

  function handleDaysPerWeekChange(value: number) {
    const newDaysPerWeek = Math.max(1, Math.min(7, value));
    setDaysPerWeek(newDaysPerWeek);
    setIsDirty(true);

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
      tmExerciseId: exercise.id,
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
      const prev = reordered.at(idx - 1);
      const curr = reordered.at(idx);
      if (!prev || !curr) return day;
      reordered[idx - 1] = curr;
      reordered[idx] = prev;

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
      const curr = reordered.at(idx);
      const next = reordered.at(idx + 1);
      if (!curr || !next) return day;
      reordered[idx] = next;
      reordered[idx + 1] = curr;

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

  function handleProgressionRulesChange(rules: EditorProgressionRule[]) {
    setProgressionRules(rules);
    setIsDirty(true);
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
        await queryClient.invalidateQueries({ queryKey: queryKeys.admin.plans() });
        navigate({ to: '/admin/plans/$id', params: { id: String(savedPlanId) } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  return {
    // Metadata
    name,
    slug,
    slugManuallyEdited,
    description,
    daysPerWeek,
    isPublic,
    metadataCollapsed,
    setMetadataCollapsed,
    handleNameChange,
    handleSlugChange,
    handleResetSlug,
    handleDescriptionChange,
    handleIsPublicChange,
    handleDaysPerWeekChange,

    // Days
    days,
    activeDay,
    setActiveDay,
    updateDayName,

    // Exercises
    exercises,
    showExercisePicker,
    setShowExercisePicker,
    exerciseSearch,
    setExerciseSearch,
    addExerciseToDay,
    removeExercise,
    doRemoveExercise,
    updateExerciseField,
    moveExerciseUp,
    moveExerciseDown,
    copySetsFrom,

    // Set scheme editor
    editingSets,
    openSetSchemeEditor,
    saveSetScheme,
    closeSetSchemeEditor,

    // Progression rules
    progressionRules,
    handleProgressionRulesChange,

    // Remove exercise confirmation
    removingExercise,
    setRemovingExercise,

    // Status
    loading,
    saving,
    error,
    validationErrors,
    isEditMode,
    blocker,
    handleSave,
  };
}
