import { apiFetch } from './client';
import {
  WorkoutSchema,
  WorkoutSetSchema,
  CompleteWorkoutResponseSchema,
  WorkoutHistoryItemSchema,
  WorkoutCalendarResponseSchema,
} from './schemas';
export type {
  WorkoutSet,
  Workout,
  WorkoutHistoryItem,
  CalendarWorkout,
  ProgressionResult,
  CompleteWorkoutResponse,
  WorkoutCalendarResponse,
  ScheduledDay,
} from './schemas';

export async function startWorkout(dayNumber: number): Promise<typeof WorkoutSchema._output> {
  const data = await apiFetch('/workouts', {
    method: 'POST',
    body: JSON.stringify({ dayNumber }),
  });
  return WorkoutSchema.parse(data);
}

export async function getCurrentWorkout(): Promise<typeof WorkoutSchema._output | null> {
  const data = await apiFetch('/workouts/current');
  return data === null ? null : WorkoutSchema.parse(data);
}

export async function getWorkout(id: number): Promise<typeof WorkoutSchema._output> {
  const data = await apiFetch(`/workouts/${id}`);
  return WorkoutSchema.parse(data);
}

export async function logSet(
  workoutId: number,
  setId: number,
  data: { actualReps?: number | null; completed?: boolean }
): Promise<typeof WorkoutSetSchema._output> {
  const result = await apiFetch(`/workouts/${workoutId}/sets/${setId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return WorkoutSetSchema.parse(result);
}

export async function completeWorkout(id: number): Promise<typeof CompleteWorkoutResponseSchema._output> {
  const data = await apiFetch(`/workouts/${id}/complete`, {
    method: 'POST',
  });
  return CompleteWorkoutResponseSchema.parse(data);
}

export async function getWorkoutHistory(
  page: number = 1,
  limit: number = 10
): Promise<typeof WorkoutHistoryItemSchema._output[]> {
  const data = await apiFetch(`/workouts/history?page=${page}&limit=${limit}`);
  return (data as unknown[]).map((item) => WorkoutHistoryItemSchema.parse(item));
}

export async function cancelWorkout(id: number): Promise<void> {
  await apiFetch(`/workouts/${id}`, {
    method: 'DELETE',
  });
}

export async function getWorkoutCalendar(
  year: number,
  month: number
): Promise<typeof WorkoutCalendarResponseSchema._output> {
  const data = await apiFetch(`/workouts/calendar?year=${year}&month=${month}`);
  return WorkoutCalendarResponseSchema.parse(data);
}
