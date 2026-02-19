import { apiFetch } from './client';
import {
  TrainingMaxSchema,
  SetupResponseSchema,
} from './schemas';
export type {
  TrainingMax,
  OneRepMaxes,
  SetupResponse,
} from './schemas';

export interface ExerciseTM {
  exerciseId: number;
  oneRepMax: number;
}

export async function getTrainingMaxes(): Promise<typeof SetupResponseSchema._output> {
  const data = await apiFetch('/training-maxes');
  return SetupResponseSchema.parse(data);
}

export async function setupTrainingMaxes(oneRepMaxes: typeof import('./schemas').OneRepMaxesSchema._output): Promise<typeof SetupResponseSchema._output> {
  const data = await apiFetch('/training-maxes/setup', {
    method: 'POST',
    body: JSON.stringify({ oneRepMaxes }),
  });
  return SetupResponseSchema.parse(data);
}

export async function setupTrainingMaxesFromExercises(exerciseTMs: ExerciseTM[]): Promise<typeof SetupResponseSchema._output> {
  const data = await apiFetch('/training-maxes/setup', {
    method: 'POST',
    body: JSON.stringify({ exerciseTMs }),
  });
  return SetupResponseSchema.parse(data);
}

export async function updateTrainingMax(exercise: string, weight: number): Promise<typeof TrainingMaxSchema._output> {
  const data = await apiFetch(`/training-maxes/${exercise}`, {
    method: 'PATCH',
    body: JSON.stringify({ weight }),
  });
  return TrainingMaxSchema.parse(data);
}
