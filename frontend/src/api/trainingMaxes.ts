import { apiFetchParsed } from './client';
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
  return apiFetchParsed('/training-maxes', SetupResponseSchema);
}

export async function setupTrainingMaxes(oneRepMaxes: typeof import('./schemas').OneRepMaxesSchema._output): Promise<typeof SetupResponseSchema._output> {
  return apiFetchParsed('/training-maxes/setup', SetupResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ oneRepMaxes }),
  });
}

export async function setupTrainingMaxesFromExercises(exerciseTMs: ExerciseTM[]): Promise<typeof SetupResponseSchema._output> {
  return apiFetchParsed('/training-maxes/setup', SetupResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ exerciseTMs }),
  });
}

export async function updateTrainingMax(exercise: string, weight: number, reason?: string): Promise<typeof TrainingMaxSchema._output> {
  return apiFetchParsed(`/training-maxes/${exercise}`, TrainingMaxSchema, {
    method: 'PATCH',
    body: JSON.stringify({ weight, ...(reason ? { reason } : {}) }),
  });
}
