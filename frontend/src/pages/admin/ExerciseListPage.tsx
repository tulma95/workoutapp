import { useState, useEffect } from 'react';
import { Exercise, getExercises, createExercise, updateExercise, deleteExercise, CreateExerciseInput, UpdateExerciseInput } from '../../api/exercises';
import { ExerciseFormModal } from '../../components/ExerciseFormModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import './ExerciseListPage.css';

export default function ExerciseListPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [deletingExercise, setDeletingExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    setLoading(true);
    try {
      const data = await getExercises();
      setExercises(data);
    } catch (error: any) {
      setAlertMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingExercise(null);
    setShowModal(true);
  };

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setShowModal(true);
  };

  const handleSubmit = async (input: CreateExerciseInput | UpdateExerciseInput) => {
    if (editingExercise) {
      await updateExercise(editingExercise.id, input);
    } else {
      await createExercise(input as CreateExerciseInput);
    }
    await loadExercises();
  };

  const handleDelete = async (exercise: Exercise) => {
    setDeletingExercise(exercise);
  };

  const doDelete = async () => {
    if (!deletingExercise) return;
    const exercise = deletingExercise;
    setDeletingExercise(null);

    try {
      await deleteExercise(exercise.id);
      await loadExercises();
    } catch (error: any) {
      setAlertMessage(error.message);
    }
  };

  if (loading) {
    return (
      <div className="exercise-list-page">
        <div className="loading">Loading exercises...</div>
      </div>
    );
  }

  return (
    <div className="exercise-list-page">
      <div className="page-header">
        <h1>Exercise Library</h1>
        <button className="btn-primary" onClick={handleCreate}>
          + Add Exercise
        </button>
      </div>

      {exercises.length === 0 ? (
        <div className="empty-state">
          <p>No exercises yet. Create your first exercise to get started.</p>
          <button className="btn-primary" onClick={handleCreate}>
            + Add Exercise
          </button>
        </div>
      ) : (
        <>
        <div className="exercise-table-container">
          <table className="exercise-table">
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
                  <td className="exercise-name">{exercise.name}</td>
                  <td className="exercise-slug">{exercise.slug}</td>
                  <td>{exercise.muscleGroup || '—'}</td>
                  <td>
                    <span className={`badge badge-${exercise.category}`}>
                      {exercise.category}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${exercise.isUpperBody ? 'upper' : 'lower'}`}>
                      {exercise.isUpperBody ? 'Upper' : 'Lower'}
                    </span>
                  </td>
                  <td className="exercise-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleEdit(exercise)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => handleDelete(exercise)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="exercise-card-list">
          {exercises.map((exercise) => (
            <div key={exercise.id} className="exercise-card">
              <div className="exercise-card__header">
                <div>
                  <div className="exercise-card__name">{exercise.name}</div>
                  <div className="exercise-card__slug">{exercise.slug}</div>
                </div>
                <div className="exercise-card__actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleEdit(exercise)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(exercise)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="exercise-card__badges">
                <span className={`badge badge-${exercise.category}`}>
                  {exercise.category}
                </span>
                <span className={`badge badge-${exercise.isUpperBody ? 'upper' : 'lower'}`}>
                  {exercise.isUpperBody ? 'Upper' : 'Lower'}
                </span>
                {exercise.muscleGroup && (
                  <span className="exercise-card__muscle">{exercise.muscleGroup}</span>
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
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmDialog
        open={deletingExercise !== null}
        title="Delete Exercise"
        message={`Are you sure you want to delete "${deletingExercise?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setDeletingExercise(null)}
      />

      <ConfirmDialog
        open={alertMessage !== null}
        title="Error"
        message={alertMessage || ''}
        confirmLabel="OK"
        showCancel={false}
        onConfirm={() => setAlertMessage(null)}
        onCancel={() => setAlertMessage(null)}
      />
    </div>
  );
}
