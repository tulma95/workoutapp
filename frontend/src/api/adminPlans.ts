import { apiFetch } from './client';
import { WorkoutPlan, Exercise } from './plans';

export interface AdminPlanListItem extends WorkoutPlan {
  subscriberCount: number;
}

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

export interface ProgressionRule {
  id?: number;
  exerciseId?: number;
  category?: string;
  minReps: number;
  maxReps: number;
  increase: number;
  exercise?: Exercise;
}

export interface PlanWithDetails extends WorkoutPlan {
  days: Array<{
    id: number;
    planId: number;
    dayNumber: number;
    name: string | null;
    exercises: Array<{
      id: number;
      planDayId: number;
      exerciseId: number;
      sortOrder: number;
      tmExerciseId: number;
      displayName: string | null;
      exercise: Exercise;
      tmExercise: Exercise;
      sets: Array<{
        id: number;
        planDayExerciseId: number;
        setOrder: number;
        percentage: number;
        reps: number;
        isAmrap: boolean;
        isProgression: boolean;
      }>;
    }>;
  }>;
  progressionRules: ProgressionRule[];
}

export async function getAdminPlans(): Promise<AdminPlanListItem[]> {
  const data = await apiFetch('/admin/plans');
  return data as AdminPlanListItem[];
}

export async function getAdminPlan(planId: number): Promise<PlanWithDetails> {
  const data = await apiFetch(`/admin/plans/${planId}`);
  return data as PlanWithDetails;
}

export async function createPlan(input: CreatePlanInput): Promise<WorkoutPlan> {
  const data = await apiFetch('/admin/plans', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data as WorkoutPlan;
}

export async function updatePlan(planId: number, input: CreatePlanInput): Promise<WorkoutPlan> {
  const data = await apiFetch(`/admin/plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return data as WorkoutPlan;
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
