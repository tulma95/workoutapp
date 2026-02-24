import { apiFetch, apiFetchParsed } from './client';
import {
  WorkoutPlanBasicSchema,
  AdminPlanListItemSchema,
  PlanWithDetailsSchema,
  type AdminPlanListItem,
  type PlanWithDetails,
  type ProgressionRule,
} from './schemas';
export type { AdminPlanListItem, PlanWithDetails, ProgressionRule } from './schemas';

export interface PlanSet {
  setOrder: number;
  percentage: number;
  reps: number;
  isAmrap?: boolean;
  isProgression?: boolean;
}

export interface PlanDayExerciseInput {
  exerciseId: number;
  sortOrder: number;
  tmExerciseId: number;
  displayName?: string;
  sets: PlanSet[];
}

export interface PlanDayInput {
  dayNumber: number;
  name?: string;
  exercises: PlanDayExerciseInput[];
}

export interface CreatePlanInput {
  slug: string;
  name: string;
  description?: string;
  daysPerWeek: number;
  isPublic?: boolean;
  days: PlanDayInput[];
}

export async function getAdminPlans(): Promise<AdminPlanListItem[]> {
  const data = await apiFetch('/admin/plans');
  return (data as unknown[]).map((item) => AdminPlanListItemSchema.parse(item));
}

export async function getAdminPlan(planId: number): Promise<PlanWithDetails> {
  return apiFetchParsed(`/admin/plans/${planId}`, PlanWithDetailsSchema);
}

export async function createPlan(input: CreatePlanInput): Promise<{ id: number }> {
  return apiFetchParsed('/admin/plans', WorkoutPlanBasicSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updatePlan(planId: number, input: CreatePlanInput): Promise<void> {
  await apiFetch(`/admin/plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function archivePlan(planId: number): Promise<void> {
  await apiFetch(`/admin/plans/${planId}`, {
    method: 'DELETE',
  });
}

export async function setProgressionRules(
  planId: number,
  rules: Omit<ProgressionRule, 'id' | 'exercise'>[]
): Promise<void> {
  await apiFetch(`/admin/plans/${planId}/progression-rules`, {
    method: 'POST',
    body: JSON.stringify({ rules }),
  });
}
