import { z } from 'zod';

const ExerciseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  muscleGroup: z.string().nullable(),
  category: z.string(),
  isUpperBody: z.boolean(),
  createdAt: z.string(),
});

export type Exercise = z.infer<typeof ExerciseSchema>;

const ExercisesListSchema = z.array(ExerciseSchema);

export interface CreateExerciseInput {
  slug: string;
  name: string;
  muscleGroup?: string;
  category?: string;
  isUpperBody?: boolean;
}

export interface UpdateExerciseInput {
  slug?: string;
  name?: string;
  muscleGroup?: string;
  category?: string;
  isUpperBody?: boolean;
}

export async function getExercises(): Promise<Exercise[]> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('/api/admin/exercises', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch exercises');
  }

  const data = await response.json();
  return ExercisesListSchema.parse(data);
}

export async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('/api/admin/exercises', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create exercise');
  }

  const data = await response.json();
  return ExerciseSchema.parse(data);
}

export async function updateExercise(id: number, input: UpdateExerciseInput): Promise<Exercise> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api/admin/exercises/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update exercise');
  }

  const data = await response.json();
  return ExerciseSchema.parse(data);
}

export async function deleteExercise(id: number): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api/admin/exercises/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete exercise');
  }
}
