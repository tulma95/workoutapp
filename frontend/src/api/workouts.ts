import { apiFetch } from './client';

export interface WorkoutSet {
  id: number;
  workoutId: number;
  exercise: string;
  tier: string;
  setOrder: number;
  prescribedWeight: number;
  prescribedReps: number;
  isAmrap: boolean;
  actualReps: number | null;
  completed: boolean;
  createdAt: string;
}

export interface Workout {
  id: number;
  userId: number;
  dayNumber: number;
  status: string;
  completedAt: string | null;
  createdAt: string;
  sets: WorkoutSet[];
}

export interface WorkoutHistoryItem {
  id: number;
  dayNumber: number;
  status: string;
  completedAt: string | null;
  createdAt: string;
}

export interface ProgressionResult {
  exercise: string;
  previousTM: number;
  newTM: number;
  increase: number;
}

export interface CompleteWorkoutResponse {
  workout: Workout;
  progression: ProgressionResult | null;
}

export async function startWorkout(dayNumber: number): Promise<Workout> {
  return apiFetch('/workouts', {
    method: 'POST',
    body: JSON.stringify({ dayNumber }),
  }) as Promise<Workout>;
}

export async function getCurrentWorkout(): Promise<Workout | null> {
  return apiFetch('/workouts/current') as Promise<Workout | null>;
}

export async function getWorkout(id: number): Promise<Workout> {
  return apiFetch(`/workouts/${id}`) as Promise<Workout>;
}

export async function logSet(
  workoutId: number,
  setId: number,
  data: { actualReps?: number; completed?: boolean }
): Promise<WorkoutSet> {
  return apiFetch(`/workouts/${workoutId}/sets/${setId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }) as Promise<WorkoutSet>;
}

export async function completeWorkout(id: number): Promise<CompleteWorkoutResponse> {
  return apiFetch(`/workouts/${id}/complete`, {
    method: 'POST',
  }) as Promise<CompleteWorkoutResponse>;
}

export async function getWorkoutHistory(
  page: number = 1,
  limit: number = 10
): Promise<WorkoutHistoryItem[]> {
  return apiFetch(`/workouts/history?page=${page}&limit=${limit}`) as Promise<
    WorkoutHistoryItem[]
  >;
}
