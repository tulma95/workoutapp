import { usePlanEditorState } from '../../hooks/usePlanEditorState';
import { ProgressionRule } from '../../api/adminPlans';
import PlanMetadataForm from '../../components/admin/PlanMetadataForm';
import PlanDayEditor from '../../components/admin/PlanDayEditor';
import SetSchemeEditorModal from '../../components/SetSchemeEditorModal';
import ProgressionRulesEditor from '../../components/ProgressionRulesEditor';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import styles from '../../styles/PlanEditorPage.module.css';

export default function PlanEditorPage({ planId }: { planId?: string }) {
  const state = usePlanEditorState(planId);

  if (state.loading) {
    return <div className={styles.loading}>Loading plan...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>{state.isEditMode ? 'Edit Plan' : 'Create New Plan'}</h2>
      </div>

      {state.validationErrors.length > 0 && (
        <div className={styles.validationErrors} data-testid="validation-errors">
          <strong>Please fix the following errors:</strong>
          <ul>
            {state.validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      {state.error && <div className={styles.error}>{state.error}</div>}

      <PlanMetadataForm
        name={state.name}
        slug={state.slug}
        slugManuallyEdited={state.slugManuallyEdited}
        description={state.description}
        daysPerWeek={state.daysPerWeek}
        isPublic={state.isPublic}
        collapsed={state.metadataCollapsed}
        onToggleCollapsed={() => state.setMetadataCollapsed(!state.metadataCollapsed)}
        onNameChange={state.handleNameChange}
        onSlugChange={state.handleSlugChange}
        onResetSlug={state.handleResetSlug}
        onDescriptionChange={state.handleDescriptionChange}
        onDaysPerWeekChange={state.handleDaysPerWeekChange}
        onIsPublicChange={state.handleIsPublicChange}
      />

      <PlanDayEditor
        days={state.days}
        activeDay={state.activeDay}
        exercises={state.exercises}
        showExercisePicker={state.showExercisePicker}
        exerciseSearch={state.exerciseSearch}
        onActiveDayChange={state.setActiveDay}
        onDayNameChange={state.updateDayName}
        onShowExercisePicker={state.setShowExercisePicker}
        onExerciseSearchChange={state.setExerciseSearch}
        onAddExercise={state.addExerciseToDay}
        onRemoveExercise={state.removeExercise}
        onMoveExerciseUp={state.moveExerciseUp}
        onMoveExerciseDown={state.moveExerciseDown}
        onUpdateExerciseField={state.updateExerciseField}
        onOpenSetSchemeEditor={state.openSetSchemeEditor}
        onCopySetsFrom={state.copySetsFrom}
      />

      <ProgressionRulesEditor
        initialRules={state.progressionRules as ProgressionRule[]}
        exercises={state.exercises}
        onChange={state.handleProgressionRulesChange}
      />

      <div className={styles.stickySaveBar}>
        <button
          className={styles.saveBtn}
          onClick={state.handleSave}
          disabled={state.saving}
        >
          {state.saving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>

      {state.editingSets && (
        <SetSchemeEditorModal
          exerciseName={state.editingSets.exerciseName}
          initialSets={
            state.days
              .find(d => d.dayNumber === state.editingSets!.dayNumber)
              ?.exercises.find(ex => ex.tempId === state.editingSets!.tempId)
              ?.sets || []
          }
          onSave={state.saveSetScheme}
          onClose={state.closeSetSchemeEditor}
        />
      )}

      <ConfirmDialog
        open={state.removingExercise !== null}
        title="Delete Exercise"
        message={`This exercise has ${state.removingExercise?.setCount ?? 0} sets configured. Delete it?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (state.removingExercise) {
            state.doRemoveExercise(state.removingExercise.dayNumber, state.removingExercise.tempId);
          }
        }}
        onCancel={() => state.setRemovingExercise(null)}
      />

      {state.blocker.status === 'blocked' && (
        <div
          className={styles.unsavedModal}
          onClick={() => state.blocker.reset()}
          data-testid="unsaved-modal"
        >
          <div className={styles.unsavedModalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Unsaved Changes</h3>
            <p>You have unsaved changes. Leave without saving?</p>
            <div className={styles.unsavedModalActions}>
              <button className={styles.stayBtn} onClick={() => state.blocker.reset()}>
                Stay
              </button>
              <button className={styles.leaveBtn} onClick={() => state.blocker.proceed()}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
