import { apiFetch, apiFetchParsed } from './client';
import {
  WorkoutSchema,
  WorkoutSetSchema,
  CompleteWorkoutResponseSchema,
  WorkoutHistoryItemSchema,
  WorkoutCalendarResponseSchema,
} from './schemas';

export interface CreateCustomWorkoutPayload {
  date: string;
  exercises: Array<{
    exerciseId: number;
    sets: Array<{
      weight: number;
      reps: number;
    }>;
  }>;
}

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
  return apiFetchParsed('/workouts', WorkoutSchema, {
    method: 'POST',
    body: JSON.stringify({ dayNumber }),
  });
}

export async function getCurrentWorkout(): Promise<typeof WorkoutSchema._output | null> {
  const data = await apiFetch('/workouts/current');
  return data === null ? null : WorkoutSchema.parse(data);
}

export async function getWorkout(id: number): Promise<typeof WorkoutSchema._output> {
  return apiFetchParsed(`/workouts/${id}`, WorkoutSchema);
}

export async function logSet(
  workoutId: number,
  setId: number,
  data: { actualReps?: number | null; completed?: boolean }
): Promise<typeof WorkoutSetSchema._output> {
  return apiFetchParsed(`/workouts/${workoutId}/sets/${setId}`, WorkoutSetSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function completeWorkout(id: number): Promise<typeof CompleteWorkoutResponseSchema._output> {
  return apiFetchParsed(`/workouts/${id}/complete`, CompleteWorkoutResponseSchema, {
    method: 'POST',
  });
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
  return apiFetchParsed(`/workouts/calendar?year=${year}&month=${month}`, WorkoutCalendarResponseSchema);
}

export async function createCustomWorkout(payload: CreateCustomWorkoutPayload): Promise<typeof WorkoutSchema._output> {
  return apiFetchParsed('/workouts/custom', WorkoutSchema, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
