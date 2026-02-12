import { apiFetch } from './client';
import {
  TrainingMaxSchema,
  SetupResponseSchema,
  TrainingMaxHistorySchema,
} from './schemas';
export type {
  TrainingMax,
  OneRepMaxes,
  SetupResponse,
  TrainingMaxHistory,
} from './schemas';

export async function getTrainingMaxes(): Promise<typeof SetupResponseSchema._type> {
  const data = await apiFetch('/training-maxes');
  return SetupResponseSchema.parse(data);
}

export async function setupTrainingMaxes(oneRepMaxes: typeof import('./schemas').OneRepMaxesSchema._type): Promise<typeof SetupResponseSchema._type> {
  const data = await apiFetch('/training-maxes/setup', {
    method: 'POST',
    body: JSON.stringify({ oneRepMaxes }),
  });
  return SetupResponseSchema.parse(data);
}

export async function updateTrainingMax(exercise: string, weight: number): Promise<typeof TrainingMaxSchema._type> {
  const data = await apiFetch(`/training-maxes/${exercise}`, {
    method: 'PATCH',
    body: JSON.stringify({ weight }),
  });
  return TrainingMaxSchema.parse(data);
}

export async function getTrainingMaxHistory(exercise: string): Promise<typeof TrainingMaxHistorySchema._type> {
  const data = await apiFetch(`/training-maxes/${exercise}/history`);
  return TrainingMaxHistorySchema.parse(data);
}
