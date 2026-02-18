import { apiFetch } from './client';
import {
  WorkoutPlanSchema,
  SubscribeResponseSchema,
  type WorkoutPlan,
  type SubscribeResponse,
} from './schemas';
export type { WorkoutPlan, SubscribeResponse, Exercise, PlanDay, PlanDayExercise } from './schemas';

export async function getPlans(): Promise<WorkoutPlan[]> {
  const data = await apiFetch('/plans');
  return (data as unknown[]).map((item) => WorkoutPlanSchema.parse(item));
}

export async function getCurrentPlan(): Promise<WorkoutPlan | null> {
  const data = await apiFetch('/plans/current');
  return data === null ? null : WorkoutPlanSchema.parse(data);
}

export async function subscribeToPlan(planId: number): Promise<SubscribeResponse> {
  const data = await apiFetch(`/plans/${planId}/subscribe`, {
    method: 'POST',
  });
  return SubscribeResponseSchema.parse(data);
}
