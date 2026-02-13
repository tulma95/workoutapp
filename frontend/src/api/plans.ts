import { apiFetch } from './client';

export interface Exercise {
  id: number;
  slug: string;
  name: string;
  muscleGroup: string | null;
  category: string;
  isUpperBody: boolean;
}

export interface PlanDayExercise {
  id: number;
  planDayId: number;
  exerciseId: number;
  tier: string;
  sortOrder: number;
  tmExerciseId: number;
  displayName: string | null;
  exercise: Exercise;
  tmExercise: Exercise;
}

export interface PlanDay {
  id: number;
  planId: number;
  dayNumber: number;
  name: string | null;
  exercises: PlanDayExercise[];
}

export interface WorkoutPlan {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  daysPerWeek: number;
  isPublic: boolean;
  isSystem: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  days: PlanDay[];
}

export interface SubscribeResponse {
  userPlan: {
    id: number;
    userId: number;
    planId: number;
    isActive: boolean;
    startedAt: string;
    plan: WorkoutPlan;
  };
  requiredExercises: Exercise[];
  missingTMs: Exercise[];
}

export async function getPlans(): Promise<WorkoutPlan[]> {
  const data = await apiFetch('/plans');
  return data as WorkoutPlan[];
}

export async function getCurrentPlan(): Promise<WorkoutPlan | null> {
  const data = await apiFetch('/plans/current');
  return data as WorkoutPlan | null;
}

export async function subscribeToPlan(planId: number): Promise<SubscribeResponse> {
  const data = await apiFetch(`/plans/${planId}/subscribe`, {
    method: 'POST',
  });
  return data as SubscribeResponse;
}
