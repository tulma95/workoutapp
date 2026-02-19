import { z } from 'zod';
import { apiFetch } from './client';

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

const PublicExerciseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  muscleGroup: z.string().nullable(),
  category: z.string(),
  isUpperBody: z.boolean(),
});

export type PublicExercise = z.infer<typeof PublicExerciseSchema>;

const PublicExercisesListSchema = z.array(PublicExerciseSchema);

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
  const data = await apiFetch('/admin/exercises');
  return ExercisesListSchema.parse(data);
}

export async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
  const data = await apiFetch('/admin/exercises', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return ExerciseSchema.parse(data);
}

export async function updateExercise(id: number, input: UpdateExerciseInput): Promise<Exercise> {
  const data = await apiFetch(`/admin/exercises/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return ExerciseSchema.parse(data);
}

export async function deleteExercise(id: number): Promise<void> {
  await apiFetch(`/admin/exercises/${id}`, {
    method: 'DELETE',
  });
}

export async function getExerciseList(): Promise<PublicExercise[]> {
  const data = await apiFetch('/exercises');
  return PublicExercisesListSchema.parse(data);
}
