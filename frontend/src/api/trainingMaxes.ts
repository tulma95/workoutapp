import { apiFetch } from './client';
export type {
  TrainingMax,
  OneRepMaxes,
  SetupResponse,
  TrainingMaxHistory,
} from './schemas';

export async function getTrainingMaxes(): Promise<TrainingMax[]> {
  return apiFetch('/training-maxes') as Promise<TrainingMax[]>;
}

export async function setupTrainingMaxes(oneRepMaxes: OneRepMaxes): Promise<TrainingMax[]> {
  return apiFetch('/training-maxes/setup', {
    method: 'POST',
    body: JSON.stringify({ oneRepMaxes }),
  }) as Promise<TrainingMax[]>;
}

export async function updateTrainingMax(exercise: string, weight: number): Promise<TrainingMax> {
  return apiFetch(`/training-maxes/${exercise}`, {
    method: 'PATCH',
    body: JSON.stringify({ weight }),
  }) as Promise<TrainingMax>;
}

export async function getTrainingMaxHistory(exercise: string): Promise<TrainingMax[]> {
  return apiFetch(`/training-maxes/${exercise}/history`) as Promise<TrainingMax[]>;
}
