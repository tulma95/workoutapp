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
  tier: string;
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
      tier: string;
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
}

export async function getAdminPlans(): Promise<AdminPlanListItem[]> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('/api/admin/plans', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch admin plans');
  }

  return response.json();
}

export async function getAdminPlan(planId: number): Promise<PlanWithDetails> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api/admin/plans/${planId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch plan');
  }

  return response.json();
}

export async function createPlan(input: CreatePlanInput): Promise<WorkoutPlan> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('/api/admin/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create plan');
  }

  return response.json();
}

export async function updatePlan(planId: number, input: CreatePlanInput): Promise<WorkoutPlan> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api/admin/plans/${planId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update plan');
  }

  return response.json();
}

export async function archivePlan(planId: number): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api/admin/plans/${planId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to archive plan');
  }
}
