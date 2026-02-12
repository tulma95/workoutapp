import { apiFetch } from './client';
export type {
  WorkoutSet,
  Workout,
  WorkoutHistoryItem,
  CalendarWorkout,
  ProgressionResult,
  CompleteWorkoutResponse,
} from './schemas';

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

export async function cancelWorkout(id: number): Promise<void> {
  return apiFetch(`/workouts/${id}`, {
    method: 'DELETE',
  }) as Promise<void>;
}

export async function getWorkoutCalendar(
  year: number,
  month: number
): Promise<{ workouts: CalendarWorkout[] }> {
  return apiFetch(`/workouts/calendar?year=${year}&month=${month}`) as Promise<{
    workouts: CalendarWorkout[];
  }>;
}
