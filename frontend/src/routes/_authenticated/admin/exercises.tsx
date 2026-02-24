import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import {
  getExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  type Exercise,
  type CreateExerciseInput,
  type UpdateExerciseInput,
} from '../../../api/exercises'
import { ExerciseListContent } from '../../../components/admin/ExerciseListContent'
import { queryKeys } from '../../../api/queryKeys'

export const Route = createFileRoute('/_authenticated/admin/exercises')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: queryKeys.admin.exercises(),
      queryFn: getExercises,
    }),
  component: ExerciseListPage,
})

function ExerciseListPage() {
  const queryClient = useQueryClient()
  const { data: exercises } = useSuspenseQuery({
    queryKey: queryKeys.admin.exercises(),
    queryFn: getExercises,
  })

  const [showModal, setShowModal] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [deletingExercise, setDeletingExercise] = useState<Exercise | null>(null)

  const handleCreate = () => {
    setEditingExercise(null)
    setShowModal(true)
  }

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise)
    setShowModal(true)
  }

  const handleSubmit = async (input: CreateExerciseInput | UpdateExerciseInput) => {
    if (editingExercise) {
      await updateExercise(editingExercise.id, input)
    } else {
      await createExercise(input as CreateExerciseInput)
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.admin.exercises() })
  }

  const handleDelete = async (exercise: Exercise) => {
    setDeletingExercise(exercise)
  }

  const doDelete = async () => {
    if (!deletingExercise) return
    const exercise = deletingExercise
    setDeletingExercise(null)

    try {
      await deleteExercise(exercise.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.exercises() })
    } catch (error: any) {
      setAlertMessage(error.message)
    }
  }

  return (
    <ExerciseListContent
      exercises={exercises}
      showModal={showModal}
      editingExercise={editingExercise}
      alertMessage={alertMessage}
      deletingExercise={deletingExercise}
      onCreate={handleCreate}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onSubmit={handleSubmit}
      onDoDelete={doDelete}
      onCloseModal={() => setShowModal(false)}
      onDismissAlert={() => setAlertMessage(null)}
      onCancelDelete={() => setDeletingExercise(null)}
    />
  )
}
