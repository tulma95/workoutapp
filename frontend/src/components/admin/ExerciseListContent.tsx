import { type Exercise, type CreateExerciseInput, type UpdateExerciseInput } from '../../api/exercises'
import { ExerciseFormModal } from '../ExerciseFormModal'
import { ConfirmDialog } from '../ConfirmDialog'
import { Button } from '../Button'
import styles from '../../styles/ExerciseListPage.module.css'

interface Props {
  exercises: Exercise[]
  showModal: boolean
  editingExercise: Exercise | null
  alertMessage: string | null
  deletingExercise: Exercise | null
  onCreate: () => void
  onEdit: (exercise: Exercise) => void
  onDelete: (exercise: Exercise) => void
  onSubmit: (input: CreateExerciseInput | UpdateExerciseInput) => Promise<void>
  onDoDelete: () => void
  onCloseModal: () => void
  onDismissAlert: () => void
  onCancelDelete: () => void
}

export function ExerciseListContent({
  exercises,
  showModal,
  editingExercise,
  alertMessage,
  deletingExercise,
  onCreate,
  onEdit,
  onDelete,
  onSubmit,
  onDoDelete,
  onCloseModal,
  onDismissAlert,
  onCancelDelete,
}: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Exercise Library</h1>
        <Button onClick={onCreate}>
          + Add Exercise
        </Button>
      </div>

      {exercises.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No exercises yet. Create your first exercise to get started.</p>
          <Button onClick={onCreate}>
            + Add Exercise
          </Button>
        </div>
      ) : (
        <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Muscle Group</th>
                <th>Category</th>
                <th>Body Region</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((exercise) => (
                <tr key={exercise.id}>
                  <td className={styles.exerciseName}>{exercise.name}</td>
                  <td className={styles.exerciseSlug}>{exercise.slug}</td>
                  <td>{exercise.muscleGroup || '\u2014'}</td>
                  <td>
                    <span className={`${styles.badge} ${exercise.category === 'compound' ? styles.badgeCompound : styles.badgeIsolation}`}>
                      {exercise.category}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${exercise.isUpperBody ? styles.badgeUpper : styles.badgeLower}`}>
                      {exercise.isUpperBody ? 'Upper' : 'Lower'}
                    </span>
                  </td>
                  <td className={styles.exerciseActions}>
                    <button
                      className={styles.btnIcon}
                      onClick={() => onEdit(exercise)}
                      title="Edit"
                    >
                      &#x270F;&#xFE0F;
                    </button>
                    <button
                      className={`${styles.btnIcon} ${styles.btnDanger}`}
                      onClick={() => onDelete(exercise)}
                      title="Delete"
                    >
                      &#x1F5D1;&#xFE0F;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardList}>
          {exercises.map((exercise) => (
            <div key={exercise.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardName}>{exercise.name}</div>
                  <div className={styles.cardSlug}>{exercise.slug}</div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    className={styles.btnIcon}
                    onClick={() => onEdit(exercise)}
                    title="Edit"
                  >
                    &#x270F;&#xFE0F;
                  </button>
                  <button
                    className={`${styles.btnIcon} ${styles.btnDanger}`}
                    onClick={() => onDelete(exercise)}
                    title="Delete"
                  >
                    &#x1F5D1;&#xFE0F;
                  </button>
                </div>
              </div>
              <div className={styles.cardBadges}>
                <span className={`${styles.badge} ${exercise.category === 'compound' ? styles.badgeCompound : styles.badgeIsolation}`}>
                  {exercise.category}
                </span>
                <span className={`${styles.badge} ${exercise.isUpperBody ? styles.badgeUpper : styles.badgeLower}`}>
                  {exercise.isUpperBody ? 'Upper' : 'Lower'}
                </span>
                {exercise.muscleGroup && (
                  <span className={styles.cardMuscle}>{exercise.muscleGroup}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {showModal && (
        <ExerciseFormModal
          exercise={editingExercise}
          onClose={onCloseModal}
          onSubmit={onSubmit}
        />
      )}

      <ConfirmDialog
        open={deletingExercise !== null}
        title="Delete Exercise"
        message={`Are you sure you want to delete "${deletingExercise?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={onDoDelete}
        onCancel={onCancelDelete}
      />

      <ConfirmDialog
        open={alertMessage !== null}
        title="Error"
        message={alertMessage || ''}
        confirmLabel="OK"
        showCancel={false}
        onConfirm={onDismissAlert}
        onCancel={onDismissAlert}
      />
    </div>
  )
}
